import { describe, it } from 'node:test'
import { getHistoryTs } from './getHistoryTs.js'
import assert from 'node:assert'

void describe('getHistoryTs', () => {
	void it('should return the old historyTs from DB and the new historyTs from dataUsage', async () => {
		const getHistoryTsFunc = getHistoryTs({
			getSimDetailsFromCache: async () =>
				Promise.resolve({
					sim: {
						usedBytes: 1,
						totalBytes: 2,
						ts: new Date('2020-02-03T07:49:14.000Z'),
					},
					historyTs: new Date('2020-02-03T07:49:00.000Z'),
				}),
		})
		const iccid = '89457387300000022734'
		const dataUsage = {
			'89457387300000022734': {
				'2020-02-03T07:49:13.000Z': {
					usedBytes: 1424843,
					billId: '7c5f95c7-c0ff-352e-93e2-5370a6d37b42',
				},
				'2020-02-03T08:04:14.000Z': {
					usedBytes: 1103,
					billId: '0538f940-b382-339c-b2a3-19c788c385f6',
				},
			},
		}
		const historyTs = await getHistoryTsFunc(iccid, dataUsage)
		const expectedRes = {
			oldHistoryTs: new Date('2020-02-03T07:49:00.000Z'),
			newHistoryTs: new Date('2020-02-03T08:04:14.000Z'),
		}
		assert.deepEqual(historyTs, expectedRes)
	})
})
