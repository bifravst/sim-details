import { QueryCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { historyRecordReturnType } from './getBinInterval.js'
import { SIMNotFoundError } from './getSimDetailsFromCache.js'

export const getSimDetailsAvgUsageFromCache =
	(db: DynamoDBClient, cacheTableName: string) =>
	async (
		iccid: string,
		t: string,
	): Promise<
		| {
				error: SIMNotFoundError
		  }
		| {
				simHistory: {
					ts: Date
					measurements: historyRecordReturnType[]
				}
		  }
	> => {
		const simDetails = await db.send(
			new QueryCommand({
				TableName: cacheTableName,
				KeyConditionExpression: 'iccid = :iccid',
				ExpressionAttributeValues: {
					[':iccid']: {
						S: `${iccid}-${t}`,
					},
				},
				ProjectionExpression: 'measurements, ts',
				Limit: 1,
			}),
		)
		const sim = (simDetails.Items ?? []).map((item) => unmarshall(item))[0]
		//No information about SIM in cache
		if (sim === undefined) {
			return { error: new SIMNotFoundError(iccid) }
		}
		return {
			simHistory: {
				ts: new Date(sim.ts),
				measurements: JSON.parse(sim.measurements),
			},
		}
	}
