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
		const oldHistoryTs =
			'error' in cacheInfo
				? new Date(Date.now() - 60 * 1000 * 60 * 24)
				: (cacheInfo.historyTs as Date)
		const newHistoryTs = dataUsage[iccid]
			? new Date(Object.entries(dataUsage[iccid]).pop()?.[0] as string)
			: oldHistoryTs
		return { oldHistoryTs, newHistoryTs }
	}
