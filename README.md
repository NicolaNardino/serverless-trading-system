# Welcome to serveless-trading-system

It covers the front-to-back high-level architecture of a trading system, from when an order gets entered, from a Broker UI, to the trade settlement, passing through simulated Dark and Lit Pools matching engines. The focus is on the overall infrastructure rather than on the actual matching engines. 

It's a generalization of my previous project, [TradingMachine](https://github.com/NicolaNardino/TradingMachine).


Main technologies used:
- Node.js, Javascript ES6.
- AWS: Lambda & Lambda Layers, API Gateway, SNS, DynamoDB & DynamoDB Streams, S3, Parameter Store.

The gist of it is that all goes around a message bus: a pure pub/ sub serveless software architecture. 

## Software Architecture

![main-arch](https://user-images.githubusercontent.com/8766989/152656255-14ce7c58-77d2-41ef-88c8-ba5a312c7036.jpg)


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

![OrderFlow (1)](https://user-images.githubusercontent.com/8766989/152655833-91fd0277-7e5e-450b-85e0-9cd456b1deed.jpg)

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

### Dark & Lit Pools
While [Lit Pools](https://en.wikipedia.org/wiki/Lit_pool) are usually known by the broader audience, in fact, they're the commonly known Stock Exchanges, the same can't be said about [Dark Pools](https://en.wikipedia.org/wiki/Dark_pool).



## TODO

- Infra set-up by SAM or CDK.
- Replace SNS with EventBridge.
