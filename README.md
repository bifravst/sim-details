# SIM Details

[![GitHub Actions](https://github.com/bifravst/sim-details/workflows/Test%20and%20Release/badge.svg)](https://github.com/bifravst/sim-details/actions/workflows/test-and-release.yaml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![@commitlint/config-conventional](https://img.shields.io/badge/%40commitlint-config--conventional-brightgreen)](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

Provides usage information about SIM cards that have been shipped with Nordic
Semiconductor development kits.

Developed using [AWS CDK](https://aws.amazon.com/cdk) in
[TypeScript](https://www.typescriptlang.org/).

## Installation in your AWS account

### Setup

[Provide your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-authentication.html).

### Install the dependencies

```bash
npm ci
```

### Run once

FIXME: Document how to configure API credentials

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

```bash
gh secret set AWS_ROLE --env production --body `arn:aws:iam::<account ID>:role/<stack name>-cd`
gh variable set AWS_REGION --env production --body <region>
gh variable set STACK_NAME --env production --body <stack name>
```

to enable continuous deployment.
