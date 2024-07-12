export const MaybeDate = (
	date: string | Date | undefined,
): Date | undefined => {
	if (date === undefined) {
		return undefined
	}
	if (date instanceof Date) {
		return date
	}
	return new Date(date)
}
