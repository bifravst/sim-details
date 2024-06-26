import type { SimDetails } from '../getSimDetailsFromCache.js'
import type { SimInfoType } from './fetchOnomondoSimDetails.js'

export const getUsageData = (apiData: SimInfoType): SimDetails => {
	return {
		usedBytes: apiData.data_limit.used,
		totalBytes: apiData.data_limit.total,
	}
}
