import testData from './testData/Onomondo-usageExample.json'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getDailyUsage } from './getDailyUsage.js'

void describe('GetDailyUsage', () => {
	void it('should get a daily usage summary from Onomondo SIM', () => {
		const expectedResult = {
			'2020-06-04': 2646712,
			'2020-06-05': 26837,
			'2020-06-06': 1000,
		}
		assert.deepEqual(getDailyUsage(testData), expectedResult)
	})
})
