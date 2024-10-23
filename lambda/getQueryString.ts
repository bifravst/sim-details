import type { HistoricalDataTimeSpan } from './historicalDataTimeSpans.js'

export const getQueryString = ({
	timespan: { binIntervalMinutes, durationHours },
	iccid,
	dbName,
	tableName,
}: {
	timespan: Pick<HistoricalDataTimeSpan, 'binIntervalMinutes' | 'durationHours'>
	iccid: string
	dbName: string
	tableName: string
}): string =>
	[
		`SELECT *`,
		`FROM "${dbName}"."${tableName}"`,
		`WHERE measure_name = 'UsedBytes'`,
		`AND ICCID = '${iccid}'`,
		`AND time > date_add('hour', -${durationHours}, now())`,
		`ORDER BY bin(time, ${binIntervalMinutes}m) ASC`,
	].join(' ')
