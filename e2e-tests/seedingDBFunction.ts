import { putSimDetails } from '../lambda/putSimDetails.js'
import { db, outputs } from './e2eTest.spec.js'

export const seedingDBFunction = async ({
	iccid,
	usageTimestamp,
	simDetails,
}: {
	iccid: string
	usageTimestamp: Date
	simDetails: { usedBytes: number; totalBytes: number }
}): Promise<void> => {
	//put recent data on DB
	await putSimDetails(
		db,
		outputs.cacheTableName,
	)({
		iccid,
		simExisting: true,
		simDetails,
		ts: usageTimestamp,
	})
}
