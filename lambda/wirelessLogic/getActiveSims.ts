import { type DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { identifyIssuer } from 'e118-iin-list'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { wirelessLogicIIN } from '../constants.js'

export const getActiveSims =
	(db: DynamoDBClient, cacheTableName: string) =>
	async (): Promise<Record<string, number>> => {
		const iccids = []
		const iccidAndUsage: Record<string, number> = {}
		const items = await db.send(new ScanCommand({ TableName: cacheTableName }))
		const sims = (items.Items ?? []).map((item) => unmarshall(item))
		for (const sim of sims) {
			const issuer = identifyIssuer(sim.iccid)
			if (
				issuer !== undefined &&
				issuer.issuerIdentifierNumber === wirelessLogicIIN &&
				sim.SIMExisting === true
			) {
				iccids.push(sim.iccid)
				iccidAndUsage[sim.iccid] = sim.usedBytes
			}
		}
		return iccidAndUsage
	}
