import { type Static, type TObject } from '@sinclair/typebox'
import { validateWithTypeBox } from './validateWithTypeBox.js'

export const fetchAndValidate = async <Schema extends TObject>({
	schema,
	url,
	apiKey,
}: {
	schema: Schema
	url: URL
	apiKey: string
}): Promise<{ value: Static<Schema> } | { error: Error }> => {
	const response = await fetch(url, {
		headers: { authorization: apiKey },
	})
	const res = await response.json()
	//validate response from API
	const maybeValidatedData = validateWithTypeBox(schema)(res)
	if ('errors' in maybeValidatedData) {
		return { error: new Error('Validation of data failed.') }
	}
	return { value: maybeValidatedData.value }
}
