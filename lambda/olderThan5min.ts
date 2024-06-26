export const olderThan5min = (
	timeStampFromDB: Date,
	dateNow?: Date,
): boolean => {
	const date1 = dateNow?.getTime() ?? new Date().getTime()
	const date2 = new Date(timeStampFromDB).getTime()
	const timeDiff = date1 - date2
	return timeDiff > 5 * 60 * 1000
}
