export const fetchData =
	(APIURL: URL) =>
	async (iccid: string): Promise<Response> =>
		fetch(`${APIURL.toString()}/sim/${iccid}`)
