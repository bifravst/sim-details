import assert from 'node:assert/strict'
import { it } from 'node:test'
import { clients } from './lib/clients.js'

const { fetch } = await clients()

void it(`should return a problem details message that describes the reason for the 400 error when not existing iccid`, async () => {
	const req = await fetch('notValidIccid')
	const expectedBody = {
		type: 'https://github.com/bifravst/sim-details',
		title: "Your request parameters didn't validate.",
		'invalid-params': [
			{
				name: 'iccid',
				reason:
					'Not a valid iccid. Must include MII, country code, issuer identifier, individual account identification number and parity check digit. See https://www.itu.int/rec/dologin_pub.asp?lang=e&id=T-REC-E.118-200605-I!!PDF-E&type=items for more information.',
			},
		],
	}
	const responseBody = await req.json()
	assert.equal(req.status, 400)
	assert.equal(req.headers.get('Content-Type'), 'application/problem+json')
	assert.deepEqual(responseBody, expectedBody)
})
