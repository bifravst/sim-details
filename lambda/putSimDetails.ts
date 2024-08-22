import { type DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import type { SimDetails } from './getSimDetailsFromCache.js'

export const putSimDetails =
	(db: DynamoDBClient, cacheTableName: string) =>
	async ({
		iccid,
		simExisting,
		simDetails,
		historyTs,
		ts,
	}: {
		iccid: string
		simExisting: boolean
		simDetails?: SimDetails
		historyTs?: Date
		ts?: Date
	}): Promise<void> => {
		const history = historyTs ? { S: historyTs.toISOString() } : { NULL: true }
		await db.send(
			new PutItemCommand({
				TableName: cacheTableName,
				Item: {
					iccid: { S: iccid },
					historyTs: history,
					ttl: { N: (Date.now() / 1000 + 24 * 60 * 60 * 30).toString() }, // 30 days
					usedBytes: { N: (simDetails?.usedBytes ?? 0).toString() },
					totalBytes: { N: (simDetails?.totalBytes ?? 0).toString() },
					SIMExisting: { BOOL: simExisting },
					ts: { S: (ts ?? new Date()).toISOString() },
				},
			}),
		)
	}
