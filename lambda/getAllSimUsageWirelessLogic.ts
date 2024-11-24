import { MetricUnit } from '@aws-lambda-powertools/metrics'
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import {
	RejectedRecordsException,
	TimestreamWriteClient,
	type _Record,
} from '@aws-sdk/client-timestream-write'
import { fromEnv } from '@bifravst/from-env'
import middy from '@middy/core'
import { wirelessLogicDataLimit } from './constants.js'
import { metricsForComponent } from './metrics.js'
import { putSimDetails } from './putSimDetails.js'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import { usageToRecord } from './usageToRecord.js'
import { fetchWirelessLogicSIMDetails } from './wirelessLogic/fetchWirelessLogicSIMDetails.js'
import { getActiveSims } from './wirelessLogic/getActiveSims.js'

const ssm = new SSMClient({})
const db = new DynamoDBClient({})
const tsw = new TimestreamWriteClient({})

const { cacheTableName, tableInfo } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
	tableInfo: 'TABLE_INFO', // db-S1mQFez6xa7o|table-RF9ZgR5BtR1K
})(process.env)
const [dbName, tableName] = tableInfo.split('|') as [string, string]

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

const getSims = getActiveSims(db, cacheTableName)
const putSimDetailsFunc = putSimDetails(db, cacheTableName)
const storeHistoricalData = storeHistoricalDataInDB({ tsw, dbName, tableName })
const { track, metrics } = metricsForComponent('getAllSimUsageWL')

const h = async (): Promise<void> => {
	const iccidAndUsage = await getSims()
	const iccids = Object.keys(iccidAndUsage)
	const usage = await fetchWirelessLogicSIMDetails({
		iccid: iccids,
		apiKey,
		clientId,
		wirelessLogicDataLimit,
	})
	if ('error' in usage) {
		console.error(usage.error)
		track('getAllSimUsageWL:dataUsageError', MetricUnit.Count, 1)
		return
	}
	const records: _Record[] = []
	await Promise.all(
		iccids.map(async (iccid) => {
			const diff =
				(iccidAndUsage[iccid] ?? 0) - (usage.value.usedBytes[iccid] ?? 0)
			const record = usageToRecord({ iccid, diff })
			if ('record' in record) {
				records.push(record.record)
			}
			const simDetails = {
				usedBytes: usage.value.usedBytes[iccid] ?? 0,
				totalBytes: usage.value.totalBytes,
			}
			await putSimDetailsFunc({ iccid, simExisting: true, simDetails })
		}),
	)
	let numberOfRejectedRecords = 0
	let numberOfErrors = 0
	const historicalDataStoring = await storeHistoricalData(records)
	if ('error' in historicalDataStoring) {
		if (historicalDataStoring.error instanceof RejectedRecordsException) {
			console.error(
				`Rejected records`,
				JSON.stringify(historicalDataStoring.error.RejectedRecords),
			)
		} else {
			console.error(historicalDataStoring.error)
		}
		numberOfErrors = historicalDataStoring.numberOfErrors
		numberOfRejectedRecords = historicalDataStoring.numberOfRejectedRecords
	}
	track('WL:ActiveIccids', MetricUnit.Count, iccids.length)
	track(
		`getAllSimUsageWLRejectedRecords`,
		MetricUnit.Count,
		numberOfRejectedRecords,
	)
	track(`getAllSimUsageWLRecordError`, MetricUnit.Count, numberOfErrors)
	track(
		`getAllSimUsageWLRecordsWritten`,
		MetricUnit.Count,
		records.length - numberOfErrors - numberOfRejectedRecords,
	)
}
export const handler = middy().use(logMetrics(metrics)).handler(h)
