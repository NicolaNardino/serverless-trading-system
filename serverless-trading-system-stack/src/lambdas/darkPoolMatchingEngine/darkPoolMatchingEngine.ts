import { EventBridgeEvent } from 'aws-lambda';

import { getRandomArrayEntry, getRandom, getRandomBoolean, getParameter, eventBridgeClient } from '/opt/nodejs/util/utils.js';
import { randomUUID, PutEventsCommand } from '/opt/nodejs/util/dependencies.js';

const darkPools = (await getParameter('/trading-system/dev/dark-pools')).split(',');
const eventBusName = process.env.eventBusName;
const marketDataServiceURL = process.env.fargateMarketDataServicesBaseURL;

export async function handler(event: EventBridgeEvent<string, Orders>) {
    console.log(JSON.stringify(event));
    const tradesAndNotMatchedWithinDarkPool = await turnOrdersIntoTradesOrLitPoolsOrders(event.detail.orders);
    const params = {
        Entries: [
            {
                Source: "DarkPoolMatchingEngine",
                EventBusName: eventBusName,
                DetailType: "Trades",
                Time: new Date(),
                Detail: JSON.stringify({
                    postTrade: "True",
                    trades: tradesAndNotMatchedWithinDarkPool.filter(t => t.notMatchedInDarkPool !== "True")
                })
            },
            {
                Source: "DarkPoolMatchingEngine",
                EventBusName: eventBusName,
                DetailType: "Trades",
                Time: new Date(),
                Detail: JSON.stringify({
                    poolType: "Lit",
                    trades: tradesAndNotMatchedWithinDarkPool.filter(t => t.notMatchedInDarkPool === "True")
                })
            }]
    };
    const result = await eventBridgeClient.send(new PutEventsCommand(params));
    console.log("Event sent to EventBridge with result:\n", result + "\n Containing following trades: ", tradesAndNotMatchedWithinDarkPool);
}

//randomly match order within the DarkPool. If not matched, forward it to LitPools.
async function turnOrdersIntoTradesOrLitPoolsOrders(orders: Order[]) {
    return await Promise.all(orders.map(async order => {
        if (getRandomBoolean())
            return {
                ...order,
                tradeId: randomUUID(),
                exchange: getRandomArrayEntry(darkPools),
                exchangeType: ExchangeType.DarkPool,
                tradeDate: new Date(),
                fee: getRandom(0, 1).toFixed(2),
                ...(order.type === Type.Market ? { price: getRandom(100, 200).toFixed(2) } : {})
            };
        else
            return {
                ...order,
                notMatchedInDarkPool: "True"
            };
    }));
}

interface Order {
    customerId: string;
    direction: Direction;
    ticker: string;
    type: Type;
    quantity: number;
    price: number;
    orderId: string;
    orderDate: string;
    split?: string;
    initialQuantity?: number;
    notMatchedInDarkPool?: string;
};

interface Orders {
    orders: Order[];
}

enum Direction { Buy, Sell };

enum Type { Market, Limit };

enum ExchangeType { LitPool, DarkPool }