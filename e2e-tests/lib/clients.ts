import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import type { StackOutputs } from '../../cdk/BackendStack.js'
import { STACK_NAME } from '../../cdk/stackConfig.js'
import { fetchHistoricalData } from './fetchHistoricalData.js'
import { fetchSIM } from './fetchSIM.js'
import { seedDynamoDB } from './seedDynamoDB.js'
import { seedTimestream } from './seedTimestream.js'

const db = new DynamoDBClient({})
const tsw = new TimestreamWriteClient({})
const cf = new CloudFormationClient()

export const clients = async (): Promise<{
	seedDB: ReturnType<typeof seedDynamoDB>
	seedTs: ReturnType<typeof seedTimestream>
	fetch: ReturnType<typeof fetchSIM>
	fetchHistory: ReturnType<typeof fetchHistoricalData>
}> => {
	const { APIURL, cacheTableName, tableInfo } =
		await stackOutput(cf)<StackOutputs>(STACK_NAME)

	const [dbName, tableName] = tableInfo.split('|') as [string, string]

	const seedDB = seedDynamoDB({ db, cacheTableName })
	const seedTs = seedTimestream({ tsw, dbName, tableName })
	const fetch = fetchSIM(new URL(APIURL))
	const fetchHistory = fetchHistoricalData(new URL(APIURL))

	return { seedDB, seedTs, fetch, fetchHistory }
}
