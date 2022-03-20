import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';  
  export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const eventStr = JSON.stringify(event);
    //TODO: return all bucket's objects
    return {
      statusCode: 200,
      body: `Event: ${eventStr}`
    }
  }