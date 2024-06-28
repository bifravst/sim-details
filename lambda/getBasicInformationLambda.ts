import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import {
	SIMNotExistingError,
	SIMNotFoundError,
	getSimDetailsFromCache,
} from './getSimDetailsFromCache.js'
import { queueJob } from './queueJob.js'
import { SQSClient } from '@aws-sdk/client-sqs'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { res } from '../api/res.js'
import { olderThan5min } from './olderThan5min.js'
import { ErrorType, toStatusCode } from '../api/ErrorInfo.js'

const { simDetailsJobsQueue, cacheTableName } = fromEnv({
	simDetailsJobsQueue: 'SIM_DETAILS_JOBS_QUEUE',
	cacheTableName: 'CACHE_TABLE_NAME',
})(process.env)

export const db = new DynamoDBClient({})

export const q = queueJob({
	QueueUrl: simDetailsJobsQueue,
	sqs: new SQSClient({}),
})

const getSimDetailsFromCacheFunc = getSimDetailsFromCache(db, cacheTableName)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))
	//Get data from DynamoDB
	const iccid = event.pathParameters?.iccid ?? ''
	const onomondoRegex = /89(\d{0,2})73/
	const isOnomondoIccid = onomondoRegex.test(iccid)
	if (isOnomondoIccid === false) {
		return res(toStatusCode[ErrorType.EntityNotFound], { expires: 60 })({})
	}
	const maybeSimDetails = await getSimDetailsFromCacheFunc(iccid)
	if ('error' in maybeSimDetails) {
		//No information about SIM in Cache
		if (maybeSimDetails.error instanceof SIMNotFoundError) {
			await q({ payload: iccid, deduplicationId: iccid })
			return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({})
		}
		//SIM not existing
		else if (maybeSimDetails.error instanceof SIMNotExistingError) {
			return res(toStatusCode[ErrorType.EntityNotFound], { expires: 60 })({})
		}
		console.error('Internal Error: ', maybeSimDetails.error)
		//Internal Error
		return res(toStatusCode[ErrorType.InternalError], { expires: 60 })({})
	}
	//Case 2: old data in DynamoDB (> 5min)
	const timeStampFromDB = maybeSimDetails.success.timestamp
	const isOld = olderThan5min(timeStampFromDB)
	if (isOld == true) {
		await q({ payload: iccid, deduplicationId: iccid })
		return res(200, { expires: 300 })({
			timestamp: timeStampFromDB,
			simDetails: maybeSimDetails.success.simDetails,
		})
	}
	//Case 3: recent data in DynamoDB
	return res(200, {
		expires: 300,
	})({
		timestamp: timeStampFromDB,
		simDetails: maybeSimDetails.success.simDetails,
	})
}
