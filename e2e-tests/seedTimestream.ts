import {
	WriteRecordsCommand,
	type _Record,
	type TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'
import { usageToRecord } from '../lambda/usageToRecord.js'

const isNotNull = (value: _Record | null) => value != null

export const seedTimestream =
	(tsw: TimestreamWriteClient) =>
	async (
		timestamps: Array<Date>,
		values: Array<number>,
		iccid: string,
		dbName: string,
		tableName: string,
	): Promise<void> => {
		const records = timestamps.map((timestamp, index) => {
			const record = usageToRecord({
				iccid,
				diff: values[index] ?? 0,
				currentTime: timestamp,
			})
			if ('record' in record) {
				return record.record
			}
			return null
		})
		const filteredRec = records.filter(isNotNull)
		await tsw.send(
			new WriteRecordsCommand({
				DatabaseName: dbName,
				TableName: tableName,
				Records: filteredRec,
			}),
		)
	}
