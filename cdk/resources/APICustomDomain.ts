import { Construct } from 'constructs'
import {
	CustomResource,
	aws_apigatewayv2 as HttpApi,
	ResolutionTypeHint,
	type aws_lambda as Lambda,
	aws_iam as IAM,
} from 'aws-cdk-lib'
import { PackedLambdaFn } from '@bifravst/aws-cdk-lambda-helpers/cdk'
import type { IRestApi } from 'aws-cdk-lib/aws-apigateway'
import type { BackendLambdas } from '../lambdas.js'

export type CustomDomain = {
	domainName: string
	certificateArn: string
	// This is the ARN of the role to assume to update the CNAME record
	roleArn: string
}

export class APICustomDomain extends Construct {
	public readonly URL: string

	constructor(
		parent: Construct,
		{
			api,
			apiDomain,
			lambdaSources,
			cdkLayerVersion,
		}: {
			api: IRestApi
			apiDomain: CustomDomain
			lambdaSources: Pick<BackendLambdas, 'createCNAMERecord'>
			cdkLayerVersion: Lambda.ILayerVersion
		},
	) {
		super(parent, 'apiDomain')

		const domain = new HttpApi.CfnDomainName(this, 'apiDomain', {
			domainName: apiDomain.domainName,
			domainNameConfigurations: [
				{
					certificateArn: apiDomain.certificateArn,
				},
			],
		})
		new HttpApi.CfnApiMapping(this, 'apiDomainMapping', {
			apiId: api.restApiId,
			domainName: apiDomain.domainName,
			stage: api.deploymentStage.stageName,
			apiMappingKey: api.deploymentStage.stageName, // so the api is accessed via the same resource, e.g. https://api.sim-details.nordicsemi.cloud/2024-07-01/
		}).node.addDependency(domain)

		this.URL = `https://${apiDomain.domainName}/${api.deploymentStage.stageName}/`

		const createCNAMERecordFn = new PackedLambdaFn(
			this,
			'createCNAMERecordFn',
			lambdaSources.createCNAMERecord,
			{
				layers: [cdkLayerVersion],
				initialPolicy: [
					new IAM.PolicyStatement({
						actions: ['sts:AssumeRole'],
						resources: [apiDomain.roleArn],
					}),
				],
			},
		)

		new CustomResource(this, 'apiDomainCNAMERecord', {
			serviceToken: createCNAMERecordFn.fn.functionArn,
			// ServiceTimeout is not yet available: https://github.com/aws/aws-cdk/issues/30517
			properties: {
				roleArn: apiDomain.roleArn,
				domainName: apiDomain.domainName,
				cnameValue: domain.getAtt(
					'RegionalDomainName',
					ResolutionTypeHint.STRING,
				),
			},
		})
	}
}
