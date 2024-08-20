import { type DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
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
		await db.send(
			new PutItemCommand({
				TableName: cacheTableName,
				Item: marshall({
					iccid,
					historyTs: historyTs ? historyTs.toISOString() : 'NULL',
					ttl: Date.now() / 1000 + 24 * 60 * 60 * 30, // 30 days
					usedBytes: simDetails?.usedBytes ?? 0,
					totalBytes: simDetails?.totalBytes ?? 0,
					SIMExisting: simExisting,
					ts: (ts ?? new Date()).toISOString(),
				}),
			}),
		)
	}
