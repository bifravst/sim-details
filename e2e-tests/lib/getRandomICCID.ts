export const getRandomICCID = (CCIIN: number): string => {
	const iccid = `89${CCIIN}`
	const min = 10000000000000
	const max = 99999999999999
	const randomNumber = Math.floor(Math.random() * (max - min) + min)
	return iccid + randomNumber
}
