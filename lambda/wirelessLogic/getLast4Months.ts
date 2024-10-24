export const getLast4Months = (now?: Date): Array<number> => {
	const date2 = now ?? new Date()
	const currDate = new Date(date2.setDate(15)) //set date to 15 to prevent problems with end of month transitions
	return [0, 1, 2, 3].map(
		(n) => new Date(currDate.setMonth(date2.getMonth() - n)).getMonth() + 1,
	)
}
