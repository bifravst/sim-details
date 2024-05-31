export const getBytesAndConnectionInfo = (
	apiData: SimInformation,
): BytesAndConnection => {
	return {
		dataUsage: {
			usedBytes: apiData.data_limit.used,
			bytesLeft: apiData.data_limit.total - apiData.data_limit.used,
			totalBytes: apiData.data_limit.total,
		},
		connectionInfo: { network: apiData.network },
	}
}

export type BytesAndConnection = {
	dataUsage: {
		usedBytes: number
		bytesLeft: number
		totalBytes: number
	}
	connectionInfo: {
		network: {
			name: string
			country: string
			country_code: string
			mcc: string
			mnc: string
		}
	}
}

export type SimInformation = {
	id: string
	msisdn: string
	iccid: string
	label: string | null
	network_whitelist: string
	imei_lock: null
	imei: string
	imsi: string
	connector: string | null
	activated: boolean
	ipv4: string
	online_at: string
	last_came_online_at: string
	network: {
		name: string
		country: string
		country_code: string
		mcc: string
		mnc: string
	}
	usage: number
	tags: {
		name: string
		id: string
		can_write: boolean
		color: null | string
	}[]
	online: boolean
	data_limit: {
		used: number
		total: number
		type: string
		period: string
		alert_threshold: null
		resets_at: string
	}
	location?: {
		lat: number
		lng: number
		cell_id: number
		location_area_code: null
		accuracy: number
	}
	device_info?: {
		model: string
		manufacturer: string
	}
	technologies?: {
		sms: boolean
		'2g_3g': boolean
		'4g': boolean
	}
}
