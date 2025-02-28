import { type DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import type { SimDetails } from './getSimDetailsFromCache.ts'
export const putSimDetails =
	(db: DynamoDBClient, cacheTableName: string) =>
	async ({
		iccid,
		simExisting,
		SIMMissingFromVendorAPI,
		simDetails,
		historyTs,
		ts,
		ttl,
	}: {
		iccid: string
		simExisting: boolean
		SIMMissingFromVendorAPI: boolean
		simDetails?: SimDetails
		historyTs?: Date
		ts?: Date
		ttl?: number
	}): Promise<void> => {
		await db.send(
			new PutItemCommand({
				TableName: cacheTableName,
				Item: marshall({
					iccid,
					historyTs: historyTs ? historyTs.toISOString() : null,
					ttl: ttl ?? Date.now() / 1000 + 24 * 60 * 60 * 30, // 30 days
					usedBytes: simDetails?.usedBytes ?? 0,
					totalBytes: simDetails?.totalBytes ?? 0,
					SIMExisting: simExisting,
					SIMMissingFromVendorAPI,
					ts: (ts ?? new Date()).toISOString(),
				}),
			}),
		)
	}
