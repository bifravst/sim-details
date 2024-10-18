import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getQueryString } from './getQueryString.js'

void describe('getQueryString', () => {
	void it('should get the correct querystring from the given parameters', () => {
		const binIntervalMinutes = 60
		const durationHours = 1
		const iccid = '89444612812874751710'
		const dbName = 'dbName'
		const tableName = 'tableName'
		const queryString = getQueryString({
			timespan: { binIntervalMinutes, durationHours },
			iccid,
			dbName,
			tableName,
		})
		const expectedRes = `SELECT * FROM "dbName"."tableName" WHERE measure_name = 'UsedBytes' AND ICCID = '89444612812874751710' AND time > date_add('hour', -1, now()) ORDER BY bin(time, 60m) ASC`
		assert.equal(queryString, expectedRes)
	})
	void it('should get the correct querystring from the given parameters', () => {
		const binIntervalMinutes = 60
		const durationHours = 168
		const iccid = '89444612811234751710'
		const dbName = 'dbName2'
		const tableName = 'tableName2'
		const queryString = getQueryString({
			timespan: { binIntervalMinutes, durationHours },
			iccid,
			dbName,
			tableName,
		})
		const expectedRes = `SELECT * FROM "dbName2"."tableName2" WHERE measure_name = 'UsedBytes' AND ICCID = '89444612811234751710' AND time > date_add('hour', -168, now()) ORDER BY bin(time, 60m) ASC`
		assert.equal(queryString, expectedRes)
	})
})
