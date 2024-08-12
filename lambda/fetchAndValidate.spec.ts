import nock from 'nock'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fetchAndValidate } from './fetchAndValidate.js'
import { SimInfo } from './onomondo/fetchOnomondoSimDetails.js'
import testData from './onomondo/testData/Onomondo-example.json'

void describe('fetchAndValidate', () => {
	void it('should fetch the Onomondo SIM details', async () => {
		const scope = nock('https://api.onomondo.com')
		scope.get('/sims/89457300000022321072').reply(200, testData)
		const res = await fetchAndValidate({
			schema: SimInfo,
			url: new URL('https://api.onomondo.com/sims/89457300000022321072'),
			apiKey: '',
		})
		assert.equal(scope.isDone(), true)
		assert.equal('error' in res, false)
		assert.deepEqual('value' in res && res.value, testData)
		assert.equal(nock.isDone(), true)
	})
})
