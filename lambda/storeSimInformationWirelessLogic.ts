import type { SQSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { putSimDetails } from './putSimDetails.js'
import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fetchWirelessLogicSIMDetails } from './wirelessLogic/fetchWirelessLogicSIMDetails.js'
import { wirelessLogicDataLimit } from './constants.js'
import { getSimDetailsFromCache } from './getSimDetailsFromCache.js'
import { usageToRecord } from './usageToRecord.js'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import {
	RejectedRecordsException,
	TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'

const ssm = new SSMClient({})
const tsw = new TimestreamWriteClient({})
const db = new DynamoDBClient({})
const { cacheTableName, tableInfo } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
	tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
})(process.env)
const [dbName, tableName] = tableInfo.split('|') as [string, string]

const putSimDetailsFunc = putSimDetails(db, cacheTableName)
const storeHistoricalData = storeHistoricalDataInDB({ tsw, dbName, tableName })

const apiKey = (
	await ssm.send(
		new GetParameterCommand({
			Name: '/sim-details/wirelessLogicKey',
		}),
	)
)?.Parameter?.Value
if (apiKey === undefined) {
	throw new Error(`APIKEY undefined`)
}

const clientId = (
	await ssm.send(
		new GetParameterCommand({
			Name: '/sim-details/wirelessLogicClientId',
		}),
	)
)?.Parameter?.Value
if (clientId === undefined) {
	throw new Error(`CLIENTID undefined`)
}
const getSimDetailsFromCacheFunc = getSimDetailsFromCache(db, cacheTableName)

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	for (const message of event.Records) {
		try {
			const body = JSON.parse(message.body)
			const iccid = body.iccid
			let prevUsage = 0
			const prevSimDetails = await getSimDetailsFromCacheFunc(iccid)
			if ('sim' in prevSimDetails) {
				prevUsage = prevSimDetails.sim.usedBytes
			}
			const simDetails = await fetchWirelessLogicSIMDetails({
				iccid,
				apiKey,
				clientId,
				wirelessLogicDataLimit,
			})
			if ('error' in simDetails) {
				console.error(simDetails.error)
				await putSimDetailsFunc({
					iccid,
					simExisting: false,
					simDetails: undefined,
				})
			} else {
				const simDetailsToDB = {
					usedBytes: simDetails.value.usedBytes[iccid] ?? 0,
					totalBytes: simDetails.value.totalBytes,
				}
				await putSimDetailsFunc({
					iccid,
					simExisting: true,
					simDetails: simDetailsToDB,
				})
				const diff = (simDetails.value.usedBytes[iccid] ?? 0) - prevUsage
				if (diff > 0) {
					const records = []
					const record = usageToRecord({ iccid, diff })
					if ('record' in record) {
						records.push(record.record)
					}
					const historicalDataStoring = await storeHistoricalData(records)
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
			}
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}
