import type { SQSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { putSimDetails } from './putSimDetails.js'
import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { fetchWirelessLogicSIMDetails } from './wirelessLogic/fetchWirelessLogicSIMDetails.js'
import { wirelessLogicDataLimit } from './constants.js'

const ssm = new SSMClient({})
const db = new DynamoDBClient({})
const { cacheTableName } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
})(process.env)

const putSimDetailsFunc = putSimDetails(db, cacheTableName)

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

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	for (const message of event.Records) {
		try {
			const iccid = message.body.replace(/"/g, '')
			const simDetails = await fetchWirelessLogicSIMDetails({
				iccid,
				apiKey,
				clientId,
				wirelessLogicDataLimit,
			})
			if ('error' in simDetails) {
				console.error(simDetails.error)
				await putSimDetailsFunc(iccid, false, undefined)
			} else {
				const simDetailsToDB = {
					usedBytes: simDetails.value.usedBytes[iccid] ?? 0,
					totalBytes: simDetails.value.totalBytes,
				}
				await putSimDetailsFunc(iccid, true, simDetailsToDB)
			}
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}
