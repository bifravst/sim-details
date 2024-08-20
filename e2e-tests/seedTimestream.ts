import { WriteRecordsCommand } from '@aws-sdk/client-timestream-write'
import { usageToRecord } from '../lambda/usageToRecord.js'
import { type TimestreamWriteClient } from '@aws-sdk/client-timestream-write'

export const seedTimestream =
	(tsw: TimestreamWriteClient) =>
	async (
		timestamps: Array<Date>,
		values: Array<number>,
		iccid: string,
		dbName: string,
		tableName: string,
	): Promise<void> => {
		const records = timestamps.map(
			(timestamp, index) =>
				usageToRecord({
					iccid,
					diff: values[index] ?? 0,
					currentTime: timestamp,
				}).record,
		)
		await tsw.send(
			new WriteRecordsCommand({
				DatabaseName: dbName,
				TableName: tableName,
				Records: records,
			}),
		)
	}
