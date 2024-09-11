import { type _Record } from '@aws-sdk/client-timestream-write'
import type { SIMUsageHistory } from './onomondo/getAllUsedSimsOnomondo.js'
import { usageToRecord } from './usageToRecord.js'

export const getNewRecords = (
	iccid: string,
	historyTs: Date,
	dataUsage: SIMUsageHistory,
): _Record[] => {
	const records: _Record[] = []
	if (dataUsage[iccid] === undefined) return records
	for (const entry of dataUsage[iccid]) {
		//only push to timestream if entry is newer than the history
		if (entry.ts <= historyTs) {
			continue
		}
		const record = usageToRecord({
			iccid,
			diff: entry.usedBytes,
			currentTime: entry.ts,
			id: entry.billId,
		})
		if ('error' in record) {
			continue
		}
		records.push(record.record)
	}
	return records
}
