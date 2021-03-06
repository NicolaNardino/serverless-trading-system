import { matchOrder, getRandomArrayEntry, getRandom, publishToSns, getParameters, eventBridgeClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = await getParameters(['/trading-system/dev/lit-pools', '/trading-system/dev/bus-type']);
const litPools = paramValues.get('/trading-system/dev/lit-pools').split(',');
const busType = paramValues.get('/trading-system/dev/bus-type'); //SNS or EventBridge
const eventBusName = process.env.eventBusName;
const marketDataServiceURL = process.env.fargateMarketDataServicesBaseURL;

export async function handler(event) {
    console.log(event);
    const trades = [];
    switch (busType) {
        case 'EVENT-BRIDGE':
            //event contains exactly the orders, due to a translation done in the EventBridge rule use to target this lambda: $.detail.Orders.
            trades.push(... await turnOrdersIntoTrades(event));
            const params = {
                Entries: [
                    {
                        Source: "LitPoolMatchingEngine",
                        EventBusName: eventBusName,
                        DetailType: "Trades",
                        Time: new Date(),
                        Detail: JSON.stringify({
                            postTrade: "True",
                            trades: trades
                        })
                    }]
            };
            const result = await eventBridgeClient.send(new PutEventsCommand(params));
            console.log("Event sent to EventBridge with result:\n", result);
            break;
        case 'SNS':
            await Promise.all(event.Records.map(async record => trades.push(...await turnOrdersIntoTrades(JSON.parse(record.Sns.Message)))));
            await publishToSns(event.Records[0].Sns.TopicArn, trades, {
                "postTrade": {
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

async function turnOrdersIntoTrades(orders) {
    return await Promise.all(orders.map(async order => {
        const randomExchange = getRandomArrayEntry(litPools);
        const randomFee = (randomExchange == "EBS" ? getRandom(1, 10).toFixed(2) : getRandom(0, 1).toFixed(2)); //yes, EBS (CH) is way more expensive than US exchanges.
        return {
            ...order,
            tradeId: randomUUID(),
            exchange: randomExchange,
            exchangeType: "LitPool",
            tradeDate: new Date(),
            fee: randomFee,
            ...(order.type === "Market" ? { price: (marketDataServiceURL !== 'xxx' ? (await matchOrder(order, marketDataServiceURL)).matchedPrice : getRandom(100, 200).toFixed(2)) } : {}),
        };
    }));
}