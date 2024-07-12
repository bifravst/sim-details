import { getSimUsageHistoryOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { getSimDetailsFromCache } from './getSimDetailsFromCache.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { storeUsageInTimestream } from './storeUsageInTimestream.js'

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
const storeUsageInTimestreamFunc = storeUsageInTimestream({
	getSimDetailsFromCache: getSimDetailsFromCache(db, cacheTableName),
	storeHistoricalData: storeHistoricalDataInDB({ tsw, dbName, tableName }),
})

export const handler = async (): Promise<void> => {
	const dataUsage = await getSimUsageHistoryOnomondo({
		apiKey,
		date: new Date(Date.now() - 60 * 1000 * 60 * 23), //yesterday
	})
	const iccids = Object.keys(dataUsage)
	for (const iccid of iccids) {
		await storeUsageInTimestreamFunc(iccid, dataUsage)
	}
}
