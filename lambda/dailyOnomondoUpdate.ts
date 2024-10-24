import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import {
	RejectedRecordsException,
	TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'
import { fromEnv } from '@bifravst/from-env'
import { metricsForComponent } from '@hello.nrfcloud.com/lambda-helpers/metrics'
import middy from '@middy/core'
import { TWO_MONTHS_AGO } from './constants.js'
import { getNewRecords } from './getNewRecords.js'
import { getSIMHistoryTs } from './getSimDetailsFromCache.js'
import { getSimUsageHistoryOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'

const ssm = new SSMClient({})
const { cacheTableName, tableInfo } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
	tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
})(process.env)
const [dbName, tableName] = tableInfo.split('|') as [string, string]
const db = new DynamoDBClient({})

const tsw = new TimestreamWriteClient({})

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

const getHistoryTs = getSIMHistoryTs(db, cacheTableName)

const { track, metrics } = metricsForComponent('getAllSimUsageOnomondo')

const h = async (): Promise<void> => {
	const dataUsage = await getSimUsageHistoryOnomondo({
		apiKey,
		date: new Date(Date.now() - 60 * 1000 * 60 * 23), //yesterday
	})
	if ('error' in dataUsage) {
		return
	}
	const iccids = Object.keys(dataUsage)
	let numberOfRejectedRecords = 0
	let numberOfErrors = 0
	let numberOfRecords = 0
	for (const iccid of iccids) {
		const oldHistoryTs: Date = (await getHistoryTs(iccid)) ?? TWO_MONTHS_AGO
		const records = getNewRecords(iccid, oldHistoryTs, dataUsage)
		numberOfRecords += records.length
		const historicalDataStoring = await storeHistoricalDataFunc(records)
		if ('error' in historicalDataStoring) {
			if (historicalDataStoring.error instanceof RejectedRecordsException) {
				console.error(
					`Rejected records for ${iccid}:`,
					JSON.stringify(historicalDataStoring.error.RejectedRecords),
				)
			} else {
				console.error(`Error for ${iccid}:`, historicalDataStoring.error)
			}
			numberOfErrors += historicalDataStoring.numberOfErrors
			numberOfRejectedRecords += historicalDataStoring.numberOfRejectedRecords
		}
	}
	track(
		`dailyOnomondoRejectedRecords`,
		MetricUnit.Count,
		numberOfRejectedRecords,
	)
	track(`dailyOnomondoRecordError`, MetricUnit.Count, numberOfErrors)
	track(
		`dailyOnomondoRecordsWritten`,
		MetricUnit.Count,
		numberOfRecords - numberOfErrors - numberOfRejectedRecords,
	)
}
export const handler = middy().use(logMetrics(metrics)).handler(h)
