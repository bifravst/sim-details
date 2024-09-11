import { describe, it } from 'node:test'
import { getNewRecords } from './getNewRecords.js'
import assert from 'node:assert'
import type { SIMUsageHistory } from './onomondo/getAllUsedSimsOnomondo.js'

void describe('getNewRecords()', () => {
	void it('should return a list of Records with new usage', async () => {
		const iccid = '89457387300000022734'
		const dataUsage = {
			'89457387300000022734': [
				{
					ts: new Date('2020-02-03T07:49:13.000Z'),
					usedBytes: 1424843,
					billId: '7c5f95c7-c0ff-352e-93e2-5370a6d37b42',
				},
				{
					ts: new Date('2020-02-03T08:04:14.000Z'),
					usedBytes: 1103,
					billId: '0538f940-b382-339c-b2a3-19c788c385f6',
				},
			],
		}
		const historyTs = new Date('2020-02-03T07:49:13.000Z')
		const records = getNewRecords(iccid, historyTs, dataUsage)
		const expectedRes = [
			{
				Dimensions: [
					{
						Name: 'ICCID',
						Value: '89457387300000022734',
					},
					{
						Name: 'ID',
						Value: '0538f940-b382-339c-b2a3-19c788c385f6',
					},
				],
				MeasureName: 'UsedBytes',
				MeasureValue: '1103',
				MeasureValueType: 'DOUBLE',
				Time: '1580717054000',
				TimeUnit: 'MILLISECONDS',
				Version: 1,
			},
		]
		assert.deepEqual(records, expectedRes)
	})
	void it('should return a list of Records with new usage', async () => {
		const iccid = '89457387300000022734'
		const dataUsage: SIMUsageHistory = {
			'89457387300000022734': [
				{
					ts: new Date('2020-02-03T07:49:13.000Z'),
					usedBytes: 1424843,
					billId: '7c5f95c7-c0ff-352e-93e2-5370a6d37b42',
				},
				{
					ts: new Date('2020-02-03T08:04:14.000Z'),
					usedBytes: 1103,
					billId: '0538f940-b382-339c-b2a3-19c788c385f6',
				},
			],
		}
		const historyTs = new Date('2020-02-03T06:49:13.000Z')
		const records = getNewRecords(iccid, historyTs, dataUsage)
		const expectedRes = [
			{
				Dimensions: [
					{
						Name: 'ICCID',
						Value: '89457387300000022734',
					},
					{
						Name: 'ID',
						Value: '7c5f95c7-c0ff-352e-93e2-5370a6d37b42',
					},
				],
				MeasureName: 'UsedBytes',
				MeasureValue: '1424843',
				MeasureValueType: 'DOUBLE',
				Time: '1580716153000',
				TimeUnit: 'MILLISECONDS',
				Version: 1,
			},
			{
				Dimensions: [
					{
						Name: 'ICCID',
						Value: '89457387300000022734',
					},
					{
						Name: 'ID',
						Value: '0538f940-b382-339c-b2a3-19c788c385f6',
					},
				],
				MeasureName: 'UsedBytes',
				MeasureValue: '1103',
				MeasureValueType: 'DOUBLE',
				Time: '1580717054000',
				TimeUnit: 'MILLISECONDS',
				Version: 1,
			},
		]
		assert.deepEqual(records, expectedRes)
	})
})
