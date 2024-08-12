import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
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
import { olderThan5min } from './olderThan5min.js'
import { queueJob } from './queueJob.js'

const { simDetailsJobsQueue, cacheTableName, wirelessLogicQueue } = fromEnv({
	simDetailsJobsQueue: 'SIM_DETAILS_JOBS_QUEUE',
	wirelessLogicQueue: 'WIRELESS_LOGIC_QUEUE',
	cacheTableName: 'CACHE_TABLE_NAME',
})(process.env)

export const db = new DynamoDBClient({})
const sqs = new SQSClient({})

const validIssuers: Record<string, string> = {
	[onomondoIIN]: simDetailsJobsQueue,
	[wirelessLogicIIN]: wirelessLogicQueue,
}

const getSimDetailsFromCacheFunc = getSimDetailsFromCache(db, cacheTableName)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))
	const iccid = event.pathParameters?.iccid ?? ''
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
	const isValidIccid = Object.keys(validIssuers).includes(
		issuer.issuerIdentifierNumber,
	)
	if (isValidIccid === false) {
		return res(toStatusCode[ErrorType.BadRequest], {
			expires: 60,
			contentType: 'application/problem+json',
		})({
			type: 'https://github.com/bifravst/sim-details',
			title: "Your request parameters didn't validate.",
			'invalid-params': [
				{
					name: 'iccid',
					reason: 'Not a valid issuer identifier.',
				},
			],
		})
	}
	const maybeSimDetails = await getSimDetailsFromCacheFunc(iccid)
	if ('error' in maybeSimDetails) {
		//No information about SIM in Cache
		if (maybeSimDetails.error instanceof SIMNotFoundError) {
			await queueJob({
				QueueUrl: validIssuers[issuer.issuerIdentifierNumber] as string,
				sqs,
			})({ payload: iccid, deduplicationId: iccid })
			return res(toStatusCode[ErrorType.Conflict], { expires: 60 })()
		}
		//SIM not existing
		return res(toStatusCode[ErrorType.EntityNotFound], { expires: 60 })()
	}
	//Case 2: old data in DynamoDB (> 5min)
	const timeStampFromDB = maybeSimDetails.sim.timestamp
	const isOld = olderThan5min(timeStampFromDB)
	if (isOld == true) {
		await queueJob({
			QueueUrl: validIssuers[issuer.issuerIdentifierNumber] as string,
			sqs,
		})({ payload: iccid, deduplicationId: iccid })
		return res(200, { expires: 300 })(maybeSimDetails.sim)
	}
	//Case 3: recent data in DynamoDB
	return res(200, {
		expires: 300,
	})(maybeSimDetails.sim)
}
