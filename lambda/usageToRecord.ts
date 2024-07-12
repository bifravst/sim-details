import type { _Record } from '@aws-sdk/client-timestream-write'
import { createHash } from 'crypto'

export const checksum = (iccid: string, currentTime: Date): string => {
	const shasum = createHash('sha1')
	shasum.update(JSON.stringify(iccid + currentTime.toString()))
	return shasum.digest('hex')
}

export const usageToRecord = ({
	iccid,
	diff,
	currentTime,
	id,
	version,
}: {
	iccid: string
	diff: number
	currentTime?: Date
	id?: string
	version?: number
}): { record: _Record } => {
	return {
		record: {
			Dimensions: [
				{ Name: 'ICCID', Value: iccid },
				{ Name: 'ID', Value: id ?? checksum(iccid, currentTime ?? new Date()) },
			],
			MeasureName: 'UsedBytes',
			MeasureValue: diff.toString(),
			MeasureValueType: 'DOUBLE',
			Time: currentTime?.getTime().toString() ?? Date.now().toString(),
			TimeUnit: 'MILLISECONDS',
			Version: version ?? 1,
		},
	}
}
