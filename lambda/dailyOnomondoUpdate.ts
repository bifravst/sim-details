import { getSimUsageHistoryOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { getSIMHistoryTs } from './getSimDetailsFromCache.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { getNewRecords } from './getNewRecords.js'
import { RejectedRecordsException } from '@aws-sdk/client-timestream-write'
import { TWO_MONTHS_AGO } from './constants.js'

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

export const handler = async (): Promise<void> => {
	const dataUsage = await getSimUsageHistoryOnomondo({
		apiKey,
		date: new Date(Date.now() - 60 * 1000 * 60 * 23), //yesterday
	})
	if ('error' in dataUsage) {
		return
	}
	const iccids = Object.keys(dataUsage)
	for (const iccid of iccids) {
		const oldHistoryTs: Date = (await getHistoryTs(iccid)) ?? TWO_MONTHS_AGO
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
	}
}
