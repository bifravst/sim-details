import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { usageToRecord } from './usageToRecord.js'

void describe('usageToRecord', () => {
	void it('should convert an iccid and a diff in used bytes into a Timestream record', () => {
		const currentTime = new Date('2024-07-15T11:36:21.108Z')
		const iccid = '89444600000000000001'
		const diff = 50
		const record = usageToRecord({
			iccid,
			diff,
			currentTime,
			id: 'id',
			version: 1,
		})
		const expectedRes = {
			record: {
				Dimensions: [
					{
						Name: 'ICCID',
						Value: '89444600000000000001',
					},
					{
						Name: 'ID',
						Value: 'id',
					},
				],
				MeasureName: 'UsedBytes',
				MeasureValue: '50',
				MeasureValueType: 'DOUBLE',
				Time: '1721043381108',
				TimeUnit: 'MILLISECONDS',
				Version: 1,
			},
		}
		console.log('record' in record && record.record)
		console.log('record' in record)
		console.log(record)
		assert.deepEqual(record, expectedRes)
	})
})
