export type usageData = {
	pagination: {
		next_page: string
		has_more: boolean
	}
	usage: {
		time: string
		bill_id: string
		sim_id: string
		iccid: string
		session_id: string
		bytes: number
		country_code: string
		network_type: string
		network: {
			mcc: string
			mnc: string
		}
	}[]
}

export const getDailyUsage = (usageData: usageData): Record<string, number> => {
	const dailyUsage: Record<string, number> = {}
	for (const usage of usageData.usage) {
		const date = usage.time.slice(0, 10)
		if (dailyUsage[date] === undefined) {
			dailyUsage[date] = 0
		}
		dailyUsage[date] += usage.bytes
	}
	return dailyUsage
}
