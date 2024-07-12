import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MaybeDate } from './MaybeDate.js'

void describe('MaybeDate', () => {
	void it('should return undefined if the input is undefined', () => {
		const result = MaybeDate(undefined)
		assert.equal(result, undefined)
	})

	void it('should return a Date object if the input is a valid date string', () => {
		const dateString = '2023-01-01'
		const result = MaybeDate(dateString)
		assert.equal(result?.toISOString(), new Date(dateString).toISOString())
	})

	void it('should return a Date object if the input is a Date object', () => {
		const dateObj = new Date('2023-01-01')
		const result = MaybeDate(dateObj)
		assert.equal(result, dateObj)
	})

	void it('should return an invalid Date object if the input is an invalid date string', () => {
		const invalidDateString = 'invalid-date'
		const result = MaybeDate(invalidDateString)
		assert.equal(result?.toString(), 'Invalid Date')
	})
})
