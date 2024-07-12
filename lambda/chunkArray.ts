export const chunkArray = <Element>({
	array,
	chunkSize,
}: {
	array: Array<Element>
	chunkSize: number
}): Array<Array<Element>> => {
	const newArray = []
	for (let i = 0; i < array.length; i += chunkSize) {
		const chunk = array.slice(i, i + chunkSize)
		newArray.push(chunk)
	}
	return newArray
}
