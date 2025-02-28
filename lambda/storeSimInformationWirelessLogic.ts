import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import {
	RejectedRecordsException,
	TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'
import { fromEnv } from '@bifravst/from-env'
import middy from '@middy/core'
import type { SQSEvent } from 'aws-lambda'
import { wirelessLogicDataLimit } from './constants.ts'
import {
	getSimDetailsFromCache,
	SIMMissingFromVendorAPI,
} from './getSimDetailsFromCache.ts'
import { metricsForComponent } from './metrics.ts'
import { putSimDetails } from './putSimDetails.ts'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.ts'
import { usageToRecord } from './usageToRecord.ts'
import { fetchWirelessLogicSIMDetails } from './wirelessLogic/fetchWirelessLogicSIMDetails.ts'
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
const { track, metrics } = metricsForComponent('storeSimInfoWL')

const h = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	for (const message of event.Records) {
		try {
			let numberOfRecords = 0
			let numberOfRejectedRecords = 0
			let numberOfErrors = 0
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
				if (simDetails.error instanceof SIMMissingFromVendorAPI) {
					await putSimDetailsFunc({
						iccid,
						simExisting: false,
						simDetails: undefined,
						SIMMissingFromVendorAPI: true,
						ttl: Date.now() / 1000 + 24 * 60 * 60 * 7, // 7 days
					})
				}
				console.error(simDetails.error)
				await putSimDetailsFunc({
					iccid,
					simExisting: false,
					simDetails: undefined,
					SIMMissingFromVendorAPI: false,
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
					SIMMissingFromVendorAPI: false,
				})
				const diff = (simDetails.value.usedBytes[iccid] ?? 0) - prevUsage
				if (diff > 0) {
					const records = []
					const record = usageToRecord({ iccid, diff })
					if ('record' in record) {
						records.push(record.record)
					}
					numberOfRecords = records.length
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
						numberOfErrors = historicalDataStoring.numberOfErrors
						numberOfRejectedRecords =
							historicalDataStoring.numberOfRejectedRecords
					}
				}
			}
			track(
				`storeSimInfoWLRejectedRecords`,
				MetricUnit.Count,
				numberOfRejectedRecords,
			)
			track(`storeSimInfoWLRecordError`, MetricUnit.Count, numberOfErrors)
			track(
				`storeSimInfoWLRecordsWritten`,
				MetricUnit.Count,
				numberOfRecords - numberOfErrors - numberOfRejectedRecords,
			)
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}

export const handler = middy<SQSEvent, void>()
	.use(logMetrics(metrics))
	.handler(h)
