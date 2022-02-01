# Welcome to serveless-trading-system

It covers the front-to-back high-level architecture of a trading system, from the time an order gets entered from a Broker UI to the trade settlement, passing through simulated Dark and Lit Pools matching engines. The focus is on the overall infrastructure rather than on the actual matchin engines.


Main technologies used:
- Node.js, Javascript ES6.
- Lambda & Lambda Layers.
- API Gateway.
- SNS.
- DynamoDB & DynamoDB Streams.
- S3.
- Parameter Store.


## Architecture Diagram

![serverless-trading-system](https://user-images.githubusercontent.com/8766989/152015724-f9530418-a5fc-40bd-ae73-7c5c452ab4fb.jpg)


## Order flow

an order get placed into the trading system through a POST endpoint, with the following structure:

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

And gets out so:

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
    "exchange": " 'EDGA'",
    "exchangeType": "LitPool",
    "tradeDate": "2022-01-31T17:41:35.619Z",
    "fee": "0.58",
    "settlementDate": "2022-01-31T17:41:39.192Z"
}
```

According to the following order flow:

![OrderFlow](https://user-images.githubusercontent.com/8766989/152015767-85af6dfb-f2b6-407d-a5de-6d4d9bfb1dce.jpg)


## Notes
By using Node.js ES6 modules, it's possible to let the Lamba wait for initialization, i.e., before the handler gets invoked:

```javascript
const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/darkpools']}))).Parameters.map(p => [p.Name, p.Value]));
```
See [here](https://aws.amazon.com/blogs/compute/using-node-js-es-modules-and-top-level-await-in-aws-lambda/).
