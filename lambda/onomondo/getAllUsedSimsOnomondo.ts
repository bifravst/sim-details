import { Type, type Static } from '@sinclair/typebox'
import { fetchAndValidate } from '../fetchAndValidate.js'

export type SIMUsage = {
	ts: Date
	usedBytes: number
	billId: string
}

export type SIMUsageHistory = Record<string, Array<SIMUsage>>

export const getSimUsageHistoryOnomondo = async ({
	apiKey,
	iccid,
	date,
}: {
	apiKey: string
	iccid?: string
	date?: Date
}): Promise<SIMUsageHistory | { error: Error }> => {
	const res = await fetchAllPaginatedData({ apiKey, iccid, date })
	if ('value' in res) {
		return res.value
	}
	return { error: new Error('ERROR') }
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

export const fetchAllPaginatedData = async ({
	apiKey,
	iccid,
	date,
	next_page,
}: {
	apiKey: string
	iccid?: string
	date?: Date
	next_page?: string
}): Promise<{ value: SIMUsageHistory } | { error: Error }> => {
	try {
		let localRes: SIMUsageHistory = {}
		const filter = `time:${(date ?? new Date()).toISOString().slice(0, 10)}`
		const endpoint = 'https://api.onomondo.com/'
		const param = next_page == undefined ? { filter } : { next_page, filter }
		const searchParam: { next_page?: string; filter: string } = param
		let string = ''
		if (iccid !== undefined) {
			string = `/${iccid}`
		}
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
			const hasMore = apiRes.value.pagination.has_more
			for (const usageChunk of apiRes.value.usage) {
				const dateString = `${usageChunk.time.replace(' ', 'T')}.000Z`
				if (localRes[usageChunk.iccid] === undefined)
					localRes[usageChunk.iccid] = []
				localRes[usageChunk.iccid]!.push({
					usedBytes: usageChunk.bytes,
					billId: usageChunk.bill_id,
					ts: new Date(dateString),
				})
			}
			if (hasMore) {
				const funcRes = await fetchAllPaginatedData({
					iccid,
					apiKey,
					next_page: searchParam.next_page,
				})
				if ('value' in funcRes) {
					localRes = { ...localRes, ...funcRes.value }
				}
			}
		}
		return { value: localRes }
	} catch {
		return { error: new Error('ERROR') }
	}
}
