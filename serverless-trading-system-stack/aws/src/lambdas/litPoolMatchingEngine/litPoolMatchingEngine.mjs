import { getRandomArrayEntry, getRandom, publishToSns, getParameters, eventBridgeClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = await getParameters(['/trading-system/dev/lit-pools', '/trading-system/dev/bus-type']);
const litPools = paramValues.get('/trading-system/dev/lit-pools').split(',');
const busType = paramValues.get('/trading-system/dev/bus-type'); //SNS or EventBridge
const eventBusName = process.env.eventBusName;

export async function handler(event) {
    console.log(event);
    const trades = [];
    switch (busType) {
        case 'EVENT-BRIDGE':
            //event contains exactly the orders, due to a translation done in the EventBridge rule use to target this lambda: $.detail.Orders.
            trades.push(...turnOrdersIntoTrades(event));
            const params = {
                Entries: [
                    {
                        Source: "LitPoolMatchingEngine",
                        EventBusName: eventBusName,
                        DetailType: "Trades",
                        Time: new Date(),
                        Detail: JSON.stringify({
                            PostTrade: "True",
                            Trades: trades
                        })
                    }]
            };
            const result = await eventBridgeClient.send(new PutEventsCommand(params));
            console.log("Event sent to EventBridge with result:\n", result);
            break;
        case 'SNS':
            event.Records.forEach(record => trades.push(...turnOrdersIntoTrades(JSON.parse(record.Sns.Message))));
            await publishToSns(event.Records[0].Sns.TopicArn, trades, {
                "PostTrade": {
                    "DataType": "String",
                    "StringValue": "True"
                }
            });
            break;
        default:
            console.log('Not a valid busType[SNS, EVENT-BRIDGE]: ', busType);
    }
    console.log("Trades ", trades);

    return {
        statusCode: 200,
        body: {
            message: `Successfully matched ${trades.length} order(s)`,
            trades: trades
        }
    };
}

function turnOrdersIntoTrades(orders) {
    return orders.map(order => {
        const randomExchange = getRandomArrayEntry(litPools);
        const randomFee = (randomExchange == "EBS" ? getRandom(1, 10).toFixed(2) : getRandom(0, 1).toFixed(2)); //yes, EBS (CH) is way more expensive than US exchanges.
        return {
            ...order,
            tradeId: randomUUID(),
            exchange: randomExchange,
            exchangeType: "LitPool",
            tradeDate: new Date(),
            fee: randomFee,
            ...(order.type === "Market" ? { price: getRandom(100, 200).toFixed(2) } : {}),
        };
    });
}