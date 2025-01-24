import {
	WriteRecordsCommand,
	type _Record,
	type TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'
import { usageToRecord } from '../../lambda/usageToRecord.ts'

const isNotNull = (value: _Record | null) => value != null

export type Usage = Array<{ ts: Date; usedBytes: number }>

export const seedTimestream =
	({
		tsw,
		dbName,
		tableName,
	}: {
		tsw: TimestreamWriteClient
		dbName: string
		tableName: string
	}) =>
	async ({ usage, iccid }: { usage: Usage; iccid: string }): Promise<void> => {
		const records = usage.map((usage) => {
			const record = usageToRecord({
				iccid,
				diff: usage.usedBytes ?? 0,
				currentTime: usage.ts,
			})
			if ('record' in record) {
				return record.record
			}
			return null
		})
		const filteredRec = records.filter(isNotNull)
		try {
			await tsw.send(
				new WriteRecordsCommand({
					DatabaseName: dbName,
					TableName: tableName,
					Records: filteredRec,
				}),
			)
		} catch (err) {
			console.log('error', err)
		}
	}
