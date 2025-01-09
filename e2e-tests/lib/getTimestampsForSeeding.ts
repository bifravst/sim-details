export const getTimestampsForSeeding = (
	maxMin: number,
	interval: number,
): Date[] => {
	const timestamps = []
	const startDate = Date.now()
	for (let i = 0; i < maxMin; i += interval) {
		const time = new Date(startDate - i * 60 * 1000)
		timestamps.push(time)
	}
	return timestamps
}
