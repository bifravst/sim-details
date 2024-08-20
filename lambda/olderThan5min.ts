export const olderThan5min = ({
	timeStampFromDB,
	now,
}: {
	timeStampFromDB: Date
	now?: Date
}): boolean => {
	const date1 = now?.getTime() ?? new Date().getTime()
	const date2 = new Date(timeStampFromDB).getTime()
	const timeDiff = date1 - date2
	return timeDiff > 5 * 60 * 1000
}
