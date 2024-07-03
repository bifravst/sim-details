import { putSimDetails } from '../lambda/putSimDetails.js'
import { db, outputs } from './e2eTest.spec.js'

export const seedingDBFunction = async ({
	iccidNew,
	iccidOld,
	now,
	sixMinAgo,
}: {
	iccidNew: string
	iccidOld: string
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
	const simDetails3 = {
		usedBytes: 25,
		totalBytes: 1000,
	}
	//put recent data on DB
	await putSimDetails(db, outputs.cacheTableName)(
		iccidNew,
		true,
		simDetails,
		now,
	)
	//put 10 min old data in DB for iccidOld
	await putSimDetails(db, outputs.cacheTableName)(
		iccidOld,
		true,
		simDetails3,
		new Date(Date.now() - 10 * 60 * 1000),
	)
	//put 6 min old data in DB for iccidOld
	await putSimDetails(db, outputs.cacheTableName)(
		iccidOld,
		true,
		simDetails2,
		sixMinAgo,
	)
}
