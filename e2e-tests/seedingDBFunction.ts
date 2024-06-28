import { putSimDetails } from '../lambda/putSimDetails.js'
import { db, outputs } from './e2eTest.spec.js'

export const seedingDBFunction = async ({
	iccidNew,
	iccidOld,
	iccidNotExisting,
	now,
	sixMinAgo,
}: {
	iccidNew: string
	iccidOld: string
	iccidNotExisting: string
	now: Date
	sixMinAgo: Date
}): Promise<void> => {
	const simDetails = {
		usedBytes: 0,
		totalBytes: 1000,
	}
	const simDetails2 = {
		usedBytes: 50,
		totalBytes: 1000,
	}
	//put recent data on DB
	await putSimDetails(db, outputs.cacheTableName)(
		iccidNew,
		true,
		simDetails,
		now,
	)
	//put old data in DB
	await putSimDetails(db, outputs.cacheTableName)(
		iccidOld,
		true,
		simDetails2,
		sixMinAgo,
	)
	//put not existing data in DB
	await putSimDetails(db, outputs.cacheTableName)(iccidNotExisting, false)
}
