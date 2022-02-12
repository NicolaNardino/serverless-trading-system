import { publishToSns, ddbDocClient, snsClient, ssmClient, eventBridgeClient, getRandom } from '/opt/nodejs/src/utils.js';
import { randomUUID, GetParametersCommand, GetCommand, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/darkpool-tickers-list', 
'/darkpool/dev/bus-type', '/darkpool/dev/event-bus-name']}))).Parameters.map(p => [p.Name, p.Value]));
const darkPoolTickers = paramValues.get('/darkpool/dev/darkpool-tickers-list').split(',');
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');
const busType = paramValues.get('/darkpool/dev/bus-type'); //SNS or EventBridge
const eventBusName = paramValues.get('/darkpool/dev/event-bus-name');

export async function handler(event) {
    try {
        let orders = [];
        if (event.body)
            orders = JSON.parse(event.body);
        const checkedOrders = await creditCheck(orders, ddbDocClient);
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

const creditCheck = async (orders, ddbDocClient) => {
    const validOrders = [];
    const invalidOrders = [];
    for (const order of orders) {
        const orderPrice = (order.type === "Market" ? getRandom(100, 200).toFixed(2) : order.price);
        const potentialTradeValue = (orderPrice * order.quantity);
        //get the remaining funds available to the customer.
        const params = {
            TableName: "trades",
            Key: {
                PK: "CUST#" + order.customerId,
                SK: "CUST#" + order.customerId
            },
            ProjectionExpression: "RemainingFunds"
        };
        const { RemainingFunds: rm } = (await ddbDocClient.send(new GetCommand(params))).Item;
        //console.log("rm", rm, "potential", potentialTradeValue, "price", orderPrice, "quantity", order.quantity);
        if (rm > potentialTradeValue) //for the sake of simplification, exclude the transaction fee.
            validOrders.push(order);
        else {
            invalidOrders.push(order);
            console.log("Not enough funds to execute order:", order);
        }
    }
    return { validOrders: validOrders, invalidOrders: invalidOrders };
};

const addOrderIdAndDate = orders => {
    return orders.map(order => {
        return { ...order, orderId: randomUUID(), orderDate: new Date() };
    });
};

const splitBy = (number, n) => {
    const splitArray = new Array(Math.floor(number / n)).fill(n);
    const remainder = number % n;
    if (remainder > 0)
        splitArray.push(remainder);
    return splitArray;
};

const splitBlockOrders = (orders, splitSize) => {
    const splitOrders = [];
    orders.forEach(order => {
        if (order.quantity <= splitSize)
            splitOrders.push(order);
        else
            splitBy(order.quantity, splitSize).forEach(orderSplitQuantity => splitOrders.push({ ...order, quantity: orderSplitQuantity, initialQuantity: order.quantity, split: "Yes" }));
    });
    return splitOrders;
};

async function publishToSNSOrEventBridge(invalidOrders, darkPoolOrders, litPoolOrders) {
    switch (busType) {
        case 'EVENT-BRIDGE':
            const params = {
                Entries: [
                {
                    Source: "SmartOrderRouter",
                    EventBusName: eventBusName,
                    DetailType: "Orders",
                    Time: new Date(),
                    Detail: JSON.stringify({//EventBridge doesn't allow to send straight arrays as Detail's content, although the docs say that it's sufficient to be a valid json object :), so I've to wrap the array with an attribute.
                        PoolType: "Dark",
                        Orders: darkPoolOrders
                    })
                },
                {
                    Source: "SmartOrderRouter",
                    EventBusName: eventBusName,
                    DetailType: "Orders",
                    Time: new Date(),
                    Detail: JSON.stringify({
                        PoolType: 'Lit',
                        Orders: litPoolOrders
                    })
                }
                ]
            };
            const result = await eventBridgeClient.send(new PutEventsCommand(params));
            console.log("Event sent to EventBridge with result:\n", result);
            break;
        case 'SNS': 
            await Promise.all([publishToSns(snsClient, orderDispatcherTopicArn, litPoolOrders, {
                "PoolType": {
                    "DataType": "String",
                    "StringValue": "Lit"
                }
            }), publishToSns(snsClient, orderDispatcherTopicArn, darkPoolOrders, {
                "PoolType": {
                    "DataType": "String",
                    "StringValue": "Dark"
                }
            })]);
            break;
        default:
            console.log('Not a valid busType[SNS, EVENT-BRIDGE]: ', busType);
    }
    if (invalidOrders.length > 0)
        await publishToSns(snsClient, orderDispatcherTopicArn, invalidOrders, {
                "InvalidOrders": {
                    "DataType": "String",
                    "StringValue": "CreditCheck"
                }
        });
}