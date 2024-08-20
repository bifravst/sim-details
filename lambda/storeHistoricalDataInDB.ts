import {
	type TimestreamWriteClient,
	type _Record,
	WriteRecordsCommand,
} from '@aws-sdk/client-timestream-write'
import { chunkArray } from './chunkArray.js'

export const storeHistoricalDataInDB =
	({
		tsw,
		dbName,
		tableName,
	}: {
		tsw: TimestreamWriteClient
		dbName: string
		tableName: string
	}) =>
	async (
		records: _Record[],
	): Promise<{ success: boolean } | { error: Error }> => {
		const recordsToTimestream = chunkArray({
			array: records,
			chunkSize: 100,
		})
		for (const rec of recordsToTimestream) {
			if (rec.length == 0) {
				continue
			} else {
				try {
					await tsw.send(
						new WriteRecordsCommand({
							DatabaseName: dbName,
							TableName: tableName,
							Records: rec,
						}),
					)
				} catch (err) {
					return { error: err as Error }
				}
			}
		}
		return { success: true }
	}
