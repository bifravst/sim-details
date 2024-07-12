import { describe, it, mock } from 'node:test'
import { check, objectMatching } from 'tsmatchers'
import { storeHistoricalDataInDB } from './storeHistoricalDataInDB.js'
import type {
	_Record,
	TimestreamWriteClient,
} from '@aws-sdk/client-timestream-write'

void describe('storeHistoricalDataInDB', () => {
	void it('should send the correct Record to Timestream', async () => {
		const tsSend = mock.fn(async () => Promise.resolve())
		const ts: TimestreamWriteClient = {
			send: tsSend,
		} as any
		const record = {
			Dimensions: [
				{
					Name: 'ICCID',
					Value: '',
				},
				{
					Name: 'ID',
					Value: '049f11c1895feb4a6ff42770c0fe78e559aab765',
				},
			],
			MeasureName: 'UsedBytes',
			MeasureValue: '50',
			MeasureValueType: 'DOUBLE',
			Time: '1721043381108',
			TimeUnit: 'MILLISECONDS',
		}
		await storeHistoricalDataInDB({
			tsw: ts,
			dbName: 'dbName',
			tableName: 'tableName',
		})([record] as _Record[])
		check((tsSend.mock.calls[0]?.arguments as unknown[])[0]).is(
			objectMatching({
				input: {
					DatabaseName: 'dbName',
					TableName: 'tableName',
					Records: [
						{
							Dimensions: [
								{
									Name: 'ICCID',
									Value: '',
								},
								{
									Name: 'ID',
									Value: '049f11c1895feb4a6ff42770c0fe78e559aab765',
								},
							],
							MeasureName: 'UsedBytes',
							MeasureValue: '50',
							MeasureValueType: 'DOUBLE',
							Time: '1721043381108',
							TimeUnit: 'MILLISECONDS',
						},
					],
				},
			}),
		)
	})
})
