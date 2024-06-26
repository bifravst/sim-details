import {
	packLambdaFromPath,
	type PackedLambda,
} from '@bifravst/aws-cdk-lambda-helpers'

export type BackendLambdas = {
	getBasicSIMInformation: PackedLambda
	storeSimInformationOnomondo: PackedLambda
	getAllSimUsageOnomondo: PackedLambda
}

const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	getBasicSIMInformation: await pack('getBasicInformationLambda'),
	storeSimInformationOnomondo: await pack('storeSimInformationOnomondo'),
	getAllSimUsageOnomondo: await pack('getAllSimUsageOnomondo'),
})
