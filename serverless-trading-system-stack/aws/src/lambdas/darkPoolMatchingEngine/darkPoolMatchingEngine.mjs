import { getRandomArrayEntry, getRandom, getRandomBoolean, publishToSns, getParameters, eventBridgeClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = await getParameters(['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/darkpools', '/darkpool/dev/bus-type', '/darkpool/dev/event-bus-name']);
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');
const darkPools = paramValues.get('/darkpool/dev/darkpools').split(',');
const busType = paramValues.get('/darkpool/dev/bus-type');
const eventBusName = paramValues.get('/darkpool/dev/event-bus-name');

export async function handler(event) {
    const tradesAndNotMatchedWithinDarkPool = [];
    switch (busType) {
        case 'EVENT-BRIDGE':
            //console.log(event);
            tradesAndNotMatchedWithinDarkPool.push(...turnOrdersIntoTradesOrLitPoolsOrders(event));
            const params = {
                Entries: [
                    {
                        Source: "DarkPoolMatchingEngine",
                        EventBusName: eventBusName,
                        DetailType: "Trades",
                        Time: new Date(),
                        Detail: JSON.stringify({
                            PostTrade: "True",
                            Trades: tradesAndNotMatchedWithinDarkPool.filter(t => t.exchangeType === "DarkPool")
                        })
                    },
                    {
                        Source: "DarkPoolMatchingEngine",
                        EventBusName: eventBusName,
                        DetailType: "Trades",
                        Time: new Date(),
                        Detail: JSON.stringify({
                            PoolType: "Lit",
                            Trades: tradesAndNotMatchedWithinDarkPool.filter(t => t.notMatchedInDarkPool === "True")
                        })
                    }]
            };
            const result = await eventBridgeClient.send(new PutEventsCommand(params));
            console.log("Event sent to EventBridge with result:\n", result);
            break;
        case 'SNS':
            event.Records.forEach(record => tradesAndNotMatchedWithinDarkPool.push(...turnOrdersIntoTradesOrLitPoolsOrders(JSON.parse(record.Sns.Message))));
            await Promise.all([await publishToSns(orderDispatcherTopicArn, tradesAndNotMatchedWithinDarkPool.filter(t => t.exchangeType === "DarkPool"), {
                "PostTrade": {
                    "DataType": "String",
                    "StringValue": "True"
                }
            }), publishToSns(orderDispatcherTopicArn, tradesAndNotMatchedWithinDarkPool.filter(t => t.notMatchedInDarkPool === "True"), {
                "PoolType": {
                    "DataType": "String",
                    "StringValue": "Lit"
                }
            })]);
            break;
        default:
            console.log('Not a valid busType[SNS, EVENT-BRIDGE]: ', busType);
    }
    console.log("Trades ", tradesAndNotMatchedWithinDarkPool);

    return {
        statusCode: 200,
        body: {
            message: `Successfully matched ${tradesAndNotMatchedWithinDarkPool.length} order(s)`,
            trades: tradesAndNotMatchedWithinDarkPool
        }
    };
}

//randomly match order within the DarkPool. If not matched, forward it to LitPools.
function turnOrdersIntoTradesOrLitPoolsOrders(orders) {
    return orders.map(order => {
        if (getRandomBoolean())
            return {
                ...order,
                tradeId: randomUUID(),
                exchange: getRandomArrayEntry(darkPools),
                exchangeType: "DarkPool",
                tradeDate: new Date(),
                fee: getRandom(0, 1).toFixed(2),
                ...(order.type === "Market" ? { price: getRandom(100, 200).toFixed(2) } : {})
            };
        else
            return {
                ...order,
                notMatchedInDarkPool: "True"
            };
    });
}