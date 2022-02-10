import { getRandomArrayEntry, getRandom, publishToSns, snsClient, ssmClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, GetParametersCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/litpools', '/darkpool/dev/bus-type', '/darkpool/dev/event-bus-name']}))).Parameters.map(p => [p.Name, p.Value]));
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');
const litPools = paramValues.get('/darkpool/dev/litpools').split(',');
const busType = paramValues.get('/darkpool/dev/bus-type'); //SNS or EventBridge

export async function handler(event) {
    const trades = [];
    if (busType === 'EVENT-BRIDGE') {
        console.log(event);
        //TODO...
    }
    else {
    event.Records.forEach(record => {
        trades.push(...JSON.parse(record.Sns.Message).map(order => {
            const randomExchange = getRandomArrayEntry(litPools);
            const randomFee = (randomExchange == "EBS" ? getRandom(1, 10).toFixed(2) : getRandom(0, 1).toFixed(2)); //yes, EBS (CH) is way more expensive than US exchanges.
            return { ...order, 
                    tradeId : randomUUID(), 
                    exchange : randomExchange,
                    exchangeType : "LitPool",
                    tradeDate : new Date(),
                    fee : randomFee,
                    ...(order.type==="Market" ? { price : getRandom(100, 200).toFixed(2) } : {}),
            };
        }));
    });
    console.log(trades);
    await publishToSns(snsClient, orderDispatcherTopicArn, trades, {"PostTrade": {
                "DataType": "String",
                "StringValue": "True"
            }});    
    }
    return {
        statusCode: 200,
        body: {
            message: `Successfully matched ${trades.length} order(s)`,
            trades: trades
        }
    };
}