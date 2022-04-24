import { EventBridgeEvent } from 'aws-lambda';
// @ts-ignore
import { matchOrder, getRandomArrayEntry, getRandom, getParameter, eventBridgeClient } from '/opt/nodejs/src/utils.js';
// @ts-ignore
import { randomUUID, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const litPools = (await getParameter('/trading-system/dev/lit-pools')).split(',');
const eventBusName = process.env.eventBusName;
const marketDataServiceURL = process.env.fargateMarketDataServicesBaseURL;

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

async function turnOrdersIntoTrades(orders: Order[]) {
    return await Promise.all(orders.map(async order => {
        const randomExchange = getRandomArrayEntry(litPools);
        const randomFee = (randomExchange == "EBS" ? getRandom(1, 10).toFixed(2) : getRandom(0, 1).toFixed(2)); //yes, EBS (CH) is way more expensive than US exchanges.
        return {
            ...order,
            tradeId: randomUUID(),
            tradeDate: new Date(),
            exchange: randomExchange,
            exchangeType: ExchangeType.LitPool,
            fee: randomFee,
            ...(order.type === Type.Market ? { price: (marketDataServiceURL !== 'xxx' ? (await matchOrder(order, marketDataServiceURL)).matchedPrice : getRandom(100, 200).toFixed(2)) } : {})
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
    notMatchedInDarkPool?: string
};

interface Orders {
    orders: Order[];
}

enum Direction { Buy, Sell };

enum Type { Market, Limit };

enum ExchangeType { LitPool, DarkPool }
