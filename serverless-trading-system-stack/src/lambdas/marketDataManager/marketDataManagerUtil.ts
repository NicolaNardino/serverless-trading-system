import { delay, s3Client, ddbDocClient } from '/opt/nodejs/util/utils.js';
import { yahooFinance, PutObjectCommand, PutCommand, UpdateCommand, GetCommand } from '/opt/nodejs/util/dependencies.js';

export async function storeHistoricalDataInS3(ticker: string, marketDataBucketName: string, marketDataTableName: string) {
  try {
    const histDataStart = '2020-01-01';
    const histDataEnd = new Date();
    const queryOptions = { period1: histDataStart, period2: histDataEnd };
    const result = await yahooFinance.historical(ticker, queryOptions);
    await s3Client.send(new PutObjectCommand({
      Bucket: marketDataBucketName,
      Key: 'marketData/history/' + ticker,
      Body: JSON.stringify(result),
      ContentType: "application/json"
    }));
    console.log("Historical data for ", ticker, "stored in S3 bucket ", marketDataBucketName);
    const currentHistDataEnd = await getCurrentHistDataEnd(ticker, marketDataTableName);
    const filteredResult = (currentHistDataEnd === undefined ? result : (result.filter(item => item.date > currentHistDataEnd)))
    console.log('Current hist data end for ticker', ticker, ' is: ', currentHistDataEnd, ', target end:', formatDate(histDataEnd), ', items to upload:', filteredResult.length);

    await Promise.all(filteredResult.map(async (item, index) => {//waiting every x(=10) writes, not to consume the free tier.
      const params = {
        TableName: marketDataTableName,
        Item: {
          "PK": "TICKER#" + ticker,
          "SK": "HIST#" + ticker + "#" + formatDate(item.date),
          "Open": item.open,
          "High": item.high,
          "Low": item.low,
          "Close": item.close,
          "Volume": item.volume,
          "Updated": Date.now()
        }
      };
      await ddbDocClient.send(new PutCommand(params));
      if (index % 10 === 0)
        delay(500);
    }));
    console.log("Historical market data for ", ticker, "stored in DynamoDB");
    const updateHistDataStartEnd = {
      TableName: marketDataTableName,
      Key: {
        PK: "TICKER#" + ticker,
        SK: "SUMMARY#" + ticker,
      },
      ExpressionAttributeNames: {
        '#HistDataStart': 'HistDataStart',
        '#HistDataEnd': 'HistDataEnd',
      },
      ExpressionAttributeValues: {
        ':HistDataStart': histDataStart,
        ':HistDataEnd': formatDate(histDataEnd)
      },
      UpdateExpression: 'SET #HistDataStart = :HistDataStart, #HistDataEnd = :HistDataEnd'
    };
    await ddbDocClient.send(new UpdateCommand(updateHistDataStartEnd));
    console.log('Historical market data start/ end updated for ', ticker);
  }
  catch (e) {
    console.log('Failed to store historical market data for ticker ', ticker, e);
  }
}

async function getCurrentHistDataEnd(ticker: string, marketDataTableName: string) : Promise<Date | undefined>  {
  const params = {
    TableName: marketDataTableName,
    Key: {
      PK: "TICKER#" + ticker,
      SK: "SUMMARY#" + ticker,
    },
    ProjectionExpression: "HistDataEnd"
  };
  const result : any = (await ddbDocClient.send(new GetCommand(params))).Item;
  return result.HistDataEnd === undefined ? result.HistDataEnd : new Date(result.HistDataEnd)
}

const formatDate = (inputDate: Date) => {
  return inputDate.toISOString().split('T')[0];
}