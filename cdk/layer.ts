import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import pJson from '../package.json' assert { type: 'json' }

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@sinclair/typebox',
	'e118-iin-list',
	'@bifravst/timestream-helpers',
	'@middy/core',
	'@aws-lambda-powertools/metrics',
]

export const packBaseLayer = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'baseLayer',
		dependencies,
	})
