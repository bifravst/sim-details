import type { SQSClient } from '@aws-sdk/client-sqs'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { ErrorType, type ErrorInfo } from '../api/ErrorInfo.js'

export const queueJob =
	({ sqs, QueueUrl }: { sqs: SQSClient; QueueUrl: string }) =>
	async ({
		payload,
		deduplicationId,
		delay,
	}: {
		payload: unknown
		deduplicationId?: string
		delay?: number
	}): Promise<{ error: ErrorInfo } | void> => {
		try {
			await sqs.send(
				new SendMessageCommand({
					QueueUrl,
					MessageBody: JSON.stringify(payload),
					MessageGroupId: deduplicationId,
					MessageDeduplicationId: deduplicationId,
					DelaySeconds: delay,
				}),
			)
		} catch (err) {
			return {
				error: {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				},
			}
		}
	}
