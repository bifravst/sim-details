import type { TimestreamQueryClient } from '@aws-sdk/client-timestream-query'
import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { getBinInterval } from './getBinInterval.js'

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
					{ Name: 'binTime', Type: { ScalarType: 'TIMESTAMP' } },
					{ Name: 'usage', Type: { ScalarType: 'DOUBLE' } },
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
							{ ScalarValue: '2024-07-15 12:40:38.204000000' },
							{ ScalarValue: '0.0' },
						],
					},
					{
						Data: [
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
					binTime: new Date('2024-07-15T12:40:38.204Z'),
					usage: 0,
				},
				{
					binTime: new Date('2024-07-15T12:05:58.547Z'),
					usage: 0,
				},
			],
		}
		assert.deepEqual(binInterval, expectedRes.result)
	})
})
