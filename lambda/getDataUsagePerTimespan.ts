import { HistoricalDataTimeSpans } from './historicalDataTimeSpans.js'

export const getDataUsagePerTimespan =
	({
		getBinInterval,
	}: {
		getBinInterval: ({
			binIntervalMinutes,
			durationHours,
			iccid,
		}: {
			binIntervalMinutes: number
			durationHours: number
			iccid: string
		}) => Promise<Record<string, unknown>[]>
	}) =>
	async (iccid: string): Promise<Record<string, number>> => {
		const timespans = Object.keys(HistoricalDataTimeSpans)
		const dataUsagePerTimespan: Record<string, number> = {}
		for (const timespan of timespans) {
			const history = await getBinInterval({
				binIntervalMinutes:
					HistoricalDataTimeSpans[timespan]!.binIntervalMinutes,
				durationHours: HistoricalDataTimeSpans[timespan]!.durationHours,
				iccid,
			})
			let sum = 0
			for (const h of history) {
				sum += h['measure_value::double'] as number
			}
			dataUsagePerTimespan[timespan] = sum
		}
		return dataUsagePerTimespan
	}
