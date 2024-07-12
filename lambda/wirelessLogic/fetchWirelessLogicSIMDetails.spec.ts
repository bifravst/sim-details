import nock from 'nock'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchWirelessLogicSIMDetails } from './fetchWirelessLogicSIMDetails.js'
import activeSimsTestData1 from './testData/activeSimHistory1.json'
import activeSimsTestData2 from './testData/activeSimHistory2.json'
import activeSimsTestData3 from './testData/activeSimHistory3.json'

void describe('getActiveSimsHistory()', () => {
	void it('should return the iccids of the active SIMs', async () => {
		const scope = nock('https://simpro4.wirelesslogic.com')
		scope
			.get(
				'/api/v3/sims/usage-history?month=1&identifiers=89444600000000000001%2C89444600000000000002',
			)
			.reply(200, activeSimsTestData1)
		scope
			.get(
				'/api/v3/sims/usage-history?month=2&identifiers=89444600000000000001%2C89444600000000000002',
			)
			.reply(200, activeSimsTestData2)
		scope
			.get(
				'/api/v3/sims/usage-history?month=3&identifiers=89444600000000000001%2C89444600000000000002',
			)
			.reply(200, activeSimsTestData3)
		scope
			.get(
				'/api/v3/sims/usage-history?month=4&identifiers=89444600000000000001%2C89444600000000000002',
			)
			.reply(200, activeSimsTestData3)
		const iccids = ['89444600000000000001', '89444600000000000002']
		const activeSims = await fetchWirelessLogicSIMDetails({
			iccid: iccids,
			apiKey: 'apiKey',
			clientId: 'clientId',
			wirelessLogicDataLimit: 5000000,
			startDate: new Date('2024-04-03T08:04:14.000Z'),
		})
		const expectedResult = {
			usedBytes: {
				'89444600000000000001': 5104512,
				'89444600000000000002': 1349375,
			},
			totalBytes: 5000000,
		}
		assert.equal(scope.isDone(), true)
		assert.deepEqual('value' in activeSims && activeSims.value, expectedResult)
		assert.equal(nock.isDone(), true)
	})
	void it('should return an error if validation fails', async () => {
		const scope = nock('https://simpro4.wirelesslogic.com')
		scope
			.get(
				'/api/v3/sims/usage-history?month=4&identifiers=89444600000000000001%2C89444600000000000002',
			)
			.reply(200, {})
		const iccids = ['89444600000000000001', '89444600000000000002']
		const activeSims = await fetchWirelessLogicSIMDetails({
			iccid: iccids,
			apiKey: 'apiKey',
			clientId: 'clientId',
			wirelessLogicDataLimit: 5000000,
			startDate: new Date('2024-04-03T08:04:14.000Z'),
		})
		assert.equal(scope.isDone(), true)
		assert.equal('error' in activeSims, true)
		assert.equal(nock.isDone(), true)
	})
})
