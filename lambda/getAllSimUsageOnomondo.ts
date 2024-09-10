import { SQSClient } from '@aws-sdk/client-sqs'
import { getSimUsageHistoryOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { queueJob } from './queueJob.js'
import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { getSimDetailsFromCache } from './getSimDetailsFromCache.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { getHistoryTs } from './getHistoryTs.js'
import { getNewRecords } from './getNewRecords.js'
import { RejectedRecordsException } from '@aws-sdk/client-timestream-write'
const ssm = new SSMClient({})
const { cacheTableName, simDetailsJobsQueue, tableInfo } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
	simDetailsJobsQueue: 'SIM_DETAILS_JOBS_QUEUE',
	tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
})(process.env)
const [dbName, tableName] = tableInfo.split('|') as [string, string]
const db = new DynamoDBClient({})

const tsw = new TimestreamWriteClient({})

export const q = queueJob({
	QueueUrl: simDetailsJobsQueue,
	sqs: new SQSClient({}),
})

const apiKey = (
	await ssm.send(
		new GetParameterCommand({
			Name: '/sim-details/onomondoKey',
		}),
	)
)?.Parameter?.Value
if (apiKey === undefined) {
	console.error('APIKEY undefined')
	throw new Error(`System is not configured!`)
}

const storeHistoricalDataFunc = storeHistoricalDataInDB({
	tsw,
	dbName,
	tableName,
})

const getHistoryTsFunc = getHistoryTs({
	getSimDetailsFromCache: getSimDetailsFromCache(db, cacheTableName),
})

export const handler = async (): Promise<void> => {
	const dataUsage = await getSimUsageHistoryOnomondo({ apiKey })
	if ('error' in dataUsage) {
		return
	}
	const iccids = Object.keys(dataUsage)
	for (const iccid of iccids) {
		const { oldHistoryTs, newHistoryTs } = await getHistoryTsFunc(
			iccid,
			dataUsage,
		)
		const records = getNewRecords(iccid, oldHistoryTs, dataUsage)
		const historicalDataStoring = await storeHistoricalDataFunc(records)
		if ('error' in historicalDataStoring) {
			if (historicalDataStoring.error instanceof RejectedRecordsException) {
				console.error(
					`Rejected records`,
					JSON.stringify(historicalDataStoring.error.RejectedRecords),
				)
			} else {
				console.error(historicalDataStoring.error)
			}
		}
		await q({
			payload: { iccid, newHistoryTs, storeTimestream: false },
			deduplicationId: iccid,
		})
	}
}
