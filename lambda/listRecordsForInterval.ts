import {
	QueryCommand,
	ValidationException,
	type QueryCommandOutput,
	type TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import { parseResult } from '@bifravst/timestream-helpers'
import { getQueryString } from './getQueryString.js'
import type { HistoricalDataTimeSpan } from './historicalDataTimeSpans.js'

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
	}: {
		timespan: Pick<
			HistoricalDataTimeSpan,
			'binIntervalMinutes' | 'durationHours'
		>
		iccid: string
	}): Promise<historyRecordReturnType[] | null> => {
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
		} catch (err) {
			if (err instanceof ValidationException) {
				return null
			}
		}
		return parseResult(result as QueryCommandOutput)
	}
