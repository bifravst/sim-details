import { QueryCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'

export type SimDetails = {
	usedBytes: number
	totalBytes: number
}

export const getSimDetailsFromCache =
	(db: DynamoDBClient, cacheTableName: string) =>
	async (
		iccid: string,
	): Promise<
		| {
				error: SIMNotFoundError | SIMNotExistingError
		  }
		| {
				sim: SimDetails & {
					ts: Date
				}
				historyTs?: Date
		  }
	> => {
		const simDetails = await db.send(
			new QueryCommand({
				TableName: cacheTableName,
				KeyConditionExpression: 'iccid = :iccid',
				ExpressionAttributeValues: {
					[':iccid']: {
						S: String(iccid),
					},
				},
				ProjectionExpression:
					'usedBytes, totalBytes, SIMExisting, ts, historyTs',
				Limit: 1,
			}),
		)
		const sim = (simDetails.Items ?? []).map((item) => unmarshall(item))[0]
		//No information about SIM in cache
		if (sim === undefined) {
			return { error: new SIMNotFoundError(iccid) }
		}

		//SIM is not existing
		if (sim.SIMExisting === false) {
			return { error: new SIMNotExistingError(iccid) }
		}
		return {
			sim: {
				ts: new Date(sim.ts),
				usedBytes: sim.usedBytes,
				totalBytes: sim.totalBytes,
			},
			historyTs: new Date(sim.historyTs),
		}
	}

export class SIMNotFoundError extends Error {
	public readonly iccid: string
	constructor(iccid: string) {
		super(`SIM not found: ${iccid}`)
		this.iccid = iccid
		this.name = 'SIMNotFoundError'
	}
}

export class SIMNotExistingError extends Error {
	public readonly iccid: string
	constructor(iccid: string) {
		super(`SIM not existing: ${iccid}`)
		this.iccid = iccid
		this.name = 'SIMNotExistingError'
	}
}
