import { BackendApp } from './BackendApp.js'
import { IAMClient } from '@aws-sdk/client-iam'
import { packBaseLayer } from './layer.js'
import { packBackendLambdas } from './lambdas.js'
import { ensureGitHubOIDCProvider } from '@bifravst/ci'
import pJSON from '../package.json'
import { packCDKLayer } from './cdkLayer.js'
import { getCertificateForDomain } from '../aws/acm.js'
import { ACMClient } from '@aws-sdk/client-acm'

const repoUrl = new URL(pJSON.repository.url)
const repository = {
	owner: repoUrl.pathname.split('/')[1] ?? 'bifravst',
	repo: repoUrl.pathname.split('/')[2]?.replace(/\.git$/, '') ?? 'sim-details',
}

const iam = new IAMClient({})
const acm = new ACMClient({})

const apiDomainName = process.env.API_DOMAIN_NAME
const apiDomainRoute53RoleArn = process.env.API_DOMAIN_ROUTE_53_ROLE_ARN

new BackendApp({
	lambdaSources: await packBackendLambdas(),
	layer: await packBaseLayer(),
	cdkLayer: await packCDKLayer(),
	repository,
	gitHubOICDProviderArn: await ensureGitHubOIDCProvider({
		iam,
	}),
	isTest: process.env.IS_TEST === '1',
	apiDomain:
		apiDomainName !== undefined && apiDomainRoute53RoleArn !== undefined
			? {
					domainName: apiDomainName,
					certificateArn:
						(await getCertificateForDomain(acm)(apiDomainName))
							.certificateArn ?? '',
					roleArn: apiDomainRoute53RoleArn,
				}
			: undefined,
	version: (() => {
		const v = process.env.VERSION
		const defaultVersion = '0.0.0-development'
		if (v === undefined)
			console.warn(`VERSION is not defined, using ${defaultVersion}!`)
		return v ?? defaultVersion
	})(),
})
