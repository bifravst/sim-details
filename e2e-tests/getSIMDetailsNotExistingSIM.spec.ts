import assert from 'node:assert/strict'
import { it } from 'node:test'
import { clients } from './lib/clients.js'
import { getRandomICCID } from './lib/getRandomICCID.js'

const { seedDB, fetch } = await clients()

void it(`should return statusCode 404, cache max-age=60 and an empty body for SIM not existing`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)

	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 0 },
		simExisting: false,
	})

	const req = await fetch(iccid)
	const expectedCacheControl = 'public, max-age=60'
	assert.equal(req.headers.get('cache-control'), expectedCacheControl)
	assert.equal(req.status, 404)
	assert.equal(req.headers.get('content-length'), '0')
	assert.equal(await req.text(), '')
})
