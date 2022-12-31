import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

import { GetCommand } from '/opt/nodejs/util/dependencies.js';
import { ddbDocClient } from '/opt/nodejs/util/utils.js';

const marketDataTableName = process.env.marketDataTableName;

/**
 * .../quote-summary/{ticker}
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
    return {
        statusCode: 200,
        body: JSON.stringify((await ddbDocClient.send(new GetCommand(params))).Item)
    };
}