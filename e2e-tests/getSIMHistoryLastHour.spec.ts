import assert from 'node:assert'
import { it } from 'node:test'
import { addMinute } from './lib/addMinute.ts'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'
import { randomUsage } from './lib/randomUsage.ts'
import type { Usage } from './lib/seedTimestream.ts'

const { seedDB, seedTs, fetchHistory } = await clients()

void it(`should return historical data for the last hour`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 10000000 },
	})

	const usageLastHour: Usage = [
		{ usedBytes: randomUsage(), ts: addMinute(now, 0) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -10) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -20) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -30) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -40) },
	]

	await seedTs({
		usage: usageLastHour,
		iccid,
	})

	const expectedUsageHistory = usageLastHour
		.map(({ ts, usedBytes }) => ({
			ts: ts.toISOString(),
			usedBytes,
		}))
		.reverse()
	const req = await fetchHistory(iccid, 'lastHour')
	const responseBody = await req.json()

	const expectedCacheControl = 'public, max-age=300'
	assert.equal(req.headers.get('cache-control'), expectedCacheControl)
	assert.equal(req.headers.get('Access-Control-Allow-Origin'), '*')
	assert.equal(req.status, 200)
	assert.deepEqual(responseBody, { measurements: expectedUsageHistory })
})
