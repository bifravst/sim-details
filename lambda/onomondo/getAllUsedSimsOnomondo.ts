import { Type, type Static } from '@sinclair/typebox'
import { fetchAndValidate } from '../fetchAndValidate.js'

export const getAllUsedSimsOnomondo = async (
	apiKey: string,
): Promise<Array<string>> => {
	const iccids: Array<string> = []
	const filter = `time:${new Date().toISOString().slice(0, 10)}`
	const endpoint = 'https://api.onomondo.com/'
	let hasMore = true
	const searchParam: { next_page?: string; filter: string } = { filter }
	while (hasMore) {
		const apiRes = await fetchAndValidate({
			schema: AllSimInfo,
			url: new URL(
				`usage?${new URLSearchParams(searchParam).toString()}`,
				endpoint,
			),
			apiKey,
		})
		if ('value' in apiRes) {
			searchParam.next_page = apiRes.value.pagination.next_page
			hasMore = apiRes.value.pagination.has_more
			for (const sim of apiRes.value.usage) {
				if (!iccids.includes(sim.iccid)) {
					iccids.push(sim.iccid)
				}
			}
		}
	}
	return iccids
}
export const AllSimInfo = Type.Object({
	pagination: Type.Object({
		has_more: Type.Boolean(),
		next_page: Type.Optional(Type.String()),
	}),
	usage: Type.Array(
		Type.Object({ iccid: Type.String({ minLength: 18, maxLength: 22 }) }),
	),
})

export type AllSimInfoType = Static<typeof AllSimInfo>
