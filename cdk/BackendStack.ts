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
		// =====================================================================================
		// Amazon DynamoDB table for storing sim details
		// =====================================================================================
		const simDetailsCacheTable = new DynamoDB.Table(this, 'SimDetailsCacheDB', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'iccid',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
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
				},
				initialPolicy: [
					new IAM.PolicyStatement({
						resources: [resolutionJobsQueue.queueArn],
						actions: ['sqs:SendMessage'],
					}),
				],
			},
		)
		simDetailsCacheTable.grantReadData(getBasicSIMInformation.fn)
		resolutionJobsQueue.grantSendMessages(getBasicSIMInformation.fn)

		const getAllSimUsageOnomondo = new PackedLambdaFn(
			this,
			'getAllSimUsageOnomondo',
			lambdaSources.getAllSimUsageOnomondo,
			{
				layers: [baseLayer],
				environment: {
					CACHE_TABLE_NAME: simDetailsCacheTable.tableName,
					SIM_DETAILS_JOBS_QUEUE: resolutionJobsQueue.queueUrl,
				},
			},
		)
		resolutionJobsQueue.grantSendMessages(getAllSimUsageOnomondo.fn)

		const rule = new Events.Rule(this, 'InvokeActivitiesRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description: `Invoke the lambda that fetches usage for all active SIMs`,
			enabled: true,
			targets: [new EventsTargets.LambdaFunction(getAllSimUsageOnomondo.fn)],
		})
		getAllSimUsageOnomondo.fn.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
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
				},
			},
		)
		simDetailsCacheTable.grantWriteData(storeSimInformationOnomondo.fn)

		const api = new apigw.LambdaRestApi(this, 'simDetailsAPI', {
			handler: getBasicSIMInformation.fn,
			proxy: false,
		})
		const iccidVar = api.root.addResource('iccid')
		iccidVar.addMethod('GET')

		const iccid = iccidVar.addResource('{iccid}')
		iccid.addMethod('GET')

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

		new Lambda.EventSourceMapping(this, 'invokeLambdaFromNotificationQueue', {
			eventSourceArn: resolutionJobsQueue.queueArn,
			target: storeSimInformationOnomondo.fn,
			batchSize: 10,
		})

		resolutionJobsQueue.grantConsumeMessages(storeSimInformationOnomondo.fn)
		resolutionJobsQueue.grantConsumeMessages(getAllSimUsageOnomondo.fn)
	}
}

export type StackOutputs = {
	APIURL: string
	cacheTableName: string
}
