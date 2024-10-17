import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getDataUsagePerTimespan } from './getDataUsagePerTimespan.js'

void describe('getDataUsagePerTimespan()', () => {
	void it('should calculate the dataUsagePerTimespan and return first day of measurements', async () => {
		const expectedRes = {
			lastHour: 75,
			lastDay: 75,
			lastWeek: 75,
			lastMonth: 75,
		}
		const getUsage = getDataUsagePerTimespan({
			getBinInterval: async () =>
				Promise.resolve([
					{
						ICCID: '89444612812874751710',
						ID: '4a4d299cffa7c4096f1577881a340cc32f264c12',
						measure_name: 'UsedBytes',
						time: new Date('2024-07-15T12:05:58.547Z'),
						'measure_value::double': 25,
					},
					{
						ICCID: '89444612812874751710',
						ID: '9b3e92e90836e08aad8ea4f408dae6006e817506',
						measure_name: 'UsedBytes',
						time: new Date('2024-07-15T12:40:38.204Z'),
						'measure_value::double': 50,
					},
				]),
		})
		const iccid = '89444612812874751710'
		const res = await getUsage(iccid)
		assert.deepEqual(res, expectedRes)
	})
})
