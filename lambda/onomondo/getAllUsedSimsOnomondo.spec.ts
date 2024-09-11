import testData from './testData/Onomondo-AllSims.json'
import testData2 from './testData/Onomondo-AllSims2.json'
import testData3 from './testData/Onomondo-usageExample.json'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import nock from 'nock'
import { getSimUsageHistoryOnomondo } from './getAllUsedSimsOnomondo.js'

void describe('getAllICCIDFromOnomondo', () => {
	void it('should return the iccids and usage from all SIMs', async () => {
		const day = `time:${new Date().toISOString().slice(0, 10)}`.replace(
			':',
			'%3A',
		)
		const scope = nock('https://api.onomondo.com')
		scope.get(`/usage?&filter=${day}`).reply(200, testData)
		scope
			.get(
				`/usage?&next_page=MjAyMi0wMS0yOVQwMDozMDowMC4wMDBaQDAwMDAwODY2MA==&filter=${day}`,
			)
			.reply(200, testData2)
		const expectedResult = {
			'89457387300000022734': [
				{
					usedBytes: 1424843,
					billId: '7c5f95c7-c0ff-352e-93e2-5370a6d37b42',
					ts: new Date('2020-02-03T07:49:13.000Z'),
				},
				{
					usedBytes: 1103,
					billId: '0538f940-b382-339c-b2a3-19c788c385f6',
					ts: new Date('2020-02-03T08:04:14.000Z'),
				},
			],
			'89457387300000022735': [
				{
					usedBytes: 1634,
					billId: '07de7724-7460-3399-b49c-c7e7d51de870',
					ts: new Date('2020-02-03T08:19:13.000Z'),
				},
			],
			'89457387300000022739': [
				{
					usedBytes: 995,
					billId: '9338372a-f574-3812-85f4-f06398dad0d2',
					ts: new Date('2020-02-03T10:14:56.000Z'),
				},
				{
					usedBytes: 10426,
					billId: '7c563fb8-c12b-34c8-9f9e-655a32688ea7',
					ts: new Date('2020-02-04T13:32:32.000Z'),
				},
			],
		}
		const res = await getSimUsageHistoryOnomondo({ apiKey: 'apiKey' })
		assert.equal(scope.isDone(), true)
		assert.equal('error' in res, false)
		assert.deepEqual(res, expectedResult)
		assert.equal(nock.isDone(), true)
	})
	void it('should return the usage from the provided SIM', async () => {
		const day = `time:${new Date().toISOString().slice(0, 10)}`.replace(
			':',
			'%3A',
		)
		const iccid = '89457387300000022734'
		const scope = nock('https://api.onomondo.com')
		scope.get(`/usage/${iccid}?&filter=${day}`).reply(200, testData3)
		const expectedResult = {
			'89457387300000022734': [
				{
					usedBytes: 315,
					billId: '4db28719-18ed-323c-a367-c1498fbd96d5',
					ts: new Date('2020-06-04T06:49:41.000Z'),
				},
				{
					usedBytes: 39194,
					billId: 'b28f15e5-7660-3da8-bcd8-ef1ce13a1664',
					ts: new Date('2020-06-04T06:49:55.000Z'),
				},
				{
					usedBytes: 210076,
					billId: '73a5df37-562e-3a2d-9ba7-a65a9a79ed12',
					ts: new Date('2020-06-04T07:04:56.000Z'),
				},
			],
		}
		const res = await getSimUsageHistoryOnomondo({ apiKey: 'apiKey', iccid })
		assert.equal(scope.isDone(), true)
		assert.equal('error' in res, false)
		assert.deepEqual(res, expectedResult)
		assert.equal(nock.isDone(), true)
	})
})
