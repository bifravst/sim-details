export const getLast4Months = (now?: Date): Array<number> => {
	const date2 = now ?? new Date()
	const currDate = new Date()
	return [0, 1, 2, 3].map(
		(n) => new Date(currDate.setMonth(date2.getMonth() - n)).getMonth() + 1,
	)
}
