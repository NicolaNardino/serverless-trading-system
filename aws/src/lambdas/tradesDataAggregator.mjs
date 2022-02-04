import { delay } from '/opt/nodejs/src/utils.js';
import { DynamoDBClient, DynamoDBDocumentClient, UpdateCommand } from '/opt/nodejs/src/dependencies.js';

const region = { region: 'us-east-2' };
const dynamoDBClient = new DynamoDBClient(region);
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDBClient);

export async function handler(event) {
    //console.log(event);
    const today = new Date().toISOString().split('T')[0];
    for (const record of event.Records) {
        console.log('Stream record: ', JSON.stringify(record, null, 2));
        if ((record.eventName == 'INSERT') && (record.dynamodb.NewImage.TradeId)) {
            try {
                const tickerUpdateExpr = {
                    TableName: "trades",
                    Key: {
                        PK: "TICKER#" + record.dynamodb.NewImage.Ticker.S,
                        SK: today
                    },
                    ExpressionAttributeNames: {
                        '#NrTrades': 'NrTrades',
                        '#TotalQuantity': 'TotalQuantity',
                        '#Updated': 'Updated'
                    },
                    ExpressionAttributeValues: {
                        ':Count': 1,
                        ':Quantity': parseInt(record.dynamodb.NewImage.Quantity.N),
                        ':Start': 0,
                        ':Now': Date.now()
                    },
                    UpdateExpression: 'SET #NrTrades = if_not_exists(#NrTrades, :Start) + :Count, #TotalQuantity = if_not_exists(#TotalQuantity, :Start) + :Quantity, #Updated = :Now'
                };
                await ddbDocClient.send(new UpdateCommand(tickerUpdateExpr));
                //console.log('Updated key: '+ JSON.stringify(tickerUpdateExpr.Key));
                const customer = record.dynamodb.NewImage.PK.S;
                const customerUpdateExpr = {
                    TableName: "trades",
                    Key: {
                        PK: customer,
                        SK: customer
                    },
                    ExpressionAttributeNames: {
                        '#NrTrades': 'NrTrades',
                        '#TotalCommissionPaid': 'TotalCommissionPaid',
                        '#TotalAmountInvested': 'TotalAmountInvested',
                        '#RemainingFunds': 'RemainingFunds',
                        '#Updated': 'Updated'
                    },
                    ExpressionAttributeValues: {
                        ':Count': 1,
                        ':Fee': parseFloat(record.dynamodb.NewImage.Fee.S),
                        ':AmountInvested': parseFloat(record.dynamodb.NewImage.Price.S) * parseFloat(record.dynamodb.NewImage.Quantity.N), 
                        ':Start': 0,
                        ':Now': Date.now()
                    },
                    UpdateExpression: 'SET #NrTrades = if_not_exists(#NrTrades, :Start) + :Count, #TotalCommissionPaid = if_not_exists(#TotalCommissionPaid, :Start) + :Fee, '+
                    '#TotalAmountInvested = if_not_exists(#TotalAmountInvested, :Start) + :AmountInvested, #RemainingFunds = #RemainingFunds - :AmountInvested, #Updated = :Now'
                };
                await ddbDocClient.send(new UpdateCommand(customerUpdateExpr));
                //console.log('Updated key: '+JSON.stringify(customerUpdateExpr.Key));
                await delay(200);
        }
        catch (e) {
            console.log(e);
        }

    }
};
return {
    statusCode: 200,
    body: JSON.stringify('All good.'),
};
};
