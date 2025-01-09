import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { putSimDetails } from '../../lambda/putSimDetails.js'

//put recent data on DB
export const seedDynamoDB =
	({ db, cacheTableName }: { db: DynamoDBClient; cacheTableName: string }) =>
	async ({
		iccid,
		usageTimestamp,
		simDetails,
	}: {
		iccid: string
		usageTimestamp: Date
		simDetails: { usedBytes: number; totalBytes: number }
	}): Promise<void> => {
		await putSimDetails(
			db,
			cacheTableName,
		)({
			iccid,
			simExisting: true,
			simDetails,
			ts: usageTimestamp,
		})
	}
