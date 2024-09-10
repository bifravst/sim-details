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
import { getHistoryTs } from './getHistoryTs.js'
import { getNewRecords } from './getNewRecords.js'
import { RejectedRecordsException } from '@aws-sdk/client-timestream-write'
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

const getHistoryTsFunc = getHistoryTs({
	getSimDetailsFromCache: getSimDetailsFromCache(db, cacheTableName),
})

const storeHistoricalDataFunc = storeHistoricalDataInDB({
	tsw,
	dbName,
	tableName,
})

/* The constant storeTimestream decides if the history should be stored in Timestream or not,
depending on whether the event comes from an API call or 'getAllSimUsageOnomondo' func.
The history should be stored when it comes from an API call, but if the event comes from 
'getAllSimUsageOnomondo' it is already stored in that function and we only use this funciton
to store the updated total usage in the DB by using the putSimDetailsFunc.*/

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
				let historyTsForStoring = historyTs
				if (storeTimestream) {
					const dataUsage = await getSimUsageHistoryOnomondo({
						apiKey,
						iccid,
					})
					if ('error' in dataUsage) {
						return
					}
					const { oldHistoryTs, newHistoryTs } = await getHistoryTsFunc(
						iccid,
						dataUsage,
					)
					historyTsForStoring = newHistoryTs
					const records = getNewRecords(iccid, oldHistoryTs, dataUsage)
					const historicalDataStoring = await storeHistoricalDataFunc(records)
					if ('error' in historicalDataStoring) {
						if (
							historicalDataStoring.error instanceof RejectedRecordsException
						) {
							console.error(
								`Rejected records`,
								JSON.stringify(historicalDataStoring.error.RejectedRecords),
							)
						} else {
							console.error(historicalDataStoring.error)
						}
					}
				}
				await putSimDetailsFunc({
					iccid,
					simExisting: true,
					simDetails: simDetails.value,
					historyTs: new Date(historyTsForStoring),
				})
			}
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}
