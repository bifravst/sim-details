import { Type, type Static } from '@sinclair/typebox'
import { fetchAndValidate } from '../fetchAndValidate.js'
import type { SimDetails } from '../getSimDetailsFromCache.js'
import { getUsageData } from './getUsageData.js'

export const fetchOnomondoSIMDetails = async ({
	iccid,
	apiKey,
}: {
	iccid: string
	apiKey: string
}): Promise<{ value: SimDetails } | { error: Error }> => {
	const onomondoURL = 'https://api.onomondo.com/sims'
	const url = new URL(`${onomondoURL}/${iccid}`)
	const res = await fetchAndValidate({
		schema: SimInfo,
		url,
		apiKey,
	})
	if ('value' in res) {
		return { value: getUsageData(res.value) }
	}
	return {
		error: new Error(
			'Data fetching and validation of Onomondo SIM data failed',
		),
	}
}

export const SimInfo = Type.Object({
	data_limit: Type.Object({
		used: Type.Union([
			Type.Number({ minimum: 0, examples: [0, 100, 1000] }),
			Type.Null(),
		]),
		total: Type.Number({ examples: [4000, 40000, 400000] }),
	}),
})

export type SimInfoType = Static<typeof SimInfo>
