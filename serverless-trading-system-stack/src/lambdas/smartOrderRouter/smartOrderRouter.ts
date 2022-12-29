import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

import { splitBy, publishToSns, getParameters, getRandom, ddbDocClient, eventBridgeClient, sfnClient } from '/opt/nodejs/util/utils.js';
import { randomUUID, GetCommand, PutEventsCommand, StartExecutionCommand } from '/opt/nodejs/util/dependencies.js';
import { EntryOrder, Order, Type } from '/opt/nodejs/util/types.js';

const paramValues = await getParameters(['/trading-system/dev/dark-pool-tickers-list', '/trading-system/dev/bus-type']);
const darkPoolTickers = paramValues.get('/trading-system/dev/dark-pool-tickers-list').split(',');
const busType = paramValues.get('/trading-system/dev/bus-type'); //SNS or EventBridge
const tradesStoreTableName = process.env.tradesStoreTableName;
const ordersDispatcherTopicArn = process.env.ordersDispatcherTopicArn;
const eventBusName = process.env.eventBusName;
const marketDataStepFunctionInvokeMode = process.env.marketDataStepFunctionInvokeMode;
const parallelMarketDataManagerStateMachine = process.env.parallelMarketDataManagerStateMachine;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    try {
        let orders: EntryOrder[] = [];
        if (event.body)
            orders = JSON.parse(event.body);
        await requestMarketData([...new Set(orders.map(o => o.ticker))]);
        const checkedOrders = await creditCheck(orders);
        orders = checkedOrders.validOrders;
        const invalidOrders = checkedOrders.invalidOrders;
        const darkPoolOrders = splitBlockOrders(addOrderIdAndDate(orders.filter(order => darkPoolTickers.includes(order.ticker))), 1000);
        const litPoolOrders = splitBlockOrders(addOrderIdAndDate(orders.filter(order => !darkPoolTickers.includes(order.ticker))), 1000);
        await publishToSNSOrEventBridge(invalidOrders, darkPoolOrders, litPoolOrders);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully received ${orders.length} order(s)`,
                validOrders: orders,
                invalidOrders: invalidOrders
            })
        };
    }
    catch (e) {
        return {
            statusCode: 500,
            body: JSON.stringify(e.message)
        };
    }
}

/**
 * This fire-and-forget function will ask market data, for the passed-in list of tickers, by triggering 2 (different) Step Functions in 2 different ways:
 *    1. De-coupling by EventBridge: an event gets sent to an Event Bus, with a Step Function subscriber, i.e., the Step Function gets triggered by an Event Bus rule.
 *    2. Direct call: by using the Step Function APIs.
 * */ 
const requestMarketData = async (tickers: string[]) => {
    switch(marketDataStepFunctionInvokeMode) {
        case "EventBridge": {
            await eventBridgeClient.send(new PutEventsCommand({
                Entries: [
                    {
                        Source: "SmartOrderRouter",
                        EventBusName: eventBusName,
                        DetailType: "MarketData",
                        Time: new Date(),
                        Detail: JSON.stringify({
                            tickers: tickers
                        })
                    }]
            }));
            break;
        }
        case "StepFunctionAPIs": {
            //adapt plain tickers list to the state machine expected input. In fact, below invoked Step Funciton was initally designed to be triggered through an API Gateway end-point.
            const stateMachineInput = { detail: { tickers: tickers.map(t => {return {ticker : t}}) } };
            await sfnClient.send(new StartExecutionCommand({stateMachineArn: parallelMarketDataManagerStateMachine, input: JSON.stringify(stateMachineInput)}));
            break;
        }
        default: 
            throw new Error('Unexpected market data Step Function invoke mode: ' + marketDataStepFunctionInvokeMode);
    }
    console.log('Sent market data request for ', tickers, ', marketDataStepFunctionInvokeMode: ', marketDataStepFunctionInvokeMode);
}

const creditCheck = async (orders: EntryOrder[]) => {
    const validOrders = [];
    const invalidOrders = [];
    for (const order of orders) {
        const orderPrice = (order.type === Type.Market ? getRandom(100, 200) : order.price);
        const potentialTradeValue = (orderPrice * order.quantity);
        //get the remaining funds available to the customer.
        const params = {
            TableName: tradesStoreTableName,
            Key: {
                PK: "CUST#" + order.customerId,
                SK: "CUST#" + order.customerId
            },
            ProjectionExpression: "RemainingFunds"
        };
        const { RemainingFunds: rm } = (await ddbDocClient.send(new GetCommand(params))).Item;
        if (rm > potentialTradeValue) //for the sake of simplification, exclude the transaction fee.
            validOrders.push(order);
        else {
            invalidOrders.push(order);
            console.log("Not enough funds to execute order:", order);
        }
    }
    return { validOrders: validOrders, invalidOrders: invalidOrders };
};

const addOrderIdAndDate = (orders: EntryOrder[]) : Order[] => {
    return orders.map(order => {
        return { ...order, orderId: randomUUID(), orderDate: new Date().toISOString() };
    });
};

const splitBlockOrders = (orders: Order[], splitSize: number) : Order[] => {
    const splitOrders: Order[] = [];
    orders.forEach(order => {
        if (order.quantity <= splitSize)
            splitOrders.push(order);
        else
            splitBy(order.quantity, splitSize).forEach((orderSplitQuantity: number) => splitOrders.push({ ...order, quantity: orderSplitQuantity, initialQuantity: order.quantity, split: true }));
    });
    return splitOrders;
};

async function publishToSNSOrEventBridge(invalidOrders: EntryOrder[], darkPoolOrders: Order[], litPoolOrders: Order[]) {
    switch (busType) {
        case 'EVENT-BRIDGE':
            const result = await eventBridgeClient.send(new PutEventsCommand({
                Entries: buildEventBridgeOrders(invalidOrders, darkPoolOrders, litPoolOrders)
            }));
            console.log("Event sent to EventBridge with result:\n", result);
            break;
        case 'SNS':
            await Promise.all([publishToSns(ordersDispatcherTopicArn, litPoolOrders, {
                "poolType": {
                    "DataType": "String",
                    "StringValue": "Lit"
                }
            }), publishToSns(ordersDispatcherTopicArn, darkPoolOrders, {
                "poolType": {
                    "DataType": "String",
                    "StringValue": "Dark"
                }
            })]);
            if (invalidOrders.length > 0)
                await publishToSns(ordersDispatcherTopicArn, invalidOrders, {
                    "invalidOrders": {
                        "DataType": "String",
                        "StringValue": "CreditCheck"
                    }
                });
            break;
        default:
            console.log('Not a valid busType[SNS, EVENT-BRIDGE]: ', busType);
    }
}

function buildEventBridgeOrders(invalidOrders: EntryOrder[], darkPoolOrders: Order[], litPoolOrders: Order[]) {
    const entries: {
        Source: string;
        EventBusName: string;
        DetailType: string;
        Time: Date;
        Detail: string;
    }[] = [];
    if (darkPoolOrders.length > 0)
        entries.push({
            Source: "SmartOrderRouter",
            EventBusName: eventBusName,
            DetailType: "Orders",
            Time: new Date(),
            Detail: JSON.stringify({//EventBridge doesn't allow to send straight arrays as Detail's content, although the docs say that it's sufficient to be a valid json object :), so I've to wrap the array with an attribute.
                poolType: "Dark",
                orders: darkPoolOrders
            })
        });
    if (litPoolOrders.length > 0)
        entries.push({
            Source: "SmartOrderRouter",
            EventBusName: eventBusName,
            DetailType: "Orders",
            Time: new Date(),
            Detail: JSON.stringify({
                poolType: 'Lit',
                orders: litPoolOrders
            })
        });
    if (invalidOrders.length > 0)
        entries.push({
            Source: "SmartOrderRouter",
            EventBusName: eventBusName,
            DetailType: "Orders",
            Time: new Date(),
            Detail: JSON.stringify({
                invalidOrders: 'CreditCheck',
                orders: invalidOrders
            })
        });
    return entries;
}