import { strict as assert } from 'assert'
import { it } from 'node:test'
import { addMinute } from './lib/addMinute.ts'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'
import { randomUsage } from './lib/randomUsage.ts'
import type { Usage } from './lib/seedTimestream.ts'

const { seedDB, seedTs, fetch } = await clients()

void it(`should calculate the usage per timespan`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 10000000 },
	})

	const usageLastHour: Usage = [
		{ usedBytes: randomUsage(), ts: addMinute(now, 0) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -5) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -10) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -15) },
		{ usedBytes: randomUsage(), ts: addMinute(now, -20) },
	]

	await seedTs({
		usage: usageLastHour,
		iccid,
	})

	const req = await fetch(iccid)
	const responseBody = await req.json()

	const expectedUsage = usageLastHour.reduce(
		(total, { usedBytes }) => total + usedBytes,
		0,
	)

	assert.deepEqual(
		responseBody.dataUsagePerTimespan,
		{
			lastDay: expectedUsage,
			lastHour: expectedUsage,
			lastMonth: expectedUsage,
			lastWeek: expectedUsage,
		},
		'Usage per timespan should be calculated',
	)
})
