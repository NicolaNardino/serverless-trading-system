import { publishToSns } from '/opt/nodejs/src/utils.js';
import { randomUUID, SNSClient, SSMClient, GetParametersCommand } from '/opt/nodejs/src/dependencies.js';

const region = { region: 'us-east-2' };
const snsClient = new SNSClient(region);
const ssmClient = new SSMClient(region);

const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/darkpool-tickers-list']}))).Parameters.map(p => [p.Name, p.Value]));
const darkPoolTickers = paramValues.get('/darkpool/dev/darkpool-tickers-list').split(',');
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');

export async function handler(event) {
    try {
        let orders = [];
        if (event.body)
            orders = JSON.parse(event.body);
        const darkPoolOrders = splitBlockOrders(addOrderIdAndDate(orders.filter(order => darkPoolTickers.includes(order.ticker))), 1000);
        const lightPoolOrders = splitBlockOrders(addOrderIdAndDate(orders.filter(order => !darkPoolTickers.includes(order.ticker))), 1000);
        await Promise.all([publishToSns(snsClient, orderDispatcherTopicArn, lightPoolOrders, {
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

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully received ${orders.length} order(s)`,
                receivedOrders: orders
            })
        };
    }
    catch (e) {
        return {
            statusCode: 500,
            body: JSON.stringify(e.message)
        };
    };
};

const addOrderIdAndDate = orders => {
    return orders.map(order => {
        return { ...order, orderId: randomUUID(), orderDate: new Date() }
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
}
