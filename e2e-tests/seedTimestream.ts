import { WriteRecordsCommand } from '@aws-sdk/client-timestream-write'
import { usageToRecord } from '../lambda/usageToRecord.js'
import {
	type _Record,
	type TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'

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
		const isNotNull = (value: _Record | null) => value != null
		const filteredRec = records.filter(isNotNull)
		await tsw.send(
			new WriteRecordsCommand({
				DatabaseName: dbName,
				TableName: tableName,
				Records: filteredRec,
			}),
		)
	}
