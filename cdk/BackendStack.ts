import type { App } from 'aws-cdk-lib'
import CloudFormation, {
	Stack,
	aws_lambda as Lambda,
	Duration,
	aws_events as Events,
	aws_events_targets as EventsTargets,
	CfnOutput,
	aws_dynamodb as DynamoDB,
	aws_sqs as SQS,
	aws_apigateway as apigw,
	aws_iam as IAM,
	aws_timestream as Timestream,
} from 'aws-cdk-lib'
import { STACK_NAME } from './stackConfig.js'
import type { BackendLambdas } from './lambdas.js'
import type { PackedLayer } from '@bifravst/aws-cdk-lambda-helpers/layer'
import { ContinuousDeployment } from './resources/ContinuousDeployment.js'
import {
	LambdaSource,
	PackedLambdaFn,
} from '@bifravst/aws-cdk-lambda-helpers/cdk'
import {
	APICustomDomain,
	type CustomDomain,
} from './resources/APICustomDomain.js'

export class BackendStack extends Stack {
	constructor(
		parent: App,
		{
			lambdaSources,
			layer,
			cdkLayer,
			repository,
			gitHubOICDProviderArn,
			apiDomain,
		}: {
			lambdaSources: BackendLambdas
			layer: PackedLayer
			cdkLayer: PackedLayer
			repository: {
				owner: string
				repo: string
			}
			gitHubOICDProviderArn: string
			apiDomain?: CustomDomain
		},
	) {
		super(parent, STACK_NAME)

		const isTest = this.node.tryGetContext('isTest') === true

		const cd = new ContinuousDeployment(this, {
			repository,
			gitHubOICDProviderArn,
		})
		new CfnOutput(this, 'cdRoleArn', {
			exportName: `${this.stackName}:cdRoleArn`,
			description: 'Role ARN to use in the deploy GitHub Actions Workflow',
			value: cd.role.roleArn,
		})
		const db = new Timestream.CfnDatabase(this, 'db')
		const table = new Timestream.CfnTable(this, 'table', {
			databaseName: db.ref,
			retentionProperties: {
				MemoryStoreRetentionPeriodInHours: `24`,
				MagneticStoreRetentionPeriodInDays: '365',
			},
		})
		new CfnOutput(this, 'tableInfo', {
			value: table.ref,
			exportName: `${this.stackName}:tableInfo`,
		})
		// =====================================================================================
		// Amazon DynamoDB table for storing sim details
		// =====================================================================================
		const simDetailsCacheTable = new DynamoDB.Table(this, 'SimDetailsCacheDB', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'iccid',
				type: DynamoDB.AttributeType.STRING,
			},
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
			pointInTimeRecovery: !isTest,
		})

		new CfnOutput(this, 'cacheTableName', {
			exportName: `${this.stackName}:cacheTableName`,
			description: 'Cachetablename for storing SIM details',
			value: simDetailsCacheTable.tableName,
		})

		const baseLayer = new Lambda.LayerVersion(this, 'baseLayer', {
			layerVersionName: `${Stack.of(this).stackName}-baseLayer`,
			code: new LambdaSource(this, {
				id: 'baseLayer',
				zipFile: layer.layerZipFile,
				hash: layer.hash,
			}).code,
			compatibleArchitectures: [Lambda.Architecture.ARM_64],
			compatibleRuntimes: [Lambda.Runtime.NODEJS_20_X],
		})

		const resolutionJobsQueue = new SQS.Queue(this, 'resolutionJobsQueue', {
			fifo: true,
			queueName: `${this.stackName}.fifo`,
			visibilityTimeout: Duration.seconds(60),
		})

		const wirelessLogicQueue = new SQS.Queue(this, 'wirelessLogicQueue', {
			fifo: true,
			queueName: `${this.stackName}-WL.fifo`,
			visibilityTimeout: Duration.seconds(60),
		})

		const getBasicSIMInformation = new PackedLambdaFn(
			this,
			'getBasicSIMInformation',
			lambdaSources.getBasicSIMInformation,
			{
				layers: [baseLayer],
				timeout: Duration.seconds(60),
				memorySize: 1024,
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					SIM_DETAILS_JOBS_QUEUE: resolutionJobsQueue.queueUrl,
					WIRELESS_LOGIC_QUEUE: wirelessLogicQueue.queueUrl,
					TABLE_INFO: table.ref,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						resources: [
							resolutionJobsQueue.queueArn,
							wirelessLogicQueue.queueArn,
						],
						actions: ['sqs:SendMessage'],
					}),
					new IAM.PolicyStatement({
						actions: [
							'timestream:Select',
							'timestream:DescribeTable',
							'timestream:ListMeasures',
						],
						resources: [table.attrArn],
					}),
					new IAM.PolicyStatement({
						actions: [
							'timestream:DescribeEndpoints',
							'timestream:SelectValues',
							'timestream:CancelQuery',
						],
						resources: ['*'],
					}),
				],
			},
		)
		simDetailsCacheTable.grantReadData(getBasicSIMInformation.fn)
		resolutionJobsQueue.grantSendMessages(getBasicSIMInformation.fn)
		wirelessLogicQueue.grantSendMessages(getBasicSIMInformation.fn)

		const getAllSimUsageOnomondo = new PackedLambdaFn(
			this,
			'getAllSimUsageOnomondo',
			lambdaSources.getAllSimUsageOnomondo,
			{
				layers: [baseLayer],
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					SIM_DETAILS_JOBS_QUEUE: resolutionJobsQueue.queueUrl,
					TABLE_INFO: table.ref,
				},
				timeout: Duration.seconds(60),
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['timestream:DescribeEndpoints'],
						resources: ['*'],
					}),
					new IAM.PolicyStatement({
						actions: ['timestream:WriteRecords'],
						resources: [table.attrArn],
					}),
				],
			},
		)
		resolutionJobsQueue.grantSendMessages(getAllSimUsageOnomondo.fn)
		simDetailsCacheTable.grantReadWriteData(getAllSimUsageOnomondo.fn)

		const getAllSimUsageWirelessLogic = new PackedLambdaFn(
			this,
			'getAllSimUsageWirelessLogic',
			lambdaSources.getAllSimUsageWirelessLogic,
			{
				layers: [baseLayer],
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					TABLE_INFO: table.ref,
				},
				timeout: Duration.seconds(60),
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['timestream:WriteRecords'],
						resources: [table.attrArn],
					}),
					new IAM.PolicyStatement({
						actions: ['timestream:DescribeEndpoints'],
						resources: ['*'],
					}),
				],
			},
		)
		simDetailsCacheTable.grantReadWriteData(getAllSimUsageWirelessLogic.fn)
		const rule = new Events.Rule(this, 'InvokeActivitiesRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description: `Invoke the lambdas that fetches usage for all active SIMs`,
			enabled: true,
			targets: [
				new EventsTargets.LambdaFunction(getAllSimUsageOnomondo.fn),
				new EventsTargets.LambdaFunction(getAllSimUsageWirelessLogic.fn),
			],
		})
		const fiveMinRule = new Events.Rule(this, 'InvokeActivities5MinRule', {
			schedule: Events.Schedule.expression('rate(5 minutes)'),
			description: `Invoke the lambdas that fetches usage for all active SIMs`,
			enabled: true,
			targets: [
				new EventsTargets.LambdaFunction(getAllSimUsageWirelessLogic.fn),
			],
		})

		getAllSimUsageOnomondo.fn.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})
		getAllSimUsageWirelessLogic.fn.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: fiveMinRule.ruleArn,
		})

		const storeSimInformationOnomondo = new PackedLambdaFn(
			this,
			'storeSimInformationOnomondo',
			lambdaSources.storeSimInformationOnomondo,
			{
				layers: [baseLayer],
				reservedConcurrentExecutions: 10,
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					TABLE_INFO: table.ref,
				},
				timeout: Duration.seconds(60),
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['timestream:WriteRecords'],
						resources: [table.attrArn],
					}),
					new IAM.PolicyStatement({
						actions: ['timestream:DescribeEndpoints'],
						resources: ['*'],
					}),
				],
			},
		)
		simDetailsCacheTable.grantReadWriteData(storeSimInformationOnomondo.fn)

		const dailyOnomondoUpdate = new PackedLambdaFn(
			this,
			'dailyOnomondoUpdate',
			lambdaSources.dailyOnomondoUpdate,
			{
				layers: [baseLayer],
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					TABLE_INFO: table.ref,
				},
				timeout: Duration.seconds(60),
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['timestream:DescribeEndpoints'],
						resources: ['*'],
					}),
					new IAM.PolicyStatement({
						actions: ['timestream:WriteRecords'],
						resources: [table.attrArn],
					}),
				],
			},
		)
		simDetailsCacheTable.grantReadWriteData(dailyOnomondoUpdate.fn)
		const dailyRule = new Events.Rule(this, 'InvokeActivitiesDailyRule', {
			schedule: Events.Schedule.expression('cron(0 0 ? * * *)'),
			description: `Invoke the lambdas that fetches usage for all active SIMs`,
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(dailyOnomondoUpdate.fn)],
		})
		dailyOnomondoUpdate.fn.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: dailyRule.ruleArn,
		})
		const storeSimInformationWirelessLogic = new PackedLambdaFn(
			this,
			'storeSimInformationWirelessLogic',
			lambdaSources.storeSimInformationWirelessLogic,
			{
				layers: [baseLayer],
				reservedConcurrentExecutions: 10,
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					TABLE_INFO: table.ref,
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['timestream:WriteRecords'],
						resources: [table.attrArn],
					}),
					new IAM.PolicyStatement({
						actions: ['timestream:DescribeEndpoints'],
						resources: ['*'],
					}),
				],
			},
		)
		simDetailsCacheTable.grantReadWriteData(storeSimInformationWirelessLogic.fn)

		const api = new apigw.LambdaRestApi(this, 'simDetailsAPI', {
			handler: getBasicSIMInformation.fn,
			proxy: false,
			deployOptions: {
				// Version APIs by date
				stageName: '2024-07-01',
			},
		})
		const simResource = api.root.addResource('sim')
		const simByICCIDResource = simResource.addResource('{iccid}')
		simByICCIDResource.addMethod('GET')
		const simHistoryResource = simByICCIDResource.addResource('historicalData')
		const simHistoryByICCIDAndTimespanResourse =
			simHistoryResource.addResource('{timespan}')
		simHistoryByICCIDAndTimespanResourse.addMethod('GET')

		if (apiDomain === undefined) {
			new CfnOutput(this, 'APIURL', {
				exportName: `${this.stackName}:APIURL`,
				description: 'API endpoint',
				value: api.url,
			})
		} else {
			const cdkLayerVersion = new Lambda.LayerVersion(this, 'cdkLayer', {
				code: new LambdaSource(this, {
					id: 'cdkLayer',
					zipFile: cdkLayer.layerZipFile,
					hash: cdkLayer.hash,
				}).code,
				compatibleArchitectures: [Lambda.Architecture.ARM_64],
				compatibleRuntimes: [Lambda.Runtime.NODEJS_20_X],
			})
			const domain = new APICustomDomain(this, {
				api,
				apiDomain,
				lambdaSources,
				cdkLayerVersion,
			})
			new CfnOutput(this, 'APIURL', {
				exportName: `${this.stackName}:APIURL`,
				description: 'API endpoint',
				value: domain.URL,
			})
		}

		storeSimInformationOnomondo.fn.addPermission('invokeBySQS', {
			principal: new IAM.ServicePrincipal('sqs.amazonaws.com'),
			sourceArn: resolutionJobsQueue.queueArn,
		})

		storeSimInformationWirelessLogic.fn.addPermission('invokeBySQS', {
			principal: new IAM.ServicePrincipal('sqs.amazonaws.com'),
			sourceArn: wirelessLogicQueue.queueArn,
		})

		new Lambda.EventSourceMapping(this, 'invokeLambdaFromNotificationQueue', {
			eventSourceArn: resolutionJobsQueue.queueArn,
			target: storeSimInformationOnomondo.fn,
			batchSize: 10,
		})

		new Lambda.EventSourceMapping(
			this,
			'invokeLambdaFromNotificationWirelessLogicQueue',
			{
				eventSourceArn: wirelessLogicQueue.queueArn,
				target: storeSimInformationWirelessLogic.fn,
				batchSize: 10,
			},
		)

		wirelessLogicQueue.grantConsumeMessages(storeSimInformationWirelessLogic.fn)
		resolutionJobsQueue.grantConsumeMessages(storeSimInformationOnomondo.fn)
		resolutionJobsQueue.grantConsumeMessages(getAllSimUsageOnomondo.fn)
	}
}

export type StackOutputs = {
	APIURL: string
	cacheTableName: string
	tableInfo: string
}
