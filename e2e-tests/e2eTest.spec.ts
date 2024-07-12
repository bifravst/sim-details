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
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { getTimestampsForSeeding } from './getTimestampsForSeeding.js'
import { seedTimestream } from './seedTimestream.js'

const CFclient = new CloudFormationClient()
export const outputs = await stackOutput(CFclient)<StackOutputs>(STACK_NAME)
export const db = new DynamoDBClient({})
export const tsw = new TimestreamWriteClient({})
const [dbName, tableName] = outputs.tableInfo.split('|') as [string, string]

const iccidNew = getRandomICCID(4573)
const iccidOld = getRandomICCID(4573)
const iccidNewWL = getRandomICCID(4446)
const iccidOldWL = getRandomICCID(4446)
const iccidNotExisting = getRandomICCID(4573)
const now = new Date()
const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000)
const timestampsLastHour = getTimestampsForSeeding(60, 5)
const timestampsLastDay = getTimestampsForSeeding(60 * 24, 60)
const randomVal = [1, 3, 67, 1, 2, 3, 5, 7, 2, 1, 42, 4]
const randomVal2 = [5, 3, 1, 7, 89, 3, 4, 1, 3, 7, 0, 0]

void describe('e2e-tests', () => {
	before(async () => {
		//put notExisting SIM in DB
		await putSimDetails(
			db,
			outputs.cacheTableName,
		)({ iccid: iccidNotExisting, simExisting: false })
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
		await seedTimestream(
			timestampsLastHour,
			randomVal,
			iccidNewWL,
			dbName,
			tableName,
		)
		await seedTimestream(
			timestampsLastDay,
			randomVal,
			iccidOldWL,
			dbName,
			tableName,
		)
		await seedTimestream(
			timestampsLastHour,
			randomVal2,
			iccidNew,
			dbName,
			tableName,
		)
	})
	const expectedBodyNew = {
		ts: now.toISOString(),
		usedBytes: 0,
		totalBytes: 1000,
	}
	const expectedBodyOld = {
		ts: sixMinAgo.toISOString(),
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
		{ ts: string; usedBytes: number; totalBytes: number },
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
	const expectedResLastHour: Array<Record<string, string | number>> = []
	timestampsLastHour.forEach((ts, index) => {
		expectedResLastHour.push({
			ts: ts.toISOString(),
			usedBytes: randomVal[index] ?? 0,
		})
	})
	const expectedResLastHourOnomondo: Array<Record<string, string | number>> = []
	timestampsLastHour.forEach((ts, index) => {
		expectedResLastHourOnomondo.push({
			ts: ts.toISOString(),
			usedBytes: randomVal2[index] ?? 0,
		})
	})
	const expectedResLastDay: Array<Record<string, string | number>> = []
	timestampsLastDay.forEach((ts, index) => {
		expectedResLastDay.push({
			ts: ts.toISOString(),
			usedBytes: randomVal[index] ?? 0,
		})
	})
	for (const [iccid, response, timespan] of [
		[iccidNewWL, expectedResLastHour, 'lastHour'],
		[iccidOldWL, expectedResLastDay, 'lastDay'],
		[iccidNew, expectedResLastHourOnomondo, 'lastHour'],
	] as [string, Array<{ ts: string; usedBytes: number }>, string][]) {
		void it(`should return measurements from timespan ${timespan} for iccid ${iccid}`, async () => {
			const req = await fetchHistoricalData(iccid, timespan)
			const expectedCacheControl = 'public, max-age=300'
			const responseBody = await req.json()
			assert.equal(req.headers.get('cache-control'), expectedCacheControl)
			assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
			assert.equal(req.status, 200)
			assert.deepEqual(responseBody, { measurements: response.reverse() })
		})
	}
})

const fetchData = async (iccid: string): Promise<Response> => {
	const url = `${outputs.APIURL}/sim/${iccid}`
	return await fetch(url)
}

const fetchHistoricalData = async (
	iccid: string,
	timeSpan: string,
): Promise<Response> => {
	const url = `${outputs.APIURL}/sim/${iccid}/historicalData/${timeSpan}`
	return await fetch(url)
}
