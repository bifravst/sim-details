import assert from 'node:assert'
import { it } from 'node:test'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'

const { seedDB, fetchHistory } = await clients()

void it(`should return empty array for SIM with no history`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 10000000 },
	})

	const req = await fetchHistory(iccid, 'lastHour')
	const responseBody = await req.json()

	assert.deepEqual(responseBody, { measurements: [] })
})
