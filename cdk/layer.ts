import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import type pJson from '../package.json'

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'@bifravst/from-env',
	'@sinclair/typebox',
	'e118-iin-list',
]

export const packBaseLayer = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'baseLayer',
		dependencies,
	})
