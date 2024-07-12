import assert from 'node:assert'
import { describe, it } from 'node:test'
import { getLast4Months } from './getLast4Months.js'

void describe('getLast4months', () => {
	void it('should return the last 4 months from January', () => {
		const date = new Date('2024-01-03T08:04:14.000Z')
		const res = getLast4Months(date)
		assert.deepEqual(res, [1, 12, 11, 10])
	})
	void it('should return the last 4 months from August', () => {
		const date = new Date('2024-08-03T08:04:14.000Z')
		const res = getLast4Months(date)
		assert.deepEqual(res, [8, 7, 6, 5])
	})
})
