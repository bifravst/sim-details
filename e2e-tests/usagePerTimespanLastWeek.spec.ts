import { strict as assert } from 'assert'
import { it } from 'node:test'
import { addMinute } from './lib/addMinute.js'
import { clients } from './lib/clients.js'
import { getRandomICCID } from './lib/getRandomICCID.js'
import { randomUsage } from './lib/randomUsage.js'
import type { Usage } from './lib/seedTimestream.js'

const { seedDB, seedTs, fetch } = await clients()

void it(`should calculate the usage per timespan`, async () => {
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
		{ usedBytes: randomUsage(), ts: addMinute(now, -60 * 24) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -60 * 48) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -60 * 70) },
	]

	await seedTs({
		usage: usageLastDay,
		iccid,
	})

	const req = await fetch(iccid)
	const responseBody = await req.json()

	const expectedUsage = usageLastDay.reduce(
		(total, { usedBytes }) => total + usedBytes,
		0,
	)
	const expectedUsageLastHour = usageLastDay[0]!.usedBytes
	const expectedUsageLastDay =
		usageLastDay[0]!.usedBytes + usageLastDay[1]!.usedBytes
	assert.deepEqual(
		responseBody.dataUsagePerTimespan,
		{
			lastDay: expectedUsageLastDay,
			lastHour: expectedUsageLastHour,
			lastMonth: expectedUsage,
			lastWeek: expectedUsage,
		},
		'Usage per timespan should be calculated',
	)
})
