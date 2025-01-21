export const fetchSIM =
	(APIURL: URL) =>
	async (iccid: string): Promise<Response> =>
		fetch(`${APIURL.toString()}/sim/${iccid}`)
