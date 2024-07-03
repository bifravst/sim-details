import { fromEnv } from '@nordicsemiconductor/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { getActiveSims } from './wirelessLogic/getActiveSims.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fetchWirelessLogicSIMDetails } from './wirelessLogic/fetchWirelessLogicSIMDetails.js'
import { putSimDetails } from './putSimDetails.js'
import { wirelessLogicDataLimit } from './constants.js'

const ssm = new SSMClient({})
const db = new DynamoDBClient({})

const { cacheTableName } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
})(process.env)

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

export const handler = async (): Promise<void> => {
	const iccids = await getSims()
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
	await Promise.all(
		iccids.map(async (iccid) => {
			const simDetails = {
				usedBytes: usage.value.usedBytes[iccid] ?? 0,
				totalBytes: usage.value.totalBytes,
			}
			await putSimDetailsFunc(iccid, true, simDetails)
		}),
	)
}
