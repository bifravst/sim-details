import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chunkArray } from './chunkArray.js'

void describe('chunkArray', () => {
	void it('should divide an array into chunks', () => {
		const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		const expectedRes = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]
		const chunks = chunkArray({ array, chunkSize: 3 })
		assert.deepEqual(chunks, expectedRes)
	})
	void it('should return array with one chunk if chunksize > length of array', () => {
		const array = [1, 2]
		const expectedRes = [[1, 2]]
		const chunks = chunkArray({ array, chunkSize: 3 })
		assert.deepEqual(chunks, expectedRes)
	})
})
