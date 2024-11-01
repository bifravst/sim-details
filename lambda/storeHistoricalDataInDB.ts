import {
	type TimestreamWriteClient,
	type _Record,
	RejectedRecordsException,
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
	): Promise<
		| { success: boolean }
		| { error: Error; numberOfErrors: number; numberOfRejectedRecords: number }
	> => {
		const recordsToTimestream = chunkArray({
			array: records,
			chunkSize: 100,
		})
		let numberOfErrors = 0
		let numberOfRejectedRecords = 0
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
					if (err instanceof RejectedRecordsException) {
						numberOfRejectedRecords += 1
					} else {
						numberOfErrors += 1
					}
					console.error('Error when writing record:', err)
				}
			}
		}
		if (numberOfErrors > 0) {
			return {
				error: new Error('Error when writing records'),
				numberOfErrors,
				numberOfRejectedRecords,
			}
		}
		return { success: true }
	}
