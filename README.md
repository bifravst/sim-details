## Getting data for a specific SIM

The following request will GET the usage and connection information of a
specific SIM.

```
${APIURL}/sim/{iccid}
```

The response will look like this:

```json
{
  "dataUsage": {
    "bytesLeft": 9205284,
    "totalBytes": 10000000
  },
  "connectionInfo": {
    "network": {
      "name": "Telenor Norge",
      "country": "Norway",
      "country_code": "NO",
      "mcc": 242,
      "mnc": 01
    }
  }
}
```

## Getting historical data usage for a specific SIM

The following request will GET historical usage for a specific SIM for a given
timespan.

```
${APIURL}/sim/{iccid}/historicalData?timeSpan=<timespan>
```

The possible timespans are: last hour | last day | last week | last month

| timespan  | binIntervalMinutes | durationHours | expiresMinutes |
| --------- | ------------------ | ------------- | -------------- |
| lastHour  | 1                  | 1             | 1              |
| lastDay   | 15                 | 24            | 5              |
| lastWeek  | 60                 | 24\*7         | 5              |
| lastMonth | 60 ??              | 24\*30        | 15             |

The response would be different based on the timespan, but for the last month it
would be:

```json
{
    "measureValue": "bytes",
    "lastMonth":
    {
        "2020-06-01": 2646712,
        "2020-06-02": 26837,
        ...
        "2020-06-30": 1000,
    }
}
```

if we are using daily updates and not hourly updates as described in the table
above.
