import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import type pJson from '../package.json'

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@sinclair/typebox',
	'e118-iin-list',
	'@bifravst/timestream-helpers',
	'@hello.nrfcloud.com/lambda-helpers',
	'@middy/core',
	'@aws-lambda-powertools/metrics',
]

export const packBaseLayer = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'baseLayer',
		dependencies,
	})
