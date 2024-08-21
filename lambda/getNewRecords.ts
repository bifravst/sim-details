import type { simInfoTS } from './onomondo/getAllUsedSimsOnomondo.js'
import { usageToRecord } from './usageToRecord.js'
import { type _Record } from '@aws-sdk/client-timestream-write'

export const getNewRecords = (
	iccid: string,
	historyTs: Date,
	dataUsage: Record<string, Record<string, simInfoTS>>,
): _Record[] => {
	const records = []
	if (dataUsage[iccid] !== undefined) {
		const entries = Object.entries(dataUsage[iccid])
		for (const entry of entries) {
			//only push to timestream if entry is newer than the history
			if (new Date(entry[0]) <= new Date(historyTs)) {
				continue
			}
			records.push(
				usageToRecord({
					iccid,
					diff: entry[1].usedBytes,
					currentTime: new Date(entry[0]),
					id: entry[1].billId,
				}).record,
			)
		}
	}
	return records
}
