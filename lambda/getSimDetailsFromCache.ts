import { type DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { validateWithTypeBox } from '@hello.nrfcloud.com/proto'
import { Type } from '@sinclair/typebox'

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
				error: Error | SIMNotFoundError | SIMNotExistingError | SIMInternalError
		  }
		| { success: { timestamp: Date; simDetails: SimDetails } }
	> => {
		const simDetails = db.send(
			new QueryCommand({
				TableName: cacheTableName,
				KeyConditionExpression: 'iccid = :iccid',
				ExpressionAttributeValues: {
					[':iccid']: {
						S: String(iccid),
					},
				},
				ProjectionExpression: 'usedBytes, totalBytes, SIMExisting,ts',
				ScanIndexForward: false,
				Limit: 1,
			}),
		)
		const items = (await simDetails).Items?.[0]

		//No information about SIM in cache
		if (items === undefined) {
			return { error: new SIMNotFoundError(iccid) }
		}

		//SIM is not existing
		const SIMexisting = unmarshall(items).SIMExisting as boolean
		if (!SIMexisting) {
			return { error: new SIMNotExistingError(iccid) }
		}
		const responseObject: { timestamp: Date; simDetails: SimDetails } = {
			timestamp: new Date(unmarshall(items).ts),
			simDetails: {
				usedBytes: unmarshall(items).usedBytes,
				totalBytes: unmarshall(items).totalBytes,
			},
		}
		const maybeValidResponseObject =
			validateWithTypeBox(respObj)(responseObject)
		if ('value' in maybeValidResponseObject) {
			return {
				success: responseObject,
			}
		}
		return { error: new SIMInternalError(iccid) }
	}

export const respObj = Type.Object({
	timestamp: Type.Date(),
	simDetails: Type.Object({
		usedBytes: Type.Number({ minimum: 0, examples: [0, 100, 1000] }),
		totalBytes: Type.Number({ examples: [4000, 40000, 400000] }),
	}),
})

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

export class SIMInternalError extends Error {
	public readonly iccid: string
	constructor(iccid: string) {
		super(`Internal error when getting SIM: ${iccid}`)
		this.iccid = iccid
		this.name = 'SIMInternalError'
	}
}
