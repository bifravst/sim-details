import testData from './testData/Onomondo-example.json'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getBytesAndConnectionInfo } from './getBytesAndConnectionInfo.js'

void describe('getBytesAndConnectionInfo', () => {
	void it('should get information about usage in bytes and connection info', () => {
		const expectedResult = {
			dataUsage: {
				usedBytes: 794716,
				bytesLeft: 9205284,
				totalBytes: 10000000,
			},
			connectionInfo: {
				network: {
					name: 'Telenor Norge',
					country: 'Norway',
					country_code: 'NO',
					mcc: '242',
					mnc: '01',
				},
			},
		}
		assert.deepEqual(getBytesAndConnectionInfo(testData), expectedResult)
	})
})
