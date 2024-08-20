import { fetchAndValidate } from '../fetchAndValidate.js'
import { Type, type Static } from '@sinclair/typebox'

export type simInfoTS = {
	usedBytes: number
	billId: string
}

export const getSimUsageHistoryOnomondo = async ({
	apiKey,
	iccid,
	date,
}: {
	apiKey: string
	iccid?: string
	date?: Date
}): Promise<Record<string, Record<string, simInfoTS>>> => {
	const res: Record<string, Record<string, simInfoTS>> = {}
	const filter = `time:${(date ?? new Date()).toISOString().slice(0, 10)}`
	const endpoint = 'https://api.onomondo.com/'
	let hasMore = true
	const searchParam: { next_page?: string; filter: string } = { filter }
	let string = ''
	if (iccid !== undefined) {
		string = `/${iccid}`
	}
	while (hasMore) {
		const apiRes = await fetchAndValidate({
			schema: AllSimInfo,
			url: new URL(
				`usage${string}?${new URLSearchParams(searchParam).toString()}`,
				endpoint,
			),
			apiKey,
		})
		if ('value' in apiRes) {
			searchParam.next_page = apiRes.value.pagination.next_page
			hasMore = apiRes.value.pagination.has_more
			for (const usageChunk of apiRes.value.usage) {
				const dateString = `${usageChunk.time.replace(' ', 'T')}.000Z`
				res[usageChunk.iccid] = {
					...res[usageChunk.iccid],
					[dateString]: {
						usedBytes: usageChunk.bytes,
						billId: usageChunk.bill_id,
					},
				}
			}
		} else {
			hasMore = false
		}
	}
	return res
}

export const AllSimInfo = Type.Object({
	pagination: Type.Object({
		has_more: Type.Boolean(),
		next_page: Type.Optional(Type.String()),
	}),
	usage: Type.Array(
		Type.Object({
			iccid: Type.String({ minLength: 18, maxLength: 22 }),
			time: Type.String({ minLength: 19 }),
			bytes: Type.Number(),
			bill_id: Type.String(),
		}),
	),
})

export type AllSimInfoType = Static<typeof AllSimInfo>
