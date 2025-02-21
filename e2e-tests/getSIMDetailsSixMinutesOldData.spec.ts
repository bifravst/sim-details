import assert from 'node:assert/strict'
import { it } from 'node:test'
import { addMinute } from './lib/addMinute.ts'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'

const { seedDB, fetch } = await clients()

void it(`should return correct response body`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: addMinute(now, -6),
		simDetails: { usedBytes: 0, totalBytes: 10_000_000 },
	})

	const req = await fetch(iccid)
	const responseBody = await req.json()
	assert.deepEqual(
		responseBody,
		{
			totalBytes: 10_000_000,
			ts: addMinute(now, -6).toISOString(),
			usedBytes: 0,
		},
		'Response body should match expected',
	)
})
