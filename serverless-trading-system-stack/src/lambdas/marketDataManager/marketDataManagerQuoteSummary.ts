import { EventBridgeEvent } from 'aws-lambda';
import { s3Client, ddbDocClient } from '/opt/nodejs/util/utils.js';
import { yahooFinance, PutObjectCommand, UpdateCommand} from '/opt/nodejs/util/dependencies.js';

const marketDataBucketName = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;

export const handler = async (event: EventBridgeEvent<string, MarketDataDetail>): Promise<void> => {
  await Promise.all(event.detail.tickers.map(ticker => storeQuoteSummaryInDyanmoDBAndS3(ticker)));
}

async function storeQuoteSummaryInDyanmoDBAndS3(ticker: string) {
  try {
    const result = await yahooFinance.quoteSummary(ticker, { modules: ['defaultKeyStatistics', 'majorHoldersBreakdown'] });
    const quoteSummaryS3Key = 'marketData/' + ticker + '/quoteSummary';
    await s3Client.send(new PutObjectCommand({
      Bucket: marketDataBucketName,
      Key: quoteSummaryS3Key,
      Body: JSON.stringify(result),
      ContentType: "application/json"
    }));
    console.log("Market data/ quoteSummary for ", ticker, "stored in S3 bucket ", marketDataBucketName);

    const defaultKeyStatistics = result.defaultKeyStatistics;
    const majorHoldersBreakdown = result.majorHoldersBreakdown;
    const updateSummaryData = {
      TableName: marketDataTableName,
      Key: {
        PK: "TICKER#" + ticker,
        SK: "SUMMARY#" + ticker,
      },
      ExpressionAttributeValues: {
        ':QuoteSummaryS3Key': quoteSummaryS3Key,
        ':EnterpriseValue': emptyIfUndefined(defaultKeyStatistics?.enterpriseValue),
        ":ForwardPE": emptyIfUndefined(defaultKeyStatistics?.forwardPE),
        ":ProfitMargins": emptyIfUndefined(defaultKeyStatistics?.profitMargins),
        ":Beta": emptyIfUndefined(defaultKeyStatistics?.beta),
        ":EarningsQuarterlyGrowth": emptyIfUndefined(defaultKeyStatistics?.earningsQuarterlyGrowth),
        ":TrailingEps": emptyIfUndefined(defaultKeyStatistics?.trailingEps),
        ":ForwardEps": emptyIfUndefined(defaultKeyStatistics?.forwardEps),
        ":LastDividendValue": emptyIfUndefined(defaultKeyStatistics?.lastDividendValue),
        ":LastDividendDate": emptyIfUndefined(defaultKeyStatistics?.lastDividendDate?.toISOString().split('T')[0]),
        ":InsidersPercentHeld": emptyIfUndefined(majorHoldersBreakdown?.insidersPercentHeld),
        ":InstitutionsCount": emptyIfUndefined(majorHoldersBreakdown?.institutionsCount),
        ":Updated": Date.now()
      },
      UpdateExpression: 'SET QuoteSummaryS3Key = :QuoteSummaryS3Key, EnterpriseValue = :EnterpriseValue, ForwardPE = :ForwardPE, ProfitMargins = :ProfitMargins, Beta = :Beta, EarningsQuarterlyGrowth = :EarningsQuarterlyGrowth, TrailingEps = :TrailingEps, '+
      'ForwardEps = :ForwardEps, LastDividendValue = :LastDividendValue, LastDividendDate = :LastDividendDate, InsidersPercentHeld = :InsidersPercentHeld, InstitutionsCount = :InstitutionsCount, Updated = :Updated'
    };
    await ddbDocClient.send(new UpdateCommand(updateSummaryData));


  }
  catch (e) {
    console.log('Failed to store market data quoteSummary for ticker ', ticker, e);
  }
}

function emptyIfUndefined(item: any) {
  return (item === undefined ? {} : item);
}

interface MarketDataDetail {
  tickers: string[];
}