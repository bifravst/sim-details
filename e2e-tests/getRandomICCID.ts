export const getRandomICCID = (): string => {
	const iccid = '894573'
	const min = 10000000000000
	const max = 99999999999999
	const randomNumber = Math.floor(Math.random() * (max - min) + min)
	return iccid + randomNumber
}
