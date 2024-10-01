# SIM Details

[![Test and Release](https://github.com/bifravst/sim-details/actions/workflows/test-and-release.yaml/badge.svg?branch=saga)](https://github.com/bifravst/sim-details/actions/workflows/test-and-release.yaml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![@commitlint/config-conventional](https://img.shields.io/badge/%40commitlint-config--conventional-brightgreen)](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

Provides usage information about SIM cards that have been shipped with Nordic
Semiconductor development kits.

Developed using [AWS CDK](https://aws.amazon.com/cdk) in
[TypeScript](https://www.typescriptlang.org/).

## Usage

### Basic usage

using [HTTPie](https://httpie.io/):

```bash
http https://api.sim-details.nordicsemi.cloud/2024-07-01/sim/<your SIM's ICCID>
```

Returns

```json
{
  "totalBytes": 10000000,
  "usedBytes": 0,
  "ts": "2024-07-01T12:11:43.066Z"
}
```

Using

```bash
http https://api.sim-details.nordicsemi.cloud/2024-07-01/sim/<your SIM's ICCID>/history?timespan=<timespan>
```

with one of the following timespans:

```
lastHour | lastDay | lastWeek  | lastMonth
```

Returns

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

for the last hour.

### Caching of data

Every hour we cache usage information about **active** SIMs. For Onomondo a SIM
is treated as **active** if it has been used that day. For Wireless Logic a SIM
is treated as **active** if it is in the database, meaning it has been
requested/updated within the last 30 days.

If you send a request for a SIM that is cached you will first get the cached
usage, and if the data is more than 5 minutes old we will fetch updated data in
the background. By sending the same request again you will get the updated data
once it is fetched from the issuers API.

If you have never used the SIM before there is no cached data. During the first
request you will get a 409 status code and no data. In the background we will
try to fetch the updated data usage from the issuers API. By sending the same
request again you will get the updated data once it is fetched from the issuers
API. If the SIM is not existing you will get a 404 status code in the second
request. If the SIM is not existing this will be cached for 30 days, and we will
not try to fetch new data from the issuer during this period.

If you send a request with a non valid ICCID you will get a 400 status code with
an explanation of why it didn't validate in the response body.

### Data history

For WL (Wireless Logic) we have a lambda
[getAllSimUsageWirelessLogic.ts](./getAllSimUsageWirelessLogic.ts) that runs
every 5 minutes for updating the DynamoDB value for the usage per active SIM.
For WL an active SIM means that it is in DynamoDB.

[getAllSimUsageWirelessLogic.ts](./getAllSimUsageWirelessLogic.ts) will fetch
the data usage from WL API every 5 minutes. This usage is then compared to the
previous value in DynamoDB (from our last fetch), and the difference between
those values is written to Timestream.

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
from Onomondo API, and then stored in Timestream. The usage in DynamoDB is also
updated.

### API Response

The API will return different status codes based on different scenarios:

| Status Code | Explanation                                                                                                                                   | Cache max-age |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 200         | OK. The request was successful and you should get the most recent data from cache. If data is older than 5 minutes, new data will be fetched. | 300           |
| 400         | Bad Request. The request parameters didn't validate.                                                                                          | 60            |
| 404         | Not Found. The SIM doesn't exist in the issuers API. This response will be cached for 30 days.                                                | 2592000       |
| 409         | Conflict. No information about SIM in cache. New data will be fetched from the issuers API.                                                   | 60            |
| 500         | Internal Error.                                                                                                                               | 0             |

## Installation in your AWS account

### Setup

[Provide your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-authentication.html).

### Install the dependencies

```bash
npm ci
```

### Run once

Configure API credentials:

```bash
aws ssm put-parameter --name /sim-details/onomondoKey --type String --value <Your Onomondo API Key>
aws ssm put-parameter --name /sim-details/wirelessLogicKey --type String --value <Your Wireless Logic API Key>
aws ssm put-parameter --name /sim-details/wirelessLogicClientId --type String --value <Your Wireless Logic CLIENT ID>
```

### Deploy

```bash
npx cdk bootstrap # if this is the first time you use CDK in this account
npx cdk deploy --all
```

## Continuous Deployment using GitHub Actions

After deploying the stack manually once,

- configure a GitHub Actions environment named `production`
- create the secret `AWS_ROLE` with the value
  `arn:aws:iam::<account ID>:role/<stack name>-cd` and a variable (use the
  `cdRoleArn` stack output)
- create the variable `AWS_REGION` with the value `<region>` (your region)
- create the variable `STACK_NAME` with the value `<stack name>` (your stack
  name)

to enable continuous deployment.

```bash
gh secret set AWS_ROLE --env production --body `arn:aws:iam::<account ID>:role/<stack name>-cd`
gh variable set AWS_REGION --env production --body <region>
gh variable set STACK_NAME --env production --body <stack name>
```

### Custom API domain

Optionally, a custom API domain can be configured.

For this, create a certificate for the domain name in the Certificate Manager of
the production account in the region of the deployment.

Create a role in the account that manages the domain name, to allow the the
production account to update the CNAME for the API domain with these permissions
(make sure to replace `<Hosted Zone ID>`, `<api domain name>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "route53:ChangeResourceRecordSets",
      "Resource": "arn:aws:route53:::hostedzone/<Hosted Zone ID>",
      "Condition": {
        "ForAllValues:StringEquals": {
          "route53:ChangeResourceRecordSetsNormalizedRecordNames": [
            "<api domain name>"
          ],
          "route53:ChangeResourceRecordSetsRecordTypes": ["CNAME"],
          "route53:ChangeResourceRecordSetsActions": ["UPSERT"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": "route53:ListHostedZonesByName",
      "Resource": "*"
    }
  ]
}
```

Then, for continuous deployment:

- create the variable `API_DOMAIN_NAME` with the name of the api domain, e.g.
  `api.hello.nordicsemi.cloud`
- create the secret `API_DOMAIN_ROUTE_53_ROLE_ARN` with the role ARN of the role
  that allows the production account to update the CNAME for the API domain.

```bash
gh variable set API_DOMAIN_NAME --env production --body api.sim-details.nordicsemi.cloud
gh secret set API_DOMAIN_ROUTE_53_ROLE_ARN --env production --body `arn:aws:iam::<account ID>:role/<role name>`
```
