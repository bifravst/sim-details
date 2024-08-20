import type {
	SimDetails,
	SIMNotExistingError,
	SIMNotFoundError,
} from './getSimDetailsFromCache.js'
import type { simInfoTS } from './onomondo/getAllUsedSimsOnomondo.js'
import { usageToRecord } from './usageToRecord.js'
import {
	type _Record,
	RejectedRecordsException,
} from '@aws-sdk/client-timestream-write'
export const storeUsageInTimestream =
	({
		getSimDetailsFromCache,
		storeHistoricalData,
	}: {
		getSimDetailsFromCache: (iccid: string) => Promise<
			| {
					error: SIMNotFoundError | SIMNotExistingError
			  }
			| {
					sim: SimDetails & {
						ts: Date
					}
					historyTs?: string
			  }
		>
		storeHistoricalData: (
			records: _Record[],
		) => Promise<{ success: boolean } | { error: Error }>
	}) =>
	async (
		iccid: string,
		dataUsage: Record<string, Record<string, simInfoTS>>,
	): Promise<string> => {
		const cacheInfo = await getSimDetailsFromCache(iccid)
		let historyTs: string
		if ('error' in cacheInfo) {
			//If error fetch the last day
			historyTs = new Date(Date.now() - 60 * 1000 * 60 * 24).toISOString()
		} else {
			historyTs = cacheInfo.historyTs as string
		}
		// date of last entry in timestream
		let newHistoryTs = historyTs
		if (dataUsage[iccid] !== undefined) {
			const entries = Object.entries(dataUsage[iccid])
			const records = []
			for (const entry of entries) {
				newHistoryTs = entry[0]
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
			const historicalDataStoring = await storeHistoricalData(records)
			if ('error' in historicalDataStoring) {
				newHistoryTs = historyTs
				if (historicalDataStoring.error instanceof RejectedRecordsException) {
					console.error(
						`Rejected records`,
						JSON.stringify(historicalDataStoring.error.RejectedRecords),
					)
				} else {
					console.error(historicalDataStoring.error)
				}
			}
		}
		return newHistoryTs
	}
