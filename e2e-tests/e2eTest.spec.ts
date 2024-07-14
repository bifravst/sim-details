import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import type { StackOutputs } from '../cdk/BackendStack.js'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { getRandomICCID } from './getRandomICCID.js'
import { putSimDetails } from '../lambda/putSimDetails.js'
import { seedingDBFunction } from './seedingDBFunction.js'

const CFclient = new CloudFormationClient()
export const outputs = await stackOutput(CFclient)<StackOutputs>(STACK_NAME)
export const db = new DynamoDBClient({})

const iccidNew = getRandomICCID(4573)
const iccidOld = getRandomICCID(4573)
const iccidNewWL = getRandomICCID(4446)
const iccidOldWL = getRandomICCID(4446)
const iccidNotExisting = getRandomICCID(4573)
const now = new Date()
const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000)

void describe('e2e-tests', () => {
	before(async () => {
		//put notExisting SIM in DB
		await putSimDetails(db, outputs.cacheTableName)(iccidNotExisting, false)
		//put iccid from vendors in DB
		await seedingDBFunction({
			iccidNew,
			iccidOld,
			now,
			sixMinAgo,
		})
		await seedingDBFunction({
			iccidNew: iccidNewWL,
			iccidOld: iccidOldWL,
			now,
			sixMinAgo,
		})
	})
	const expectedBodyNew = {
		timestamp: now.toISOString(),
		usedBytes: 0,
		totalBytes: 1000,
	}
	const expectedBodyOld = {
		timestamp: sixMinAgo.toISOString(),
		usedBytes: 50,
		totalBytes: 1000,
	}
	for (const [iccid, response, statusCode, status] of [
		[iccidNewWL, expectedBodyNew, 200, 'recent Wireless Logic'],
		[iccidNew, expectedBodyNew, 200, 'recent Onomondo'],
		[iccidOldWL, expectedBodyOld, 200, 'old Wireless Logic'],
		[iccidOld, expectedBodyOld, 200, 'old Onomondo'],
	] as [
		string,
		{ timestamp: string; usedBytes: number; totalBytes: number },
		number,
		string,
	][]) {
		void it(`should return statusCode ${statusCode}, cache max-age=300 and correct body for iccid: ${iccid} with status ${status}`, async () => {
			const req = await fetchData(iccid)
			const expectedCacheControl = 'public, max-age=300'
			const responseBody = await req.json()
			assert.equal(req.headers.get('cache-control'), expectedCacheControl)
			assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
			assert.equal(req.status, statusCode)
			assert.deepEqual(responseBody, response)
		})
	}
	void it('should return a problem details message that describes the reason for the 400 error when not existing iccid', async () => {
		const req = await fetchData('notValidIccid')
		const expectedBody = {
			type: 'https://github.com/bifravst/sim-details',
			title: "Your request parameters didn't validate.",
			'invalid-params': [
				{
					name: 'iccid',
					reason:
						'Not a valid iccid. Must include MII, country code, issuer identifier, individual account identification number and parity check digit. See https://www.itu.int/rec/dologin_pub.asp?lang=e&id=T-REC-E.118-200605-I!!PDF-E&type=items for more information.',
				},
			],
		}
		const responseBody = await req.json()
		assert.equal(req.status, 400)
		assert.equal(req.headers.get('Content-Type'), 'application/problem+json')
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.deepEqual(responseBody, expectedBody)
	})
	void it('should return a problem details message that describes the reason for the 400 error when not valid iccid', async () => {
		const req = await fetchData('89450421180216254864') //Telia Sonera A/S"
		const expectedBody = {
			type: 'https://github.com/bifravst/sim-details',
			title: "Your request parameters didn't validate.",
			'invalid-params': [
				{
					name: 'iccid',
					reason: 'Not a valid issuer identifier.',
				},
			],
		}
		const responseBody = await req.json()
		assert.equal(req.status, 400)
		assert.equal(req.headers.get('Content-Type'), 'application/problem+json')
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.deepEqual(responseBody, expectedBody)
	})
	void it('should return statusCode 409 and cache max-age=60 when the SIM information is not in DB', async () => {
		const req = await fetchData(getRandomICCID(4573))
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 409)
		assert.equal(req.headers.get('content-length'), '0')
		assert.equal(await req.text(), '')
	})
	void it('should return statusCode 404 and cache max-age=60 when the SIM is not existing', async () => {
		const req = await fetchData(iccidNotExisting)
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 404)
		assert.equal(req.headers.get('content-length'), '0')
		assert.equal(await req.text(), '')
	})
})

const fetchData = async (iccid: string): Promise<Response> => {
	const url = `${outputs.APIURL}/sim/${iccid}`
	return await fetch(url)
}
