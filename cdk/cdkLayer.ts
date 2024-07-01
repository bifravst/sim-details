import {
	packLayer,
	type PackedLayer,
} from '@bifravst/aws-cdk-lambda-helpers/layer'
import type pJson from '../package.json'

const dependencies: Array<keyof (typeof pJson)['dependencies']> = [
	'cfn-response',
]

export const packCDKLayer = async (): Promise<PackedLayer> =>
	packLayer({
		id: 'cdkLayer',
		dependencies,
	})
