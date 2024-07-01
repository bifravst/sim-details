import type { APIGatewayProxyResultV2 } from 'aws-lambda'

export const res =
	(statusCode: number, options?: { expires: number; contentType?: string }) =>
	(body?: unknown): APIGatewayProxyResultV2 => ({
		statusCode,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Content-Type': options?.contentType ?? 'application/json',
			...(options?.expires !== undefined && {
				'Cache-Control': `public, max-age=${options.expires}`,
				Expires: new Date(
					new Date().getTime() + options.expires * 1000,
				).toUTCString(),
			}),
			'X-sim-details-Version': process.env.VERSION ?? 'unknown',
		},
		body: JSON.stringify(body),
	})
