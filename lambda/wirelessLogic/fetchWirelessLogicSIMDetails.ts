import {
	validateWithTypeBox,
	formatTypeBoxErrors,
} from '@hello.nrfcloud.com/proto'
import { Type } from '@sinclair/typebox'

export type SimDetailsWL = {
	usedBytes: Record<string, number>
	totalBytes: number
}

export const fetchWirelessLogicSIMDetails = async ({
	iccid,
	apiKey,
	clientId,
	wirelessLogicDataLimit,
	startMonth,
	numberOfMonths,
}: {
	iccid: string | string[]
	apiKey: string
	clientId: string
	wirelessLogicDataLimit: number
	startMonth?: number
	numberOfMonths?: number
}): Promise<{ value: SimDetailsWL } | { error: Error }> => {
	const wirelessLogicURL = 'https://simpro4.wirelesslogic.com/api/v3/'
	const usage: Record<string, number> = {}
	const currentMonth = new Date().getMonth() + 1
	//api provides history for the last 3 months
	for (
		let month = startMonth ?? currentMonth - 4;
		month <= (numberOfMonths ?? currentMonth);
		month++
	) {
		const searchParam = {
			month: String(month),
			identifiers: Array.isArray(iccid) ? iccid.toString() : iccid,
		}
		const url = new URL(
			`sims/usage-history?${new URLSearchParams(searchParam).toString()}`,
			wirelessLogicURL,
		)
		const response = await fetch(url, {
			headers: { 'x-api-client': clientId, 'x-api-key': apiKey },
		})
		const res = await response.json()
		const maybeValidatedData = validateWithTypeBox(SimInfoWirelessLogic)(res)
		if ('errors' in maybeValidatedData) {
			return {
				error: new Error(formatTypeBoxErrors(maybeValidatedData.errors)),
			}
		}
		const simData = maybeValidatedData.value.sims
		for (const sim of simData) {
			usage[sim.iccid] =
				(usage[sim.iccid] ?? 0) +
				Number(sim.month_to_date_bytes_up) +
				Number(sim.month_to_date_bytes_down)
		}
	}
	return { value: { usedBytes: usage, totalBytes: wirelessLogicDataLimit } }
}
const SimInfoWirelessLogic = Type.Object({
	sims: Type.Array(
		Type.Optional(
			Type.Object({
				month_to_date_bytes_up: Type.String({ minLength: 1, examples: '0' }),
				month_to_date_bytes_down: Type.String({
					minLength: 1,
					examples: '100000',
				}),
				iccid: Type.String({ minLength: 18, maxLength: 22 }),
			}),
		),
	),
})
