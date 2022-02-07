import { UpdateCommand } from '/opt/nodejs/src/dependencies.js';
import { ddbDocClient } from '/opt/nodejs/src/utils.js';

const newFunds = 1000000;

export async function handler(event) {
    console.log(JSON.stringify(event));
    for (const record of event.Records) {
        const customerIds = [...new Set(JSON.parse(record.Sns.Message).map(order => order.customerId))]; //customerIds that need funds raised.
        for (const customerId of customerIds) {
            const params = {
                    TableName: "trades",
                    Key: {
                        PK: "CUST#"+customerId,
                        SK: "CUST#"+customerId,
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
    
    return {
        statusCode: 200,
        body: JSON.stringify('Available funds raised'),
    };
}