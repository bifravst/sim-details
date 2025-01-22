export const addMinute = (now: Date, addMinutes = 0): Date =>
	new Date(now.getTime() + addMinutes * 60 * 1000)
