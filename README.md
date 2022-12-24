# Welcome to serverless-trading-system

It covers the front-to-back high-level architecture of a trading system, from when an order gets entered, from a Broker UI, to the trade settlement, passing through simulated Dark and Lit Pools matching engines. The focus is on the overall infrastructure rather than on the actual matching engines. 

It's a generalization of my previous project, [TradingMachine](https://github.com/NicolaNardino/TradingMachine).

Main technologies used:
- Node.js, TypeScript.
- AWS: Lambda & Lambda Layers, Step Functions, API Gateway, EventBridge, SNS, DynamoDB & DynamoDB Streams, S3, Parameter Store. Configuration and deployment of all resources by a SAM template.

The code layer had initially been built with Javascript ES6, and later migrated to TypeScript. The left-over JavaScript ES6 code, containing some features not migrated to TypeScript, is within the folder serverless-trading-system-stack/src/lambdas/legacy.

## Software Architecture

![ArchWithStepFunctions](https://user-images.githubusercontent.com/8766989/196050274-03998007-d187-425d-9393-9cd0ebbfdef3.jpg)

Initially, it was designed with SNS as message bus, then replaced with EventBridge. The application is able to work with both message buses, in fact, it's possible to switch between them by the means of a AWS Systems Manager Parameter Store param, /serverless-trading-system/dev/bus-type, whose values can be SNS or EVENT-BRIDGE. For straight pub/ sub use cases, the EventBridge client/ service programming model matches almost 1:1 the SNS one, for instance: 

- SNS subscriptions --> EventBridge rules.
- Similar client-side API.

With the EventBridge, source events can be modified before getting to consumers, for instance, by removing the event envelope, so to have a boilerplate-free events retrieval code, for instance, in the target Lambdas. 

Rule example:
```json
{
  "detail-type": ["Orders"],
  "source": ["SmartOrderRouter"],
  "detail": {
    "PoolType": ["Dark"]
  }
}
```
Part of the matched event target deliver:
```unix![market-data-manager-step-function-api (1)](https://user-images.githubusercontent.com/8766989/198897598-678ca9dc-d806-48fe-b375-def561d742bd.jpg)
$.detail.orders
```
Where detail is the event envelope. In this way, only the array of orders will be delivered to the target. Compare that with the boilerplate code require in a SNS subscriber.

### Step Functions

Step Functions are used to deal with retrieving market data from Yahoo Finance. 
Specifically, one is used in the context of the order workflow to retriave market data (quote summary and historical data) for order tickers. This one, triggered by an EventBridge event, uses a Parallel state branching out two lambdas, each specialized either in quote summary or historical data. See the overall software architecture.
 
The other one, triggered by an API Gateway post end-point, uses a single lambda to retrieve both quote summary and historical data. It gets executed in parallel via a Map state. The overall execution is asynchronous, given that the Step Function uses a standard workflow, which contrarily to the Express one, doesn't allow synch executions. In order to allow further processing, at the end of each successful market data retrieval, the state machine emits  an EventBridge event. 
In case of failure while retrieving market data, it enters in a wait state (waitForTaskToken) and delegates the error management to a Lambda function outside the state machine. When that finishes it calls SFNClient.SendTaskSuccessCommand(...taskToken) to let the state machine resume and complete its execution.

![market-data-manager-step-function-api drawio (1)](https://user-images.githubusercontent.com/8766989/209447628-524fea9b-a945-4813-b299-872f2f73d3ea.png)


## Order flow

Orders get into the trading system through a POST endpoint, with the following structure:

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

And get out so:

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

According to the following order flow:

![OrderFlow (4)](https://user-images.githubusercontent.com/8766989/153770432-69f151e2-face-45de-8d72-0b5cc5551314.jpg)

## DynamoDB Data Layer

There are 3 entity tpyes:
- Customers, CUST#cust-id: their initial data get entered at system initialization time, then enriched with stats during the data aggregation step.
      ![customer-init](https://user-images.githubusercontent.com/8766989/152694585-c5ab7037-0954-4a8a-af28-4fdd046368d5.png)
      At data aggregation time, new attributes are added/ updated (TotalCommissionPaid, NrTrades, TotalAmountInvested, Updated) and exixting ones (RemainingFund) updated.
      ![customer-update](https://user-images.githubusercontent.com/8766989/152694587-a1a6fcf4-198e-4418-80cf-3435073fff80.png)
     
- Trades, TRADE#trade-date#trade-id: they are in a 1:n relationship with Customers.
      ![trade](https://user-images.githubusercontent.com/8766989/152694589-f1440cde-2383-49b2-b55a-26c0a0022479.png)
      
- Tickers, TICKER#ticker-id: they are an outcome of the trade aggregation step, where trade data get aggregated at ticker level.
      ![ticker](https://user-images.githubusercontent.com/8766989/152694588-a1a7e492-5139-4dc6-9e4e-9422eaad8e47.png)

## Notes

### Node.js ES6 modules
By using Node.js ES6 modules, it's possible to let the Lamba wait for its initialization to complete, i.e., before the handler gets invoked:

```javascript
const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/darkpools']}))).Parameters.map(p => [p.Name, p.Value]));
...
export async function handler(event) {...}
```
See [here](https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/).

### Lambda Proxy Integration
The 2 API Gateways, SmartOrderRouter-API & DataExtractor-API, use the Lamba Proxy Integration, i.e., /{proxy+}. 

![data-access-layer](https://user-images.githubusercontent.com/8766989/152656258-b3a5b64c-20f5-485b-8bf5-2d741e7635fa.jpg)

### Lambda Layer
![lambda-layers](https://user-images.githubusercontent.com/8766989/152656253-62478427-945a-48e4-b36b-ce0f648f50e0.jpg)

In a real-world project, I'd have split the common code in multiple layers.

### Market Data
Yahoo Finance is the data source for market data, ticker (quote) summary and historical data. 
I'm targeting to assess customers' portfolios at given dates.

### Dark & Lit Pools
While [Lit Pools](https://en.wikipedia.org/wiki/Lit_pool) are usually known by the broader audience, in fact, they're the commonly known Stock Exchanges, the same can't be said about [Dark Pools](https://en.wikipedia.org/wiki/Dark_pool).



## TODO

- ~~JavaScript to TypeScript conversion.~~
- Manage order workflow through state machines/ step functions.
- Add OpenAPI specs.
