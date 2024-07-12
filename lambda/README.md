# Getting the history for different SIMs

By using the following GET request;

```
https://api.sim-details.nordicsemi.cloud/2024-07-01/sim/<your SIM's ICCID>/history?timespan=<timespan>
```

you should get the history for that SIM in the following format:

```
{"timestamp": Date, "usage": number}[]
```

For the last hour this could be:

Get request:

```
https://api.sim-details.nordicsemi.cloud/2024-07-01/sim/<your SIM's ICCID>/history?timespan=lastHour
```

Returns:

```json
[
  { "ts": "2024-07-01T12:00:00.000Z", "usedBytes": 50 },
  { "ts": "2024-07-01T12:05:00.000Z", "usedBytes": 100 },
  { "ts": "2024-07-01T12:10:00.000Z", "usedBytes": 0 },
  { "ts": "2024-07-01T12:15:00.000Z", "usedBytes": 45 },
  { "ts": "2024-07-01T12:20:00.000Z", "usedBytes": 344221 },
  { "ts": "2024-07-01T12:25:00.000Z", "usedBytes": 854 },
  { "ts": "2024-07-01T12:30:00.000Z", "usedBytes": 0 },
  { "ts": "2024-07-01T12:35:00.000Z", "usedBytes": 30 },
  { "ts": "2024-07-01T12:40:00.000Z", "usedBytes": 25 },
  { "ts": "2024-07-01T12:45:00.000Z", "usedBytes": 0 },
  { "ts": "2024-07-01T12:50:00.000Z", "usedBytes": 400 },
  { "ts": "2024-07-01T12:55:00.000Z", "usedBytes": 50 }
]
```

given that the request was sent at 13:00:00.

# Data storing

For WL (Wireless Logic) we have a lambda
[getAllSimUsageWirelessLogic.ts](./getAllSimUsageWirelessLogic.ts) which runs
every 5 minutes for updating the DynamoDB value for the usage per active SIM.
For WL an active SIM means that it is in DynamoDB.

[getAllSimUsageWirelessLogic.ts](./getAllSimUsageWirelessLogic.ts) will fetch
the data usage from WL API every 5 minutes. This usage is then compared to the
previous value in DynamoDB (from our last fetch), and if there is a difference
between those values this is written to Timestream. By doing it this way we make
sure that we only write to Timestream when we have usage from active (used the
last hour) SIMs.

Another lambda where we fetch from WL API is
[storeSimInformationWirelessLogic.ts](./storeSimInformationWirelessLogic.ts).
This lambda is doing the same as getAllSimUsageWirelessLogic, and the only
difference is that it fetches data for one specific SIM that is received from a
queue. By also writing to Timestream in this function we cover every usage
update from WL and we can use the same logic as earlier where the data would be
updated every 5 minutes.

For Onomondo we have a lambda
[getAllSimUsageOnomondo.ts](./getAllSimUsageOnomondo.ts) which runs every hour
for updating the DynamoDB value and Timestream history. The function will
request all usage within the current day, and store the usage chunks in
Timestream. This way we have all the history in Timestream. This function also
updates the total usage which is stored in DynamoDB.

Another lambda for fetching data from Onomondo is
[storeSimInformationOnomondo.ts](./storeSimInformationOnomondo.ts). This lambda
is also fetching data from Onomondo API, but this happens when a user requests
the history through our API. History from that specific SIM is then requested
from Onomondo API, and then stored in Timestream. The usage in dynamodb is also
updated.
