import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { StackOutputs } from '../cdk/BackendStack.js'
import { STACK_NAME } from '../cdk/stackConfig.js'
import { fetchSIM } from './fetchSIM.js'
import { getRandomICCID } from './getRandomICCID.js'
import { seedDynamoDB } from './seedDynamoDB.js'
import { seedTimestream, type Usage } from './seedTimestream.js'

const db = new DynamoDBClient({})
const tsw = new TimestreamWriteClient({})
const cf = new CloudFormationClient()

const { APIURL, cacheTableName, tableInfo } =
	await stackOutput(cf)<StackOutputs>(STACK_NAME)

const [dbName, tableName] = tableInfo.split('|') as [string, string]

const seedDB = seedDynamoDB({ db, cacheTableName })
const seedTs = seedTimestream({ tsw, dbName, tableName })
const fetch = fetchSIM(new URL(APIURL))

const randomUsage = () => Math.floor(Math.random() * 1000)
const addMinute = (now: Date, addMinutes = 0) =>
	new Date(now.getTime() + addMinutes * 60 * 1000)

void describe('e2e-tests', () => {
	void it(`should return statusCode 200, cache max-age=300 and correct body`, async () => {
		const now = new Date()
		const iccid = getRandomICCID(4446)

		await seedDB({
			iccid,
			usageTimestamp: now,
			simDetails: { usedBytes: 0, totalBytes: 1000 },
		})

		const usageLastHour: Usage = [
			{ usedBytes: randomUsage(), ts: addMinute(now, 0) },
			{ usedBytes: randomUsage(), ts: addMinute(now, 1) },
			{ usedBytes: randomUsage(), ts: addMinute(now, 2) },
			{ usedBytes: randomUsage(), ts: addMinute(now, 3) },
			{ usedBytes: randomUsage(), ts: addMinute(now, 4) },
		]

		await seedTs({
			usage: usageLastHour,
			iccid,
		})

		const req = await fetch(iccid)
		const expectedCacheControl = 'public, max-age=300'
		const responseBody = await req.json()
		assert.equal(req.headers.get('cache-control'), expectedCacheControl)
		assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
		assert.equal(req.status, 200)

		const expectedUsage = usageLastHour.reduce(
			(total, { usedBytes }) => total + usedBytes,
			0,
		)

		assert.deepEqual(responseBody, {
			dataUsagePerTimespan: {
				lastDay: expectedUsage,
				lastHour: expectedUsage,
				lastMonth: expectedUsage,
				lastWeek: expectedUsage,
			},
			ts: now.toISOString(),
			usedBytes: expectedUsage, // Why was this 0?
			totalBytes: 1000,
		})
	})
})
