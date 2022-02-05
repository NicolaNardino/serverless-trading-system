# Welcome to serveless-trading-system

It covers the front-to-back high-level architecture of a trading system, from the time an order gets entered from a Broker UI to the trade settlement, passing through simulated Dark and Lit Pools matching engines. The focus is on the overall infrastructure rather than on the actual matchin engines.


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

Infra set-up by via SAM or CDK.
