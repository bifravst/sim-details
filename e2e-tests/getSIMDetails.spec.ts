import assert from 'node:assert/strict'
import { it } from 'node:test'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'

const { seedDB, fetch } = await clients()

void it(`should return statusCode 200, cache max-age=300 and correct body`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 10_000_000 },
	})

	const req = await fetch(iccid)
	const expectedCacheControl = 'public, max-age=300'
	const responseBody = await req.json()
	assert.equal(req.headers.get('cache-control'), expectedCacheControl)
	assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
	assert.equal(req.status, 200)

	assert.deepEqual(
		responseBody,
		{
			dataUsagePerTimespan: {
				lastHour: 0,
				lastDay: 0,
				lastWeek: 0,
				lastMonth: 0,
			},
			totalBytes: 10_000_000,
			ts: now.toISOString(),
			usedBytes: 0,
		},
		'Response body should match expected',
	)
})
