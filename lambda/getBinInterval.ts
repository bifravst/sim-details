import {
	QueryCommand,
	type TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import { parseResult } from '@bifravst/timestream-helpers'

export const getBinInterval =
	(ts: TimestreamQueryClient, dbName: string, tableName: string) =>
	async ({
		binIntervalMinutes,
		durationHours,
		iccid,
	}: {
		binIntervalMinutes: number
		durationHours: number
		iccid: string
	}): Promise<Record<string, unknown>[]> => {
		const QueryString = [
			`SELECT SUM(measure_value::double) as usage, (bin(time,${binIntervalMinutes}m)) AS binTime`,
			`FROM "${dbName}"."${tableName}"`,
			`WHERE measure_name = 'UsedBytes'`,
			`AND ICCID = '${iccid}'`,
			`AND time > date_add('hour', -${durationHours}, now())`,
			`GROUP BY bin(time, ${binIntervalMinutes}m)`,
			`ORDER BY bin(time, ${binIntervalMinutes}m) ASC`,
		].join(' ')
		const result = await ts.send(
			new QueryCommand({
				QueryString,
			}),
		)
		return parseResult(result)
	}
