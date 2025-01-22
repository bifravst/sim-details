import { type DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
export const putSimHistory =
	(db: DynamoDBClient, cacheTableName: string) =>
	async ({
		iccid,
		timespan,
		measurements,
		ts,
	}: {
		iccid: string
		timespan: string
		measurements: string
		ts?: Date
	}): Promise<void> => {
		await db.send(
			new PutItemCommand({
				TableName: cacheTableName,
				Item: marshall({
					iccid: `${iccid}-${timespan}`,
					ttl: Date.now() / 1000 + 24 * 60 * 60 * 30, // 30 days
					timespan,
					measurements,
					ts: (ts ?? new Date()).toISOString(),
				}),
			}),
		)
	}
