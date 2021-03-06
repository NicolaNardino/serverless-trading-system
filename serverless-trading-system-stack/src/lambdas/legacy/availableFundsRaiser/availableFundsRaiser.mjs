import { UpdateCommand } from '/opt/nodejs/src/dependencies.js';
import { ddbDocClient, getParameter } from '/opt/nodejs/src/utils.js';

const busType = await getParameter('/trading-system/dev/bus-type');
const tradesStoreTableName = process.env.tradesStoreTableName;
const newFunds = 10000000;

//This can work with both SNS and EventBridge. It's now legacy, because during the TypeScript conversion phase I've decided, for the sake of simplicity, to only allow for the EventBridge.
export async function handler(event) {
    //console.log(JSON.stringify(event));
    switch (busType) {
        case 'EVENT-BRIDGE':
            await updateCustomersAvailableFunds(event); //no boilerplate code needed as in below SNS case, because event contains exactly the invalid orders.
            break;
        case 'SNS':
            for (const record of event.Records)
                await updateCustomersAvailableFunds(JSON.parse(record.Sns.Message));
            break;
        default:
            console.log('Not a valid busType[SNS, EVENT-BRIDGE]: ', busType);
    }
}

async function updateCustomersAvailableFunds(orders) {    
    const customerIds = [...new Set(orders.map(order => order.customerId))]; //customerIds that need funds raised.
    for (const customerId of customerIds) {
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
    }
}