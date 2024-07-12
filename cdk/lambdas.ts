import {
	packLambdaFromPath,
	type PackedLambda,
} from '@bifravst/aws-cdk-lambda-helpers'

export type BackendLambdas = {
	getBasicSIMInformation: PackedLambda
	storeSimInformationOnomondo: PackedLambda
	storeSimInformationWirelessLogic: PackedLambda
	getAllSimUsageOnomondo: PackedLambda
	getAllSimUsageWirelessLogic: PackedLambda
	createCNAMERecord: PackedLambda
	dailyOnomondoUpdate: PackedLambda
}

const pack = async (id: string) => packLambdaFromPath(id, `lambda/${id}.ts`)

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	getBasicSIMInformation: await pack('getBasicInformationLambda'),
	storeSimInformationOnomondo: await pack('storeSimInformationOnomondo'),
	storeSimInformationWirelessLogic: await pack(
		'storeSimInformationWirelessLogic',
	),
	getAllSimUsageOnomondo: await pack('getAllSimUsageOnomondo'),
	getAllSimUsageWirelessLogic: await pack('getAllSimUsageWirelessLogic'),
	createCNAMERecord: await packLambdaFromPath(
		'createCNAMERecord',
		'cdk/resources/api/createCNAMERecord.ts',
	),
	dailyOnomondoUpdate: await pack('dailyOnomondoUpdate'),
})
