import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { byTsDesc } from './byTsDesc.js'

void describe('byTsDesc', () => {
	void it('should return a positive number if the first date is earlier than the second', () => {
		const a = { ts: new Date('2023-01-01') }
		const b = { ts: new Date('2023-01-02') }
		assert.deepEqual([a, b].sort(byTsDesc), [b, a])
	})

	void it('should return a negative number if the first date is later than the second', () => {
		const a = { ts: new Date('2023-01-02') }
		const b = { ts: new Date('2023-01-01') }
		assert.deepEqual([a, b].sort(byTsDesc), [a, b])
	})

	void it('should return zero if the dates are the same', () => {
		const a = { ts: new Date('2023-01-01') }
		const b = { ts: new Date('2023-01-01') }
		const result = byTsDesc(a, b)
		assert.strictEqual(result, 0)
	})
})
