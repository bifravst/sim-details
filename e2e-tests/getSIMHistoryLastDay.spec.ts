import assert from 'node:assert'
import { it } from 'node:test'
import { addMinute } from './lib/addMinute.ts'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'
import { randomUsage } from './lib/randomUsage.ts'
import type { Usage } from './lib/seedTimestream.ts'

const { seedDB, seedTs, fetchHistory } = await clients()

void it(`should return historical data for the last day`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 10000000 },
	})

	const usageLastDay: Usage = [
		{ usedBytes: randomUsage(), ts: addMinute(now, 0) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -60) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -60 * 2) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -60 * 3) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -60 * 4) },
	]

	await seedTs({
		usage: usageLastDay,
		iccid,
	})

	const expectedUsageHistory = usageLastDay
		.map(({ ts, usedBytes }) => ({
			ts: ts.toISOString(),
			usedBytes,
		}))
		.reverse()
	const req = await fetchHistory(iccid, 'lastDay')
	const responseBody = await req.json()
	assert.deepEqual(responseBody, { measurements: expectedUsageHistory })
})
