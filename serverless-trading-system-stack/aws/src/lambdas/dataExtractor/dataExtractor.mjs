import { GetCommand, QueryCommand } from '/opt/nodejs/src/dependencies.js';
import { ddbDocClient } from '/opt/nodejs/src/utils.js';

const tableName = "trades";

export async function handler(event) {
  console.log(event);
    let result;
    const path = event.path;
    if (event.httpMethod === 'GET') {
        const split = path.split('/');
        const customerId = split[2];
        if (split[1] === 'trades') { 
            const { tradeDate } = event.queryStringParameters;
            const params = {
                TableName: tableName,
                ExpressionAttributeValues: {
                    ":customerId": "CUST#"+customerId,
                    ":tradeDate": "TRADE#"+tradeDate
                },
                KeyConditionExpression: "PK = :customerId and begins_with(SK, :tradeDate)"
            };
            result = (await ddbDocClient.send(new QueryCommand(params))).Items;
        }
        else if (split[1] === 'customers') {
            const params = {
                TableName: tableName,
                Key: {
                    PK: "CUST#"+customerId, 
                    SK: "CUST#"+customerId
                }
            };
            result = (await ddbDocClient.send(new GetCommand(params))).Item;
        }
        else
            result = {Message: "Not a valid request"};
    }
    return {
        statusCode: 200,
        body: JSON.stringify(result)
    };
}