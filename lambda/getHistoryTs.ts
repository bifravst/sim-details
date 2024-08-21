import type {
	SimDetails,
	SIMNotExistingError,
	SIMNotFoundError,
} from './getSimDetailsFromCache.js'
import type { simInfoTS } from './onomondo/getAllUsedSimsOnomondo.js'

export const getHistoryTs =
	({
		getSimDetailsFromCache,
	}: {
		getSimDetailsFromCache: (iccid: string) => Promise<
			| {
					error: SIMNotFoundError | SIMNotExistingError
			  }
			| {
					sim: SimDetails & {
						ts: Date
					}
					historyTs?: Date
			  }
		>
	}) =>
	async (
		iccid: string,
		dataUsage: Record<string, Record<string, simInfoTS>>,
	): Promise<{ oldHistoryTs: Date; newHistoryTs: Date }> => {
		const cacheInfo = await getSimDetailsFromCache(iccid)
		let oldHistoryTs: Date
		if ('error' in cacheInfo) {
			//If error fetch the last day
			oldHistoryTs = new Date(Date.now() - 60 * 1000 * 60 * 24)
		} else {
			oldHistoryTs = cacheInfo.historyTs as Date
		}
		let newHistoryTs = oldHistoryTs
		if (dataUsage[iccid] !== undefined) {
			const entries = Object.entries(dataUsage[iccid])
			const lastEntry = entries[entries.length - 1]
			newHistoryTs = lastEntry ? new Date(lastEntry[0]) : oldHistoryTs
		}
		return { oldHistoryTs, newHistoryTs }
	}
