import assert from 'node:assert/strict'
import { it } from 'node:test'
import { clients } from './lib/clients.ts'

const { fetch } = await clients()

void it(`should return statusCode 404, cache max-age=60 and an empty body when SIM issuer not supported`, async () => {
	const req = await fetch('89450421180216254864') //Telia Sonera A/S"
	const expectedCacheControl = 'public, max-age=60'
	assert.equal(req.headers.get('cache-control'), expectedCacheControl)
	assert.equal(req.status, 404)
	assert.equal(req.headers.get('content-length'), '0')
	assert.equal(await req.text(), '')
})
