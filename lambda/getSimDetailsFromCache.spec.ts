import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
	SIMNotExistingError,
	SIMNotFoundError,
	getSimDetailsFromCache,
} from './getSimDetailsFromCache.js'

void describe('getSimDetailsFromCache()', () => {
	void it('should return NOT_FOUND if no data for iccid in cache', async () => {
		const cacheTableName = 'cacheTable'
		const iccid = '1234567890'
		const dynamoDbSend = mock.fn(async () =>
			Promise.resolve({
				Items: [],
			}),
		)
		const db: DynamoDBClient = {
			send: dynamoDbSend,
		} as any
		const simDetails = await getSimDetailsFromCache(db, cacheTableName)(iccid)
		assert.equal(
			'error' in simDetails && simDetails.error instanceof SIMNotFoundError,
			true,
		)
	})
	void it('should return NOT_EXISTING if SIM is not existing', async () => {
		const cacheTableName = 'cacheTable'
		const iccid = '1234567890'
		const dynamoDbSend = mock.fn(async () =>
			Promise.resolve({
				Items: [
					{
						SIMExisting: { B: false },
						ts: { N: 1719219232398 },
						usedBytes: { N: 0 },
						totalBytes: { N: 0 },
					},
				],
			}),
		)
		const db: DynamoDBClient = {
			send: dynamoDbSend,
		} as any
		const simDetails = await getSimDetailsFromCache(db, cacheTableName)(iccid)
		assert.equal(
			'error' in simDetails && simDetails.error instanceof SIMNotExistingError,
			true,
		)
	})
	void it('should return a success object if data exists', async () => {
		const cacheTableName = 'cacheTable'
		const iccid = '1234567890'
		const dynamoDbSend = mock.fn(async () =>
			Promise.resolve({
				Items: [
					{
						SIMExisting: { B: true },
						ts: { N: 1719219232398 },
						usedBytes: { N: 123 },
						totalBytes: { N: 2000 },
					},
				],
			}),
		)
		const db: DynamoDBClient = {
			send: dynamoDbSend,
		} as any
		const expectedRes = {
			success: {
				timestamp: new Date('2024-06-24T08:53:52.398Z'),
				simDetails: {
					totalBytes: 2000,
					usedBytes: 123,
				},
			},
		}
		const simDetails = await getSimDetailsFromCache(db, cacheTableName)(iccid)
		assert.deepEqual(simDetails, expectedRes)
	})
})
