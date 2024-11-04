export const roundDownDate = (date: Date, interval: number): Date => {
	const coeff = 1000 * 60 * interval
	return new Date(Math.floor(date.getTime() / coeff) * coeff)
}
