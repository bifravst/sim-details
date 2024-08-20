export const fetchHistoricalData =
	(APIURL: URL) =>
	async (iccid: string, timeSpan: string): Promise<Response> =>
		fetch(`${APIURL.toString()}/sim/${iccid}/historicalData/${timeSpan}`)
