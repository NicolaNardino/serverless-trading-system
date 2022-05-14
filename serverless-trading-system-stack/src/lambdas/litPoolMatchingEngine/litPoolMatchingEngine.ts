import { EventBridgeEvent } from 'aws-lambda';
import { getRandomArrayEntry, getRandom, getParameter, eventBridgeClient } from '/opt/nodejs/util/utils.js';
import { randomUUID, PutEventsCommand } from '/opt/nodejs/util/dependencies.js';
import { Order, Trade, ExchangeType, Type } from '/opt/nodejs/util/types.js';

const litPools = (await getParameter('/trading-system/dev/lit-pools')).split(',');
const eventBusName = process.env.eventBusName;

export async function handler(event: EventBridgeEvent<string, Orders>): Promise<void> {
    console.log(JSON.stringify(event));
    const trades = await turnOrdersIntoTrades(event.detail.orders);
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
    console.log("Event sent to EventBridge with result:\n", result + "\n Containing following trades: ", trades);
}

async function turnOrdersIntoTrades(orders: Order[]) : Promise<Trade[]> {
    return await Promise.all(orders.map(async order => {
        const randomExchange = getRandomArrayEntry(litPools);
        const randomFee = (randomExchange == "EBS" ? +getRandom(1, 10).toFixed(2) : +getRandom(0, 1).toFixed(2)); //yes, EBS (CH) is way more expensive than US exchanges.
        return {
            ...order,
            tradeId: randomUUID(),
            tradeDate: new Date().toISOString(),
            exchange: randomExchange,
            exchangeType: ExchangeType.LitPool,
            fee: randomFee,
            price: (order.type === Type.Market ? +getRandom(100, 200).toFixed(2) : order.price)
        };
    }));
}

interface Orders {
    orders: Order[];
}
