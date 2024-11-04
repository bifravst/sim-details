import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { roundDownDate } from './roundDownDate.js'

void describe('roundDownDate', () => {
	void it('should round down a date with a given interval', async () => {
		const date = new Date('2024-04-03T08:04:14.000Z')
		const newDate = roundDownDate(date, 5)
		assert.deepEqual(newDate, new Date('2024-04-03T08:00:00.000Z'))
	})
})
