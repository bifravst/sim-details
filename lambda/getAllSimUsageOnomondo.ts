import { SQSClient } from '@aws-sdk/client-sqs'
import { getAllUsedSimsOnomondo } from './onomondo/getAllUsedSimsOnomondo.js'
import { queueJob } from './queueJob.js'
import { fromEnv } from '@bifravst/from-env'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const ssm = new SSMClient({})
const { simDetailsJobsQueue } = fromEnv({
	simDetailsJobsQueue: 'SIM_DETAILS_JOBS_QUEUE',
})(process.env)

export const q = queueJob({
	QueueUrl: simDetailsJobsQueue,
	sqs: new SQSClient({}),
})

const apiKey = (
	await ssm.send(
		new GetParameterCommand({
			Name: '/sim-details/onomondoKey',
		}),
	)
)?.Parameter?.Value
if (apiKey === undefined) {
	console.error('APIKEY undefined')
	throw new Error(`System is not configured!`)
}

export const handler = async (): Promise<void> => {
	const iccidArray = await getAllUsedSimsOnomondo(apiKey)
	for (const iccid of iccidArray) {
		await q({ payload: iccid, deduplicationId: iccid })
	}
}
