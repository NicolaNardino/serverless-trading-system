import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

import { GetCommand, DeleteCommand } from '/opt/nodejs/util/dependencies.js';
import { ddbDocClient } from '/opt/nodejs/util/utils.js';

const marketDataTableName = process.env.marketDataTableName;

/**
 * GET & DELETE /quote-summary/{ticker}
*/
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const { ticker } = event.pathParameters;
    const params = {
        TableName: marketDataTableName,
        Key: {
            PK: "TICKER#" + ticker,
            SK: "SUMMARY#" + ticker
        }
    };
    switch (event.httpMethod) {
        case "GET": {
            return {
                statusCode: 200,
                body: JSON.stringify((await ddbDocClient.send(new GetCommand(params))).Item)
            };
        }
        case "DELETE": {
            await ddbDocClient.send(new DeleteCommand(params));
            return {
                statusCode: 200,
                body: JSON.stringify({ deleted: true })
            };
        }
        default:
            return {
                statusCode: 404,
                body: JSON.stringify({ errorMessage: "Invalid http method: " + event.httpMethod })
            };
    }
}