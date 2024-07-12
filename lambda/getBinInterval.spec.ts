import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { getBinInterval } from './getBinInterval.js'
import type { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'

void describe('getBinInterval', () => {
	void it('should get bin interval from db', async () => {
		const binIntervalMinutes = 60
		const durationHours = 1
		const tsSend = mock.fn(async () =>
			Promise.resolve({
				$metadata: {
					httpStatusCode: 200,
					requestId: 'GMO2HKNCDBF6LN627BEESASSDA',
					attempts: 1,
					totalRetryDelay: 0,
				},
				ColumnInfo: [
					{ Name: 'ICCID', Type: { ScalarType: 'VARCHAR' } },
					{ Name: 'ID', Type: { ScalarType: 'VARCHAR' } },
					{ Name: 'measure_name', Type: { ScalarType: 'VARCHAR' } },
					{ Name: 'time', Type: { ScalarType: 'TIMESTAMP' } },
					{ Name: 'measure_value::double', Type: { ScalarType: 'DOUBLE' } },
				],
				QueryId:
					'AEDQCANVV6IC7KASP5JAYKRGZIWR7JM3WD3N3HX7S3TVL5IU4SH3WVFU3RY46ZI',
				QueryStatus: {
					CumulativeBytesMetered: 0,
					CumulativeBytesScanned: 760,
					ProgressPercentage: 100,
				},
				Rows: [
					{
						Data: [
							{ ScalarValue: '89444612812874751710' },
							{ ScalarValue: '9b3e92e90836e08aad8ea4f408dae6006e817506' },
							{ ScalarValue: 'UsedBytes' },
							{ ScalarValue: '2024-07-15 12:40:38.204000000' },
							{ ScalarValue: '0.0' },
						],
					},
					{
						Data: [
							{ ScalarValue: '89444612812874751710' },
							{ ScalarValue: '4a4d299cffa7c4096f1577881a340cc32f264c12' },
							{ ScalarValue: 'UsedBytes' },
							{ ScalarValue: '2024-07-15 12:05:58.547000000' },
							{ ScalarValue: '0.0' },
						],
					},
				],
			}),
		)
		const ts: TimestreamQueryClient = {
			send: tsSend,
		} as any
		const binInterval = await getBinInterval(
			ts,
			'dbName',
			'tableName',
		)({
			binIntervalMinutes,
			durationHours,
			iccid: '89444612812874751710',
		})
		const expectedRes = {
			result: [
				{
					ICCID: '89444612812874751710',
					ID: '9b3e92e90836e08aad8ea4f408dae6006e817506',
					measure_name: 'UsedBytes',
					time: new Date('2024-07-15T12:40:38.204Z'),
					'measure_value::double': 0,
				},
				{
					ICCID: '89444612812874751710',
					ID: '4a4d299cffa7c4096f1577881a340cc32f264c12',
					measure_name: 'UsedBytes',
					time: new Date('2024-07-15T12:05:58.547Z'),
					'measure_value::double': 0,
				},
			],
		}
		assert.deepEqual(binInterval, expectedRes.result)
	})
})
