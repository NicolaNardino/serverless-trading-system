import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

import { QueryCommand, GetCommand, DeleteCommand } from '/opt/nodejs/util/dependencies.js';
import { ddbDocClient } from '/opt/nodejs/util/utils.js';

const marketDataTableName = process.env.marketDataTableName;

/**
 * GET /quote-summary/{ticker}
 * DELETE 
 *  - /quote-summary/{ticker} - deletes the quote summary only.
*   - /quote-summary/{ticker} body: {from: date, to: date} - deletes the historical data in the given date range.
*/
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const { ticker } = event.pathParameters;
    switch (event.httpMethod) {
        case "GET": {
            return {
                statusCode: 200,
                body: JSON.stringify((await ddbDocClient.send(new GetCommand({
                    TableName: marketDataTableName,
                    Key: {
                        PK: "TICKER#" + ticker,
                        SK: "SUMMARY#" + ticker
                    }
                }))).Item)
            };
        }
        case "DELETE": {
            return deleteData(ticker, event, {
                TableName: marketDataTableName,
                Key: {
                    PK: "TICKER#" + ticker,
                    SK: "SUMMARY#" + ticker
                }
            });
        }
        default:
            return {
                statusCode: 404,
                body: JSON.stringify({ errorMessage: "Invalid request: " + event.httpMethod })
            };
    }

    async function deleteData(ticker: string, event: APIGatewayProxyEvent, primaryKeyParams: { TableName: string, Key: { PK: string, SK: string } }): Promise<{ statusCode: number; body: string; }> {
        try {
            if (event.body) {
                const { from, to } = JSON.parse(event.body);
                const params = {
                    TableName: marketDataTableName,
                    ExpressionAttributeValues: {
                        ":ticker": "TICKER#" + ticker,
                        ":from": "HIST#" + ticker + "#" + from,
                        ":to": "HIST#" + ticker + "#" + to,
                    },
                    KeyConditionExpression: "PK = :ticker and SK BETWEEN :from and :to"
                };
                const result = (await ddbDocClient.send(new QueryCommand(params))).Items;
                await Promise.all(result.map(async item => {
                    const deleteParams = {
                        TableName: marketDataTableName,
                        Key: {
                            PK: item.PK,
                            SK: item.SK
                        }
                    };
                    await ddbDocClient.send(new DeleteCommand(deleteParams));
                }));
                return {
                    statusCode: 200,
                    body: JSON.stringify({ ticker: ticker, from: from, to: to, deleted: true })
                }
            }
            else {
                await ddbDocClient.send(new DeleteCommand(primaryKeyParams));
                return {
                    statusCode: 200,
                    body: JSON.stringify({ ticker: ticker, summaryDeleted: true })
                }
            }
        }
        catch(e) {
            console.error(e);
            return {
                statusCode: 500,
                body: JSON.stringify({ticker: ticker, error: e})
            };
        }  
    }
}