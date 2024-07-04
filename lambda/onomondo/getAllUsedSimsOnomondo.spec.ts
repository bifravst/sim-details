import testData from './testData/Onomondo-AllSims.json'
import testData2 from './testData/Onomondo-AllSims2.json'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import nock from 'nock'
import { getAllUsedSimsOnomondo } from './getAllUsedSimsOnomondo.js'

void describe('getAllICCIDFromOnomondo', () => {
	void it('should return the iccids from all SIMs', async () => {
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
		const expectedResult = [
			'89457387300000022734',
			'89457387300000022735',
			'89457387300000022736',
			'89457387300000022737',
			'89457387300000022738',
			'89457387300000022739',
		]
		const res = await getAllUsedSimsOnomondo('apiKey')
		assert.equal(scope.isDone(), true)
		assert.equal('error' in res, false)
		assert.deepEqual(res, expectedResult)
		assert.equal(nock.isDone(), true)
	})
})
