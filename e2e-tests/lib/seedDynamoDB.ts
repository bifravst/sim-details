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
		SIMMissingFromVendorAPI,
	}: {
		iccid: string
		usageTimestamp: Date
		simDetails: { usedBytes: number; totalBytes: number }
		simExisting?: boolean
		SIMMissingFromVendorAPI?: boolean
	}): Promise<void> => {
		await putSimDetails(
			db,
			cacheTableName,
		)({
			iccid,
			simExisting: simExisting ?? true,
			SIMMissingFromVendorAPI: SIMMissingFromVendorAPI ?? false,
			simDetails,
			ts: usageTimestamp,
		})
	}
