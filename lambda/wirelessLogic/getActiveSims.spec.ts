import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { getActiveSims } from './getActiveSims.js'
import { type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import testData from './testData/activeSimsFromDB.json'

void describe('getActiveSims()', () => {
	void it('should return an empty array if no SIMs in DB', async () => {
		const cacheTableName = 'cacheTable'
		const dynamoDbSend = mock.fn(async () =>
			Promise.resolve({
				Items: [],
			}),
		)
		const db: DynamoDBClient = {
			send: dynamoDbSend,
		} as any
		const activeSims = await getActiveSims(db, cacheTableName)()
		assert.deepEqual(activeSims, [])
	})
	void it('should return an array of the iccids of the active SIMs', async () => {
		const cacheTableName = 'cacheTable'
		const dynamoDbSend = mock.fn(async () => Promise.resolve(testData))
		const db: DynamoDBClient = {
			send: dynamoDbSend,
		} as any
		const activeSims = await getActiveSims(db, cacheTableName)()
		const expectedResult = ['89444600000000000001', '89444600000000000002']
		assert.deepEqual(activeSims, expectedResult)
	})
})
