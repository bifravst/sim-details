import {
	WriteRecordsCommand,
	type _Record,
} from '@aws-sdk/client-timestream-write'
import { usageToRecord } from '../lambda/usageToRecord.js'
import { tsw } from './e2eTest.spec.js'

export const seedTimestream = async (
	timestamps: Array<Date>,
	values: Array<number>,
	iccid: string,
	dbName: string,
	tableName: string,
): Promise<void> => {
	const records = [] as _Record[]
	timestamps.forEach((timestamp, index) => {
		records.push(
			usageToRecord({ iccid, diff: values[index] ?? 0, currentTime: timestamp })
				.record,
		)
	})
	await tsw.send(
		new WriteRecordsCommand({
			DatabaseName: dbName,
			TableName: tableName,
			Records: records,
		}),
	)
}
