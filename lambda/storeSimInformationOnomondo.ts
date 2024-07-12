import type { SQSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { putSimDetails } from './putSimDetails.js'
import { fromEnv } from '@bifravst/from-env'
import { fetchOnomondoSIMDetails } from './onomondo/fetchOnomondoSimDetails.js'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { getSimUsageHistoryOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { getSimDetailsFromCache } from './getSimDetailsFromCache.js'
import { storeUsageInTimestream } from './storeUsageInTimestream.js'

const ssm = new SSMClient({})
const tsw = new TimestreamWriteClient({})
const db = new DynamoDBClient({})
const { cacheTableName, tableInfo } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
	tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
})(process.env)
const [dbName, tableName] = tableInfo.split('|') as [string, string]

const putSimDetailsFunc = putSimDetails(db, cacheTableName)

const apiKey = (
	await ssm.send(
		new GetParameterCommand({
			Name: '/sim-details/onomondoKey',
		}),
	)
)?.Parameter?.Value
if (apiKey === undefined) {
	throw new Error(`APIKEY undefined`)
}

const storeUsageInTimestreamFunc = storeUsageInTimestream({
	getSimDetailsFromCache: getSimDetailsFromCache(db, cacheTableName),
	storeHistoricalData: storeHistoricalDataInDB({ tsw, dbName, tableName }),
})

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	for (const message of event.Records) {
		try {
			const body = JSON.parse(message.body)
			const iccid = body.iccid
			const historyTs: string | Date = body.lastTs
			const storeTimestream: boolean = body.storeTimestream ?? true
			const simDetails = await fetchOnomondoSIMDetails({ iccid, apiKey })
			if ('error' in simDetails) {
				await putSimDetailsFunc({
					iccid,
					simExisting: false,
					simDetails: undefined,
				})
			} else {
				let newHistoryTs = historyTs
				if (storeTimestream) {
					const dataUsage = await getSimUsageHistoryOnomondo({
						apiKey,
						iccid,
					})
					newHistoryTs = await storeUsageInTimestreamFunc(iccid, dataUsage)
				}
				await putSimDetailsFunc({
					iccid,
					simExisting: true,
					simDetails: simDetails.value,
					historyTs: new Date(newHistoryTs),
				})
			}
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}
