import { UpdateCommand } from '/opt/nodejs/src/dependencies.js';
import { getDefaultIfUndefined, ddbDocClient, getParameters } from '/opt/nodejs/src/utils.js';

const paramValues = await getParameters(['/trading-system/dev/bus-type']);
const busType = paramValues.get('/trading-system/dev/bus-type');
const tableName = process.env.ddbTableName;

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

    return {
        statusCode: 200,
        body: JSON.stringify('Available funds raised'),
    };
}

async function updateCustomersAvailableFunds(orders) {
    const newFunds = 1000000;
    const customerIds = [...new Set(orders.map(order => order.customerId))]; //customerIds that need funds raised.
    for (const customerId of customerIds) {
        const params = {
            TableName: tableName,
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