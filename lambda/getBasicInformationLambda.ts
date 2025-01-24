import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import { fromEnv } from '@bifravst/from-env'
import middy from '@middy/core'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { identifyIssuer } from 'e118-iin-list'
import { once } from 'lodash-es'
import { ErrorType, toStatusCode } from '../api/ErrorInfo.ts'
import { res } from '../api/res.ts'
import { onomondoIIN, wirelessLogicIIN } from './constants.ts'
import { getAvailableColumns } from './getAvailableColumns.ts'
import {
	SIMNotFoundError,
	getSimDetailsFromCache,
} from './getSimDetailsFromCache.ts'
import { getSimHistoryFromCache } from './getSIMHistoryFromCache.ts'
import { HistoricalDataTimeSpans } from './historicalDataTimeSpans.ts'
import { listRecordsForInterval } from './listRecordsForInterval.ts'
import { metricsForComponent } from './metrics.ts'
import { olderThan5min } from './olderThan5min.ts'
import { putSimHistory } from './putSimHistory.ts'
import { queueJob } from './queueJob.ts'

const {
	simDetailsJobsQueue,
	cacheTableName,
	wirelessLogicQueue,
	cacheHistoryTableName,
	tableInfo,
	isTest,
} = fromEnv({
	simDetailsJobsQueue: 'SIM_DETAILS_JOBS_QUEUE',
	wirelessLogicQueue: 'WIRELESS_LOGIC_QUEUE',
	cacheTableName: 'CACHE_TABLE_NAME',
	cacheHistoryTableName: 'CACHE_HISTORY_TABLE_NAME',
	tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
	isTest: 'IS_TEST',
})(process.env)

const db = new DynamoDBClient({})
const sqs = new SQSClient({})
const ts = new TimestreamQueryClient({})

const [dbName, tableName] = tableInfo.split('|') as [string, string]

const validIssuers: Record<string, string> = {
	[onomondoIIN]: simDetailsJobsQueue,
	[wirelessLogicIIN]: wirelessLogicQueue,
}

const putSimHistoryFunc = putSimHistory(db, cacheHistoryTableName)
const putSimAvgUsage = putSimHistory(db, cacheTableName)
const getSimDetailsFromCacheFunc = getSimDetailsFromCache(db, cacheTableName)
const getSimHistoryFromCacheFunc = getSimHistoryFromCache(
	db,
	cacheHistoryTableName,
)
const getSimDetailsAvgUsageFromCacheFunc = getSimHistoryFromCache(
	db,
	cacheTableName,
)
const listRecordsForIntervalFunc = listRecordsForInterval(ts, dbName, tableName)
const { track, metrics } = metricsForComponent('getAllSimUsageOnomondo')

// Do not cache the result if we are in test mode
const availableColumnsCache =
	isTest === '1'
		? async () => {
				console.warn(`Fetching available columns for ${dbName}.${tableName}.`)
				const cols = await getAvailableColumns(ts, dbName, tableName)()
				console.warn(`Available columns`, JSON.stringify(cols))
				return cols
			}
		: once(getAvailableColumns(ts, dbName, tableName))

const h = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))
	const iccid = event.pathParameters?.iccid ?? ''
	const timeSpan = event.queryStringParameters
	//Check if iccid is existing
	const issuer = identifyIssuer(iccid)
	if (issuer === undefined) {
		track('api:undefinedSIMIssuer', MetricUnit.Count, 1)
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
		track('api:notSupportedSIMIssuer', MetricUnit.Count, 1)
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
			track('api:noSIMInfoCache', MetricUnit.Count, 1)
			return res(toStatusCode[ErrorType.Conflict], { expires: 60 })()
		}
		track('api:SIMNotExisting', MetricUnit.Count, 1)
		//SIM not existing
		return res(toStatusCode[ErrorType.EntityNotFound], { expires: 60 })()
	}
	const availableColumns = await availableColumnsCache()
	const timeStampFromDB = maybeSimDetails.sim.ts
	const isOld = olderThan5min({ timeStampFromDB })
	if (isOld == true) {
		await queueJob({
			QueueUrl: validIssuers[issuer.issuerIdentifierNumber] as string,
			sqs,
		})({ payload: { iccid }, deduplicationId: iccid })
	}
	const timeSpanFromReq = timeSpan?.timespan ?? ''
	const timestampUppercaseLetter =
		timeSpanFromReq.slice(0, 4) +
		(timeSpanFromReq.charAt(4).toUpperCase() || '') +
		timeSpanFromReq.slice(5)
	const timeSpans = HistoricalDataTimeSpans[timestampUppercaseLetter]
	if (timeSpans !== undefined) {
		const maybeHistory = await getSimHistoryFromCacheFunc(
			iccid,
			timestampUppercaseLetter,
		)
		const isOld =
			'simHistory' in maybeHistory
				? olderThan5min({ timeStampFromDB: maybeHistory.simHistory.ts })
				: false
		if ('error' in maybeHistory || maybeHistory === undefined || isOld) {
			const result = await listRecordsForIntervalFunc({
				timespan: {
					binIntervalMinutes: timeSpans.binIntervalMinutes,
					durationHours: timeSpans.durationHours,
				},
				iccid,
				availableColumns,
			})
			if ('error' in result) {
				return res(200, {
					expires: 300,
				})({ measurements: [] })
			}
			const measurements = result.value.map((measurement) => ({
				ts: measurement.time,
				usedBytes: measurement['measure_value::double'],
			}))
			//cache history
			await putSimHistoryFunc({
				iccid,
				timespan: timestampUppercaseLetter,
				measurements: JSON.stringify(measurements),
			})
			return res(200, {
				expires: 300,
			})({ measurements })
		} else {
			const measurements = maybeHistory.simHistory.measurements
			track('api:successHistory', MetricUnit.Count, 1)
			return res(200, {
				expires: 300,
			})({ measurements })
		}
	}
	track('api:successSimDetails', MetricUnit.Count, 1)
	const maybeSimDetailsAvgUsageFromCache =
		await getSimDetailsAvgUsageFromCacheFunc(iccid, 'avgUsage')
	const isOldAvgUsage =
		'simHistory' in maybeSimDetailsAvgUsageFromCache
			? olderThan5min({
					timeStampFromDB: maybeSimDetailsAvgUsageFromCache.simHistory.ts,
				})
			: false
	if (
		'error' in maybeSimDetailsAvgUsageFromCache ||
		maybeSimDetailsAvgUsageFromCache === undefined ||
		isOldAvgUsage
	) {
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
				availableColumns,
			})
			if ('error' in history) {
				dataUsagePerTimespan[timespan] = 0
				continue
			}
			let sum = 0
			for (const h of history.value) {
				sum += h['measure_value::double']
			}
			dataUsagePerTimespan[timespan] = sum
		}
		await putSimAvgUsage({
			iccid,
			timespan: 'avgUsage',
			measurements: JSON.stringify(dataUsagePerTimespan),
		})
		return res(200, {
			expires: 300,
		})({
			...maybeSimDetails.sim,
			dataUsagePerTimespan,
		})
	} else {
		const dataUsagePerTimespan =
			maybeSimDetailsAvgUsageFromCache.simHistory.measurements
		return res(200, {
			expires: 300,
		})({
			...maybeSimDetails.sim,
			dataUsagePerTimespan,
		})
	}
}

export const handler = middy().use(logMetrics(metrics)).handler(h)
