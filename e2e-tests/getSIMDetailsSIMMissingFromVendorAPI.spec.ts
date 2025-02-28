import assert from 'node:assert/strict'
import { it } from 'node:test'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'

const { seedDB, fetch } = await clients()

/*
This can happen when users claim their SIM and we no longer have access to the data coming from the SIM in the vendor API. 
*/
void it(`should return statusCode 200, cache max-age=60 and an empty body for SIM that is missing from vendor API`, async () => {
	const now = new Date()
	const iccid = getRandomICCID(4446)
	await seedDB({
		iccid,
		usageTimestamp: now,
		simDetails: { usedBytes: 0, totalBytes: 0 },
		simExisting: true,
		SIMMissingFromVendorAPI: true,
	})

	const res = await fetch(iccid)
	const expectedCacheControl = 'public, max-age=60'
	assert.equal(res.headers.get('cache-control'), expectedCacheControl)
	assert.equal(res.status, 200)
	assert.equal(res.headers.get('content-length'), '0')
	assert.equal(await res.text(), '')
})
