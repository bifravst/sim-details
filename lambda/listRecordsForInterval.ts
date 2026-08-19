import {
	QueryCommand,
	type TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import { parseResult } from '@bifravst/timestream-helpers'
import { getQueryString } from './getQueryString.ts'
import type { HistoricalDataTimeSpan } from './historicalDataTimeSpans.ts'

type historyRecordReturnType = {
	ICCID: string
	ID: string
	measure_name: string
	time: Date
	'measure_value::double': number
}

export const listRecordsForInterval =
	(ts: TimestreamQueryClient, dbName: string, tableName: string) =>
	async ({
		timespan: { binIntervalMinutes, durationHours },
		iccid,
		availableColumns,
	}: {
		timespan: Pick<
			HistoricalDataTimeSpan,
			'binIntervalMinutes' | 'durationHours'
		>
		iccid: string
		availableColumns: string[]
	}): Promise<{ value: historyRecordReturnType[] } | { error: Error }> => {
		const columnsForQuery = [
			'ICCID',
			'measure_name',
			'time',
			'measure_value::double',
		]
		const availableCols = columnsForQuery.filter((column) =>
			availableColumns.includes(column),
		)
		if (columnsForQuery.length !== availableCols.length) {
			return { error: new Error('Columns not available') }
		}
		const QueryString = getQueryString({
			timespan: { binIntervalMinutes, durationHours },
			iccid,
			dbName,
			tableName,
		})
		let result
		try {
			result = await ts.send(
				new QueryCommand({
					QueryString,
				}),
			)
		} catch {
			return { error: new Error('Error querying data') }
		}
		return { value: parseResult(result) }
	}
