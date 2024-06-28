import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { olderThan5min } from './olderThan5min.js'

void describe('olderThan5min', () => {
	void it('should return true if timestamp is older than 5 minutes', () => {
		const timeStampFromDB = new Date(1719379784582) //2024-06-26T05:29:44.582Z
		const dateNow = new Date(1719380114556) //2024-06-26T05:35:14.556Z
		const timeDiff = olderThan5min(timeStampFromDB, dateNow)
		assert.equal(timeDiff, true)
	})
	void it('should return false if timestamp is older than 5 minutes', () => {
		const timeStampFromDB = new Date(1719379784582) //2024-06-26T05:29:44.582Z
		const dateNow = new Date(1719372767000) //2024-06-26T03:32:47.000Z
		const timeDiff = olderThan5min(timeStampFromDB, dateNow)
		assert.equal(timeDiff, false)
	})
})
