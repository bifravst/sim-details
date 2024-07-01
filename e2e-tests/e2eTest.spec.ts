import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import type { StackOutputs } from '../cdk/BackendStack.js'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { getRandomICCID } from './getRandomICCID.js'
import { seedingDBFunction } from './seedingDBFunction.js'

const CFclient = new CloudFormationClient()
export const outputs = await stackOutput(CFclient)<StackOutputs>(STACK_NAME)
export const db = new DynamoDBClient({})

const iccidNew = getRandomICCID()
const iccidOld = getRandomICCID()
const iccidNotExisting = getRandomICCID()
const now = new Date()
const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000)

void describe('e2e-tests', () => {
	before(async () => {
		await seedingDBFunction({
			iccidNew,
			iccidOld,
			iccidNotExisting,
			now,
			sixMinAgo,
		})
	})
	void it('should return statusCode 409 and cache max-age=60 when the SIM information is not in DB', async () => {
		const req = await fetchData(getRandomICCID())
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.status, 409)
	})
	void it('should return statusCode 404 and cache max-age=60 when the SIM is not existing', async () => {
		const req = await fetchData(iccidNotExisting)
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.status, 404)
	})
	void it('should return statusCode 200, cache max-age=300 and correct body if the data is in cache', async () => {
		const req = await fetchData(iccidNew)
		const expectedCacheControl = 'public, max-age=300'
		const expectedBody = {
			timestamp: now.toISOString(),
			simDetails: { usedBytes: 0, totalBytes: 1000 },
		}
		const responseBody = await req.json()
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.status, 200)
		assert.deepEqual(responseBody, expectedBody)
	})
	void it('should return statusCode 200, cache max-age=300 and correct body if the data is in cache and not recent.', async () => {
		const req = await fetchData(iccidOld)
		const expectedCacheControl = 'public, max-age=300'
		const expectedBody = {
			timestamp: sixMinAgo.toISOString(),
			simDetails: { usedBytes: 50, totalBytes: 1000 },
		}
		const responseBody = await req.json()
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.status, 200)
		assert.deepEqual(responseBody, expectedBody)
	})
})

const fetchData = async (iccid: string): Promise<Response> => {
	const url = `${outputs.APIURL}/sim/${iccid}`
	return await fetch(url)
}
