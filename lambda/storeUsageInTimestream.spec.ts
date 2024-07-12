import { describe, it } from 'node:test'
import { storeUsageInTimestream } from './storeUsageInTimestream.js'
import assert from 'node:assert'

void describe('storeUsageInTimestream()', () => {
	void it('should return the timestamp from cache if no newer data usage', async () => {
		const iccid = '89457387300000022734'
		const dataUsage = {
			'89457387300000022734': {
				'2020-02-03T07:49:13.000Z': {
					usedBytes: 1424843,
					billId: '7c5f95c7-c0ff-352e-93e2-5370a6d37b42',
				},
				/*'2020-02-03T08:04:14.000Z': {
					usedBytes: 1103,
					billId: '0538f940-b382-339c-b2a3-19c788c385f6',
				},*/
			},
		}
		const storeTimestream = storeUsageInTimestream({
			getSimDetailsFromCache: async () =>
				Promise.resolve({
					sim: {
						usedBytes: 1,
						totalBytes: 2,
						ts: new Date('2020-02-03T07:49:14.000Z'),
					},
					historyTs: '2020-02-03T07:49:13.000Z',
				}),
			storeHistoricalData: async () => Promise.resolve({ success: true }),
		})
		const res = await storeTimestream(iccid, dataUsage)
		assert.equal(res, '2020-02-03T07:49:13.000Z')
	})
	void it('should return the timestamp of the newest usage from dataUsage', async () => {
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
		const storeTimestream = storeUsageInTimestream({
			getSimDetailsFromCache: async () =>
				Promise.resolve({
					sim: {
						usedBytes: 1,
						totalBytes: 2,
						ts: new Date('2020-02-03T07:49:14.000Z'),
					},
					historyTs: '2020-02-03T07:49:13.000Z',
				}),
			storeHistoricalData: async () => Promise.resolve({ success: true }),
		})
		const res = await storeTimestream(iccid, dataUsage)
		assert.equal(res, '2020-02-03T08:04:14.000Z')
	})
	void it('should return correct timestamp if data storing fails', async () => {
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
		const storeTimestream = storeUsageInTimestream({
			getSimDetailsFromCache: async () =>
				Promise.resolve({
					sim: {
						usedBytes: 1,
						totalBytes: 2,
						ts: new Date('2020-02-03T07:49:14.000Z'),
					},
					historyTs: '2020-02-03T07:49:13.000Z',
				}),
			storeHistoricalData: async () =>
				Promise.resolve({ error: new Error('Failed') }),
		})
		const res = await storeTimestream(iccid, dataUsage)
		//What is actually the correct ts here? Should we use the 'old' one or the newest?
		const expectedResult = '2020-02-03T07:49:13.000Z'
		assert.equal(res, expectedResult)
	})
})
