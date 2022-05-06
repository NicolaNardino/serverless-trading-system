import { EventBridgeEvent } from 'aws-lambda';

import { UpdateCommand } from '../../layers/common/util/dependencies.js';
import { ddbDocClient } from '/opt/nodejs/util/utils.js';

const tradesStoreTableName = process.env.tradesStoreTableName;
const newFunds = 10000000;

export async function handler(event: EventBridgeEvent<string, Orders>) {
    await updateCustomersAvailableFunds(event.detail.orders);
}

async function updateCustomersAvailableFunds(orders: Order[]) {
    const customerIds = [...new Set(orders.map(order => order.customerId))]; //customerIds that need funds raised.
    await Promise.all(customerIds.map(async customerId => {
        const params = {
            TableName: tradesStoreTableName,
            Key: {
                PK: "CUST#" + customerId,
                SK: "CUST#" + customerId,
            },
            ExpressionAttributeValues: {
                ':NewFunds': newFunds,
                ':Now': Date.now()
            },
            UpdateExpression: 'SET RemainingFunds = :NewFunds, Updated = :Now'
        };
        await ddbDocClient.send(new UpdateCommand(params));
        console.log("Updated remaining funds of customerId", customerId, "to", newFunds);
    }));
}

interface Orders {
    orders: Order[]
}

interface Order {
    customerId: string
};