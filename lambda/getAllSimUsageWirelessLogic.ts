import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { getActiveSims } from './wirelessLogic/getActiveSims.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fetchWirelessLogicSIMDetails } from './wirelessLogic/fetchWirelessLogicSIMDetails.js'
import { putSimDetails } from './putSimDetails.js'
import { wirelessLogicDataLimit } from './constants.js'
import {
	RejectedRecordsException,
	TimestreamWriteClient,
	type _Record,
} from '@aws-sdk/client-timestream-write'
import { usageToRecord } from './usageToRecord.js'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
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
export const handler = async (): Promise<void> => {
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
	}
}
