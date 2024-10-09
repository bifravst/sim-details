import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import { fromEnv } from '@bifravst/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { identifyIssuer } from 'e118-iin-list'
import { ErrorType, toStatusCode } from '../api/ErrorInfo.js'
import { res } from '../api/res.js'
import { onomondoIIN, wirelessLogicIIN } from './constants.js'
import {
	SIMNotFoundError,
	getSimDetailsFromCache,
} from './getSimDetailsFromCache.js'
import { HistoricalDataTimeSpans } from './historicalDataTimeSpans.js'
import { listRecordsForInterval } from './listRecordsForInterval.js'
import { olderThan5min } from './olderThan5min.js'
import { queueJob } from './queueJob.js'

const { simDetailsJobsQueue, cacheTableName, wirelessLogicQueue, tableInfo } =
	fromEnv({
		simDetailsJobsQueue: 'SIM_DETAILS_JOBS_QUEUE',
		wirelessLogicQueue: 'WIRELESS_LOGIC_QUEUE',
		cacheTableName: 'CACHE_TABLE_NAME',
		tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
	})(process.env)

const db = new DynamoDBClient({})
const sqs = new SQSClient({})
const ts = new TimestreamQueryClient({})

const [dbName, tableName] = tableInfo.split('|') as [string, string]

const validIssuers: Record<string, string> = {
	[onomondoIIN]: simDetailsJobsQueue,
	[wirelessLogicIIN]: wirelessLogicQueue,
}

const getSimDetailsFromCacheFunc = getSimDetailsFromCache(db, cacheTableName)
const listRecordsForIntervalFunc = listRecordsForInterval(ts, dbName, tableName)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))
	const iccid = event.pathParameters?.iccid ?? ''
	const timeSpan = event.queryStringParameters
	//Check if iccid is existing
	const issuer = identifyIssuer(iccid)
	if (issuer === undefined) {
		return res(toStatusCode[ErrorType.BadRequest], {
			expires: 60,
			contentType: 'application/problem+json',
		})({
			type: 'https://github.com/bifravst/sim-details',
			title: "Your request parameters didn't validate.",
			'invalid-params': [
				{
					name: 'iccid',
					reason:
						'Not a valid iccid. Must include MII, country code, issuer identifier, individual account identification number and parity check digit. See https://www.itu.int/rec/dologin_pub.asp?lang=e&id=T-REC-E.118-200605-I!!PDF-E&type=items for more information.',
				},
			],
		})
	}
	//Check if iccid from a valid issuer
	const isSupportedIssuer = Object.keys(validIssuers).includes(
		issuer.issuerIdentifierNumber,
	)
	if (isSupportedIssuer === false) {
		//SIM not existing since issuer is not supported.
		return res(toStatusCode[ErrorType.EntityNotFound], { expires: 60 })()
	}
	const maybeSimDetails = await getSimDetailsFromCacheFunc(iccid)
	if ('error' in maybeSimDetails) {
		//No information about SIM in Cache
		if (maybeSimDetails.error instanceof SIMNotFoundError) {
			await queueJob({
				QueueUrl: validIssuers[issuer.issuerIdentifierNumber] as string,
				sqs,
			})({ payload: { iccid }, deduplicationId: iccid })
			return res(toStatusCode[ErrorType.Conflict], { expires: 60 })()
		}
		//SIM not existing
		return res(toStatusCode[ErrorType.EntityNotFound], { expires: 60 })()
	}
	const timeStampFromDB = maybeSimDetails.sim.ts
	const isOld = olderThan5min({ timeStampFromDB })
	if (isOld == true) {
		await queueJob({
			QueueUrl: validIssuers[issuer.issuerIdentifierNumber] as string,
			sqs,
		})({ payload: { iccid }, deduplicationId: iccid })
	}
	const timeSpanFromReq = timeSpan?.timespan
	const timeSpans = HistoricalDataTimeSpans[timeSpanFromReq!]
	if (timeSpans !== undefined) {
		const result = await listRecordsForIntervalFunc({
			timespan: {
				binIntervalMinutes: timeSpans.binIntervalMinutes,
				durationHours: timeSpans.durationHours,
			},
			iccid,
		})
		const measurements = result.map((measurement) => ({
			ts: measurement.time,
			usedBytes: measurement['measure_value::double'],
		}))
		return res(200, {
			expires: 300,
		})({ measurements })
	}
	const timespans = Object.keys(HistoricalDataTimeSpans)
	const dataUsagePerTimespan: Record<string, number> = {}
	for (const timespan of timespans) {
		const history = await listRecordsForIntervalFunc({
			timespan: {
				binIntervalMinutes:
					HistoricalDataTimeSpans[timespan]!.binIntervalMinutes,
				durationHours: HistoricalDataTimeSpans[timespan]!.durationHours,
			},
			iccid,
		})
		let sum = 0
		for (const h of history) {
			sum += h['measure_value::double']
		}
		dataUsagePerTimespan[timespan] = sum
	}
	return res(200, {
		expires: 300,
	})({
		...maybeSimDetails.sim,
		dataUsagePerTimespan,
	})
}
