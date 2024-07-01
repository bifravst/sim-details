import type { SimDetails } from '../getSimDetailsFromCache.js'
import type { SimInfoType } from './fetchOnomondoSimDetails.js'

export const getUsageData = (apiData: SimInfoType): SimDetails => {
	return {
		usedBytes: apiData.data_limit.used ?? 0,
		totalBytes: apiData.data_limit.total,
	}
}
