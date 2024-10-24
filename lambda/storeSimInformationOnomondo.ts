import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import {
	RejectedRecordsException,
	TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'
import { fromEnv } from '@bifravst/from-env'
import type { SQSEvent } from 'aws-lambda'

import { byTsDesc } from '../util/byTsDesc.js'
import { MaybeDate } from '../util/MaybeDate.js'
import { TWO_MONTHS_AGO } from './constants.js'
import { getNewRecords } from './getNewRecords.js'
import { getSIMHistoryTs } from './getSimDetailsFromCache.js'
import { fetchOnomondoSIMDetails } from './onomondo/fetchOnomondoSimDetails.js'
import { getSimUsageHistoryOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { putSimDetails } from './putSimDetails.js'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'

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

const storeHistoricalDataFunc = storeHistoricalDataInDB({
	tsw,
	dbName,
	tableName,
})

const getHistoryTs = getSIMHistoryTs(db, cacheTableName)

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
			const historyTs: undefined | Date = MaybeDate(body.newHistoryTs)
			const storeTimestream: boolean = body.storeTimestream ?? true
			const simDetails = await fetchOnomondoSIMDetails({ iccid, apiKey })
			console.log('simdetails!!!', simDetails)
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
					const oldHistoryTs: Date =
						(await getHistoryTs(iccid)) ?? TWO_MONTHS_AGO
					const newHistoryTs: Date =
						MaybeDate([...(dataUsage[iccid] ?? [])].sort(byTsDesc)[0]?.ts) ??
						oldHistoryTs
					historyTsForStoring = newHistoryTs ?? TWO_MONTHS_AGO
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
				console.log('before putting details in DynamoDB')
				await putSimDetailsFunc({
					iccid,
					simExisting: true,
					simDetails: simDetails.value,
					historyTs: historyTsForStoring,
				})
			}
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}
