# serverless-trading-system

A front-to-back trading system architecture built on AWS serverless services. It follows an order from entry through a broker API, smart order routing, simulated dark and lit pool matching engines, and settlement, down to post-trade aggregation and analytics. The focus is the overall infrastructure, not the matching engines themselves, which are deliberately simple.

It generalises my earlier, on-premises project, [TradingMachine](https://github.com/NicolaNardino/TradingMachine).

## Tech stack

- **Language:** TypeScript on Node.js (ES modules, top-level `await`)
- **Compute:** AWS Lambda and Lambda Layers, plus one containerised Express service
- **Orchestration:** AWS Step Functions
- **Messaging:** Amazon EventBridge (custom bus), with Amazon SNS as a switchable alternative
- **APIs:** Amazon API Gateway (REST and HTTP APIs, Lambda proxy integration, direct Step Functions integration)
- **Data:** Amazon DynamoDB with DynamoDB Streams, Amazon S3
- **Configuration:** AWS Systems Manager Parameter Store
- **Infrastructure as code:** a single AWS SAM template
- **Market data:** Yahoo Finance via [`yahoo-finance2`](https://github.com/gadicc/node-yahoo-finance2)

The code was first written in JavaScript (ES6) and later migrated to TypeScript. Features that were not migrated remain in [`serverless-trading-system-stack/src/lambdas/legacy`](serverless-trading-system-stack/src/lambdas/legacy) and are deployed alongside as `*Legacy` functions.

## Architecture

![Architecture with Step Functions](https://user-images.githubusercontent.com/8766989/196050274-03998007-d187-425d-9393-9cd0ebbfdef3.jpg)

### Components

| Lambda | Trigger | Role |
|---|---|---|
| `SmartOrderRouter` | API Gateway (`SmartOrderRouterAPI`) | Accepts orders, requests market data for their tickers, runs a credit check, splits orders into blocks of at most 1,000 shares and routes each child order to a dark or lit pool. |
| `DarkPoolMatchingEngine` / `LitPoolMatchingEngine` | EventBridge rule (or SNS) | Simulated matching engines that turn orders into trades. |
| `PostTradeProcessor` | EventBridge rule (or SNS) | Settles trades, stores them in DynamoDB and S3, and publishes a trades event. |
| `TradesDataAggregator` | DynamoDB Stream | Updates customer statistics, per-ticker aggregates and P&L. |
| `TradesStorageAnalyzer` | S3 `ObjectCreated` | Inspects the metadata of each trade file written to S3. |
| `AvailableFundsRaiser` | EventBridge rule (or SNS) | Raises a customer's available funds when the credit check fails. |
| `DataExtractor` | API Gateway (`DataExtractorAPI`) | Read API over customers and trades. |
| `GetAndDeleteQuoteSummary` | API Gateway (`MarketDataAPI`) | `GET` / `DELETE /quote-summary/{ticker}` |
| Market data Lambdas | Step Functions | See [Step Functions](#step-functions). |

The [`containers/market-data-services`](containers/market-data-services) Express service (`POST /matcher/order`, port 3244) provides a random matched price to the legacy matching engines and is meant to run on AWS Fargate.

### Message bus: EventBridge or SNS

The system was first built with SNS as its message bus, then moved to EventBridge. Both still work: the Parameter Store parameter `/trading-system/dev/bus-type` selects the bus, with values `SNS` or `EVENT-BRIDGE`.

For straight publish/subscribe, the EventBridge programming model maps almost one-to-one onto SNS:

- SNS subscriptions become EventBridge rules.
- The client-side APIs are very similar.

EventBridge can also reshape an event before it reaches a consumer, for instance by stripping the envelope so target Lambdas need no unwrapping code. Rule example:

```json
{
  "detail-type": ["Orders"],
  "source": ["SmartOrderRouter"],
  "detail": {
    "PoolType": ["Dark"]
  }
}
```

The rule target is configured with this input path:

```
$.detail.orders
```

`detail` is the event envelope, so only the array of orders reaches the target. With SNS, every subscriber has to unwrap the message itself.

### Step Functions

Two state machines retrieve market data from Yahoo Finance.

**Order-workflow state machine** (`MarketDataManagerStateMachine`). Triggered by an EventBridge event, it uses a `Parallel` state that branches to two Lambdas, one for quote summaries and one for historical data.

**Market data manager state machine** (`MarketDataManagerParallelStateMachine`). It can be started from an HTTP API `POST /` endpoint integrated directly with Step Functions, or through the Step Functions API, which lets the order workflow use it too. A `Map` state retrieves quote summary and historical data for each ticker in parallel through a single Lambda. As a standard (not express) workflow it runs asynchronously, so it emits an EventBridge event after each successful retrieval to allow further processing.

`SmartOrderRouter` chooses between the two with its `marketDataStepFunctionInvokeMode` environment variable (`EventBridge` or `StepFunctionAPIs`).

When historical data cannot be retrieved, the state machine pauses in a `waitForTaskToken` state and hands error handling to a Lambda outside the state machine. When that Lambda finishes, it calls `SendTaskSuccessCommand` with the task token, and the state machine resumes and completes. The state definition passes the token to the Lambda in its payload:

```json
"No historical data retrieved": {
  "Type": "Task",
  "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
  "Parameters": {
    "Payload": {
      "input.$": "$",
      "taskToken.$": "$$.Task.Token"
    },
    "FunctionName": "${NoHistoricalDataRetrievedLambda}"
  },
  "End": true
}
```

![Market data manager state machine](https://user-images.githubusercontent.com/8766989/209447628-524fea9b-a945-4813-b299-872f2f73d3ea.png)

![Market data manager Step Functions API](https://user-images.githubusercontent.com/8766989/198897598-678ca9dc-d806-48fe-b375-def561d742bd.jpg)

## Order flow

Orders enter the system through a `POST /orders` endpoint:

```json
{
  "customerId": "000002",
  "direction": "Buy",
  "ticker": "COIN",
  "type": "Limit",
  "quantity": 8614,
  "price": "161.90"
}
```

and leave it as settled trades:

```json
{
  "customerId": "000002",
  "direction": "Buy",
  "ticker": "COIN",
  "type": "Limit",
  "quantity": 1000,
  "price": "161.90",
  "orderId": "a62f7393-8d7e-46f7-a014-222e286c092b",
  "orderDate": "2022-01-31T17:41:34.884Z",
  "initialQuantity": 8614,
  "split": "Yes",
  "tradeId": "e518d027-3cea-45f0-b661-e56b71b0dfa5",
  "exchange": "EDGA",
  "exchangeType": "LitPool",
  "tradeDate": "2022-01-31T17:41:35.619Z",
  "fee": "0.58",
  "settlementDate": "2022-01-31T17:41:39.192Z"
}
```

Here the original order of 8,614 shares was split, and this child order of 1,000 shares filled on the EDGA lit pool. The full flow:

![Order flow](https://user-images.githubusercontent.com/8766989/153770432-69f151e2-face-45de-8d72-0b5cc5551314.jpg)

Routing is driven by Parameter Store lists: `/trading-system/dev/dark-pool-tickers-list` names the tickers sent to dark pools, and `/trading-system/dev/dark-pools` and `/trading-system/dev/lit-pools` list the venues.

## DynamoDB data layer

A single table (`TradesStore`) with a generic `PK`/`SK` key holds three entity types:

- **Customers** (`CUST#<customer-id>`). Seeded at system initialisation, then enriched during trade aggregation.

  ![Customer at initialisation](https://user-images.githubusercontent.com/8766989/152694585-c5ab7037-0954-4a8a-af28-4fdd046368d5.png)

  Aggregation adds or updates `TotalCommissionPaid`, `NrTrades`, `TotalAmountInvested` and `Updated`, and updates `RemainingFund`.

  ![Customer after aggregation](https://user-images.githubusercontent.com/8766989/152694587-a1a6fcf4-198e-4418-80cf-3435073fff80.png)

- **Trades** (`TRADE#<trade-date>#<trade-id>`), one-to-many with customers. The date prefix in the sort key allows querying a customer's trades by date with `begins_with`.

  ![Trade](https://user-images.githubusercontent.com/8766989/152694589-f1440cde-2383-49b2-b55a-26c0a0022479.png)

- **Tickers** (`TICKER#<ticker>`), produced by the aggregation step, which rolls trades up to ticker level.

  ![Ticker](https://user-images.githubusercontent.com/8766989/152694588-a1a7e492-5139-4dc6-9e4e-9422eaad8e47.png)

## APIs

| API | Endpoint | Purpose |
|---|---|---|
| `SmartOrderRouterAPI` | `POST /orders` | Submit an array of orders |
| `DataExtractorAPI` | `GET /customers/{customerId}` | Customer record and statistics |
| `DataExtractorAPI` | `GET /trades/{customerId}?tradeDate=YYYY-MM-DD` | A customer's trades for a date |
| `MarketDataAPI` | `GET` / `DELETE /quote-summary/{ticker}` | Read or remove a cached quote summary |
| Market data manager HTTP API | `POST /` | Start the market data state machine |

`SmartOrderRouterAPI` and `DataExtractorAPI` use Lambda proxy integration (`/{proxy+}`), so routing happens inside the function:

![Data access layer](https://user-images.githubusercontent.com/8766989/152656258-b3a5b64c-20f5-485b-8bf5-2d741e7635fa.jpg)

## Project structure

```
serverless-trading-system-stack/
  template.yaml                 SAM template: every AWS resource
  src/lambdas/                  One folder per Lambda (TypeScript)
  src/lambdas/legacy/           Features not yet migrated from JavaScript
  src/layers/common/            Shared Lambda Layer: AWS clients, types, market data manager
  src/resources/stateMachines/  Step Functions definitions (ASL)
  src/resources/various/        OpenAPI definition of the market data manager HTTP API
client/                         TypeScript client and Jest scripts to post random orders and query trades
containers/market-data-services/  Express service and Dockerfile for Fargate
```

## Build and deploy

Prerequisites: an AWS account, the [AWS CLI](https://aws.amazon.com/cli/), the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) and Node.js.

```bash
cd serverless-trading-system-stack
npm install
npm run build          # tsc: src/ -> dist/, which the SAM template points at
sam build
sam deploy --guided    # first time; afterwards just: sam deploy
```

The template parameters (table, bucket, event bus and topic names, plus `FargateMarketDataServicesBaseURL`) all have defaults, except the Fargate URL, which is only needed by the legacy matching engines.

To exercise a deployed stack, the client reads its API URL and key from `client/src/sandbox/constants.ts`, which is git-ignored and has to be created locally:

```bash
cd client
npm install
npm test               # Jest: post random orders, fetch customer trades
```

## Notes

### Top-level await in Lambda

With Node.js ES modules, a Lambda can finish its initialisation before the handler is first invoked:

```typescript
const paramValues = new Map(
  (await ssmClient.send(new GetParametersCommand({ Names: ['/trading-system/dev/bus-type', '/trading-system/dev/dark-pools'] })))
    .Parameters!.map(p => [p.Name!, p.Value!])
);

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // ...
}
```

Initialisation then runs once per execution environment rather than on every request. See [Using Node.js ES modules and top-level await in AWS Lambda](https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/).

### Lambda Layer

![Lambda Layers](https://user-images.githubusercontent.com/8766989/152656253-62478427-945a-48e4-b36b-ce0f648f50e0.jpg)

All shared code sits in one layer for simplicity. A real-world project would split it into several.

### Market data

Yahoo Finance provides quote summaries and historical prices. The goal is to value customers' portfolios at given dates.

### Dark and lit pools

[Lit pools](https://en.wikipedia.org/wiki/Lit_pool) are the familiar public stock exchanges, where orders are visible before execution. [Dark pools](https://en.wikipedia.org/wiki/Dark_pool) are private venues where orders are hidden until executed, typically used for large block trades to limit market impact.

## Roadmap

- [x] Migrate from JavaScript to TypeScript
- [ ] Manage the whole order workflow with Step Functions
- [ ] OpenAPI specifications for every API

## Status

This is a learning project, last developed in early 2023. The Lambdas target the `nodejs16.x` runtime, which AWS has since deprecated, so a fresh deployment needs the runtime in `template.yaml` raised to a supported version (for example `nodejs20.x` or later). The unofficial Yahoo Finance API it relies on can also change without notice.
