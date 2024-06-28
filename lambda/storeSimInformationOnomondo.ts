import type { SQSEvent } from 'aws-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { putSimDetails } from './putSimDetails.js'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { fetchOnomondoSIMDetails } from './onomondo/fetchOnomondoSimDetails.js'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const ssm = new SSMClient({})
const db = new DynamoDBClient({})
const { cacheTableName } = fromEnv({
	cacheTableName: 'CACHE_TABLE_NAME',
})(process.env)

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

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	for (const message of event.Records) {
		try {
			const iccid = message.body.replace(/"/g, '')
			const simDetails = await fetchOnomondoSIMDetails({ iccid, apiKey })
			if ('error' in simDetails) {
				await putSimDetailsFunc(iccid, false, undefined)
			} else {
				await putSimDetailsFunc(iccid, true, simDetails.value)
			}
		} catch {
			console.log('error processing SQSEvent', JSON.stringify(message))
		}
	}
}
