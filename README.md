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
| lastMonth | 60 (\*24 ?)        | 24\*30        | 15             |

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

if we are using daily updates and not hourly updates.

## The steps involved with the first request

1. The user asks for general information about the SIM by using a GET request
   and presenting the `iccid`.
2. A lambda is used to check if we have recent data from the specific SIM in
   DynamoDB. If we have recent data in DynamoDB it is presented to the user. If
   we don't have recent data we make an API call to get recent data and stores
   this in DynamoDB as well as giving it to the user. It is not decided how to
   define recent data, could one hour be recent enough?

## The steps involved in the second request

1. The user asks for historical usage from a specific SIM by using a GET request
   and presenting the `iccid` and `timespan`.
2. A lambda is used to get the data needed from Timestream in the correct
   timespan for that specific SIM. The data will be provided in the intervals
   decided by the timespan 'rules' set in the table above.

## Data storing in AWS

All the historical data usage information will be stored in Amazon Timestream as
shown in the example below.

| timestamp             | iccid                | bill_id                                | bytes  |
| --------------------- | -------------------- | -------------------------------------- | ------ |
| "2020-06-04 06:49:41" | 89457387300000022734 | "4db28719-18ed-323c-a367-c1498fbd96d5" | 315    |
| "2020-06-04 07:04:56" | 89457387300000022734 | "73a5df37-562e-3a2d-9ba7-a65a9a79ed12" | 210076 |

This way it will be easy to get the information for different timespans. This
data will be stored for 30 days. The `timestamp`, `iccid` and `bytes` are needed
for the query; the `bill_id` is added as an id for the entry.

The more general usage and connection information from the SIM will be fetched
from the vendors API and cached using DynamoDB. This data does not need to be
stored after getting an update, we only need the newest information.

## How we solve part 1 in the backend

### Suggestion 1:

When the user sends a GET request we check the database to see if we have recent
cached data. If not, we send a GET request to the vendors API to get recent data
and updates our cached data in the database. This could be done in a lambda
function. The database would be DynamoDB.

By using this method we make sure that we send the minimal amount of GET
requests to the vendors API. One negative part could be that we need to wait a
bit longer to get the data.

Question:

- Is this some sort of data we always show at the frontend? Or is it something
  the user can request by clicking something?

### Suggestion 2

If the plan is to present this data all the time, we need to do regular fetching
of the data from the vendors API. Then we could get data from their API once an
hour, and store that in our database. Then we would present the data from the
database whenever we get a request. The data in this database would always be
the most recent data.

By using this method we ensure that the data is always recent when the user
needs it. On the other hand this could be unnececcary many API calls to the
vendor if the user never wants to look at this data.

## How we solve part 2 in the backend

1. Usage data should be fetched from the vendors API regularly.
2. The data shold be converted to a general format, most likely similar to the
   example in the table above.
3. The data will then be uploaded to Timestream.
4. When the GET requests comes the query should match the given timespan for the
   SIM and the user should be provided with the data in the correct format.

1 and 2 needs to be solved seperately for the specific API, while the other
steps should be general for all data from all SIM vendors.

## Open questions

- Do we want to present the SIM information (usage & connection info) all the
  time, or only when the user asks for it?
- For this case how do we define an interval for fetching? Is it okay for a user
  to get updates on data usage every hour or do we need to provide it more
  often?
