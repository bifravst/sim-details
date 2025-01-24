import assert from 'node:assert/strict'
import { it } from 'node:test'
import { clients } from './lib/clients.ts'
import { getRandomICCID } from './lib/getRandomICCID.ts'

const { fetch } = await clients()

void it(`should return statusCode 409, cache max-age=60 and an empty body when SIM details not in DB`, async () => {
	const iccid = getRandomICCID(4573)

	const req = await fetch(iccid)
	const expectedCacheControl = 'public, max-age=60'
	assert.equal(req.headers.get('cache-control'), expectedCacheControl)
	assert.equal(req.status, 409)
	assert.equal(req.headers.get('content-length'), '0')
	assert.equal(await req.text(), '')
})
