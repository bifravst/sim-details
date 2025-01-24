import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { putSimDetails } from '../../lambda/putSimDetails.ts'

//put recent data on DB
export const seedDynamoDB =
	({ db, cacheTableName }: { db: DynamoDBClient; cacheTableName: string }) =>
	async ({
		iccid,
		usageTimestamp,
		simDetails,
		simExisting,
	}: {
		iccid: string
		usageTimestamp: Date
		simDetails: { usedBytes: number; totalBytes: number }
		simExisting?: boolean
	}): Promise<void> => {
		await putSimDetails(
			db,
			cacheTableName,
		)({
			iccid,
			simExisting: simExisting ?? true,
			simDetails,
			ts: usageTimestamp,
		})
	}
