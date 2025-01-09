import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import type { StackOutputs } from '../cdk/BackendStack.js'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { putSimDetails } from '../lambda/putSimDetails.js'
import { fetchHistoricalData } from './lib/fetchHistoricalData.js'
import { fetchSIM } from './lib/fetchSIM.js'
import { getRandomICCID } from './lib/getRandomICCID.js'
import { getTimestampsForSeeding } from './lib/getTimestampsForSeeding.js'
import { seedDynamoDB } from './lib/seedDynamoDB.js'
import { seedTimestream } from './lib/seedTimestream.js'

const CFclient = new CloudFormationClient()
export const outputs = await stackOutput(CFclient)<StackOutputs>(STACK_NAME)
export const db = new DynamoDBClient({})
export const tsw = new TimestreamWriteClient({})
const [dbName, tableName] = outputs.tableInfo.split('|') as [string, string]
const APIURL = new URL(outputs.APIURL)
const iccidNew = getRandomICCID(4573)
const iccidOld = getRandomICCID(4573)
const iccidNewWL = getRandomICCID(4446)
const iccidOldWL = getRandomICCID(4446)
const iccidNotExisting = getRandomICCID(4573)
const iccidNoHistory = getRandomICCID(4446)
const now = new Date()
const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000)
const timestampsLastHour = getTimestampsForSeeding(60, 5)
const timestampsLastDay = getTimestampsForSeeding(60 * 24, 60)
const timestampsLastTwoDays = getTimestampsForSeeding(60 * 24 * 1.5, 60 * 4)
const usedBytes = [1, 3, 67, 1, 2, 3, 5, 7, 2, 1, 42, 4]
const usedBytes2 = [5, 3, 1, 7, 89, 3, 4, 1, 3, 7, 0, 0]
const usedBytesLastTwoDays = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const usageLastHour = timestampsLastHour.map((ts, index) => ({
	ts,
	usedBytes: usedBytes[index] ?? 0,
}))

const usageLastHour2 = timestampsLastHour.map((ts, index) => ({
	ts,
	usedBytes: usedBytes2[index] ?? 0,
}))

const usageLastDay = timestampsLastDay.map((ts, index) => ({
	ts,
	usedBytes: usedBytes[index] ?? 0,
}))

const usageLastTwoDays = timestampsLastTwoDays.map((ts, index) => ({
	ts,
	usedBytes: usedBytesLastTwoDays[index] ?? 0,
}))

const seedTs = seedTimestream({ tsw, dbName, tableName })
const seedDb = seedDynamoDB({ db, cacheTableName: outputs.cacheTableName })
const fetch = fetchSIM(APIURL)

void describe('e2e-tests', async () => {
	before(async () => {
		//put notExisting SIM in DB
		await putSimDetails(
			db,
			outputs.cacheTableName,
		)({ iccid: iccidNotExisting, simExisting: false })
		//put noHistory SIM in DB
		await seedDb({
			iccid: iccidNoHistory,
			usageTimestamp: now,
			simDetails: { usedBytes: 0, totalBytes: 1000 },
		})
	})

	void it(`should return statusCode 200, cache max-age=300 and correct body for iccid: ${iccidNew}`, async () => {
		await seedDb({
			iccid: iccidNew,
			usageTimestamp: now,
			simDetails: { usedBytes: 0, totalBytes: 1000 },
		})
		await seedTs({
			usage: usageLastHour2,
			iccid: iccidNew,
		})
		/*
			Timestream is seeded with the following values for the last hour: [5, 3, 1, 7, 89, 3, 4, 1, 3, 7, 0, 0],
			and dataUsagePerTimespan is calculated by summing the values in the array. They should all be 123 since 
			we only have data for the last hour.
		*/
		const req = await fetch(iccidNew)
		const expectedCacheControl = 'public, max-age=300'
		const responseBody = await req.json()
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 200)
		assert.deepEqual(responseBody, {
			dataUsagePerTimespan: {
				lastDay: 123,
				lastHour: 123,
				lastMonth: 123,
				lastWeek: 123,
			},
			ts: now.toISOString(),
			usedBytes: 0,
			totalBytes: 1000,
		})
	})
	void it(`should return statusCode 200, cache max-age=300 and correct body for iccid: ${iccidOldWL}`, async () => {
		await seedDb({
			iccid: iccidOldWL,
			usageTimestamp: sixMinAgo,
			simDetails: { usedBytes: 50, totalBytes: 1000 },
		})
		await seedTs({
			usage: usageLastDay,
			iccid: iccidOldWL,
		})
		/*
			Timestream is seeded with the following values for the last day: [1, 3, 67, 1, 2, 3, 5, 7, 2, 1, 42, 4],
			and dataUsagePerTimespan is calculated by summing the values in the array. For the last hour the datausage
			should be 1, and for the other timespans it should be 138 since we only have data for the last day.
		*/
		const req = await fetch(iccidOldWL)
		const expectedCacheControl = 'public, max-age=300'
		const responseBody = await req.json()
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 200)
		assert.deepEqual(responseBody, {
			dataUsagePerTimespan: {
				lastDay: 138,
				lastHour: 1,
				lastMonth: 138,
				lastWeek: 138,
			},
			ts: sixMinAgo.toISOString(),
			usedBytes: 50,
			totalBytes: 1000,
		})
	})
	void it(`should return statusCode 200, cache max-age=300 and correct body for iccid: ${iccidOld}`, async () => {
		await seedDb({
			iccid: iccidOld,
			usageTimestamp: sixMinAgo,
			simDetails: { usedBytes: 50, totalBytes: 1000 },
		})
		await seedTs({
			usage: usageLastTwoDays,
			iccid: iccidOld,
		})
		/*
			Timestream is seeded with the following values for the last two days: [1, 2, 3, 4, 5, 6, 7, 8, 9],
			and dataUsagePerTimespan is calculated by summing the values in the array. For the last hour the datausage
			should be 1, for the last day the datausage should be 21 and for the other timespans it should be 45 since 
			we only have data for the last two days.
		*/
		const req = await fetch(iccidOld)
		const expectedCacheControl = 'public, max-age=300'
		const responseBody = await req.json()
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 200)
		assert.deepEqual(responseBody, {
			dataUsagePerTimespan: {
				lastDay: 21,
				lastHour: 1,
				lastMonth: 45,
				lastWeek: 45,
			},
			ts: sixMinAgo.toISOString(),
			usedBytes: 50,
			totalBytes: 1000,
		})
	})
	void it('should return a problem details message that describes the reason for the 400 error when not existing iccid', async () => {
		const req = await fetch('notValidIccid')
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
	void it('should return statusCode 404 if the SIM issuer is not supported.', async () => {
		const req = await fetch('89450421180216254864') //Telia Sonera A/S"
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.status, 404)
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('content-length'), '0')
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
	})
	void it('should return statusCode 409 and cache max-age=60 when the SIM information is not in DB', async () => {
		const req = await fetch(getRandomICCID(4573))
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 409)
		assert.equal(req.headers.get('content-length'), '0')
		assert.equal(await req.text(), '')
	})
	void it('should return statusCode 404 and cache max-age=60 when the SIM is not existing', async () => {
		const req = await fetch(iccidNotExisting)
		const expectedCacheControl = 'public, max-age=60'
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 404)
		assert.equal(req.headers.get('content-length'), '0')
		assert.equal(await req.text(), '')
	})
	const expResLastHour = usageLastHour
		.map((usage) => ({
			ts: usage.ts.toISOString(),
			usedBytes: usage.usedBytes,
		}))
		.reverse()

	const expResLastHour2 = usageLastHour2
		.map((usage) => ({
			ts: usage.ts.toISOString(),
			usedBytes: usage.usedBytes,
		}))
		.reverse()
	const expResLastDay = usageLastDay
		.map((usage) => ({
			ts: usage.ts.toISOString(),
			usedBytes: usage.usedBytes,
		}))
		.reverse()

	for (const [iccid, response, timespan] of [
		[iccidNewWL, expResLastHour, 'lastHour'],
		[iccidOldWL, expResLastDay, 'lastDay'],
		[iccidNew, expResLastHour2, 'lastHour'],
		[iccidNoHistory, [], 'lastHour'],
	] as [string, Array<{ ts: string; usedBytes: number }>, string][]) {
		void it(`should return measurements from timespan ${timespan} for iccid ${iccid}`, async () => {
			const req = await fetchHistoricalData(APIURL)(iccid, timespan)
			const expectedCacheControl = 'public, max-age=300'
			const responseBody = await req.json()
			assert.equal(req.headers.get('cache-control'), expectedCacheControl)
			assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
			assert.equal(req.status, 200)
			assert.deepEqual(responseBody, { measurements: response })
		})
	}
})
