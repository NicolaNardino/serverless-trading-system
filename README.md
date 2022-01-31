# Welcome to Aserveless-trading-system

It covers the front-to-back high-level architecture of a trading system, from the time an order gets entered from a Broker UI to the trade settlement, passing through simulated Dark and Lit Pools matching engines. The focus is on the overall infrastructure rather than on the actual matchin engines.

It's all AWS serveless (Lambda, API GW, SNS, DynamoDB and DynamoDB Streams, S3, Parameter Store and etc...), with Node.js Javascript ES6 modules.

![serverless-trading-system](https://user-images.githubusercontent.com/8766989/151840529-edcfc0ec-da1c-4abb-8415-ab588a371bdd.jpg)

## Order flow
Orders enter into the system with the following structure:

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
