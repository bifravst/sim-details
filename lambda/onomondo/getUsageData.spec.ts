import testData from './testData/Onomondo-example.json'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getUsageData } from './getUsageData.js'

void describe('getBytesAndConnectionInfo', () => {
	void it('should get information about usage in bytes and connection info', () => {
		const expectedResult = {
			usedBytes: 794716,
			totalBytes: 10000000,
		}
		assert.deepEqual(getUsageData(testData), expectedResult)
	})
})
