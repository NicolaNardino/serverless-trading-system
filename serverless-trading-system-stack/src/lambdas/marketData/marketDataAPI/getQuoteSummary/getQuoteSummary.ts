import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

/**
 * .../quote-summary/{ticker}
*/
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const result = {};
    const { ticker } = event.pathParameters;
    return {
        statusCode: 200,
        body: JSON.stringify(result)
    };
}