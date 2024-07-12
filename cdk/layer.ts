import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import type pJson from '../package.json'

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@hello.nrfcloud.com/proto',
	'@sinclair/typebox',
	'e118-iin-list',
	'@bifravst/timestream-helpers',
]

export const packBaseLayer = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'baseLayer',
		dependencies,
	})
