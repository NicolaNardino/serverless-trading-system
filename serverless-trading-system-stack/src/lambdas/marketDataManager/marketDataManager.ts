import { EventBridgeEvent } from 'aws-lambda';
import { getParameters, s3Client, ddbDocClient } from '/opt/nodejs/util/utils.js';
import { fetch, PutObjectCommand, PutCommand } from '/opt/nodejs/util/dependencies.js';
import { yahooFinance } from '/opt/nodejs/util/dependencies.js';

const paramValues = await getParameters(['/trading-system/dev/market-data-api-base-url', '/trading-system/dev/market-data-api-key']);
const marketDataApiBaseURL = paramValues.get('/trading-system/dev/market-data-api-base-url');
const marketDataApiKey = paramValues.get('/trading-system/dev/market-data-api-key');
const marketDataBucketName = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;
const quoteSummaryModules = 'summaryDetail,assetProfile,fundProfile,financialData,defaultKeyStatistics,calendarEvents,incomeStatementHistory,incomeStatementHistoryQuarterly,cashflowStatementHistory,balanceSheetHistory,earnings,earningsHistory,insiderHolders,cashflowStatementHistory, cashflowStatementHistoryQuarterly,insiderTransactions,secFilings,indexTrend,sectorTrend,earningsTrend,netSharePurchaseActivity,upgradeDowngradeHistory,institutionOwnership,recommendationTrend,balanceSheetHistory,balanceSheetHistoryQuarterly,fundOwnership,majorDirectHolders, majorHoldersBreakdown, price, quoteType, esgScore';

export const handler = async (event: EventBridgeEvent<string, MarketDataDetail>): Promise<void> => {
  console.log(JSON.stringify(event));
  await getAndStoreMarketData(event.detail.tickers);
};

async function getAndStoreMarketData(tickers: string[]) {
  await Promise.all(tickers.map(ticker => storeQuoteSummaryInDyanmoDBAndS3(ticker)));
  await Promise.all(tickers.map(ticker => storeHistoricalDataInS3(ticker)));
}

async function storeHistoricalDataInS3(ticker: string) {//it'll be enhanced to store data in DynamoDB too.
  const queryOptions = { period1: '2020-01-01', period2: new Date()};
  const result = await yahooFinance.historical(ticker, queryOptions);

  await s3Client.send(new PutObjectCommand({
    Bucket: marketDataBucketName,
    Key: 'marketData/history/'+ticker,
    Body: JSON.stringify(result),
    ContentType: "application/json"
  }));
  console.log("Market data/ history for ", ticker, "stored in S3 bucket ", marketDataBucketName);
  }

async function storeQuoteSummaryInDyanmoDBAndS3(ticker: string) {
  try {
    const quoteSummaryHandle = await fetch(marketDataApiBaseURL + 'v11/finance/quoteSummary/' + ticker + '?' + (new URLSearchParams({ modules: quoteSummaryModules })).toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': marketDataApiKey }
    });
    const quoteSummaryS3Key = 'marketData/' + ticker + '/quoteSummary';
    const quoteSummaryActual: any = await quoteSummaryHandle.json();
    await s3Client.send(new PutObjectCommand({
      Bucket: marketDataBucketName,
      Key: quoteSummaryS3Key,
      Body: JSON.stringify(quoteSummaryActual),
      ContentType: "application/json"
    }));
    console.log("Market data/ quoteSummary for ", ticker, "stored in S3 bucket ", marketDataBucketName);

    const defaultKeyStatistics = quoteSummaryActual.quoteSummary.result[0].defaultKeyStatistics;
    const summaryDetail = quoteSummaryActual.quoteSummary.result[0].summaryDetail;
    const params = {
      TableName: marketDataTableName,
      Item: {
        "PK": "TICKER#" + ticker,
        "SK": "SUMMARY#" + ticker,
        "QuoteSummaryS3Key": quoteSummaryS3Key,
        "EnterpriseValue": emptyIfUndefined(defaultKeyStatistics.enterpriseValue?.raw),
        "ForwardPE": emptyIfUndefined(defaultKeyStatistics.forwardPE?.raw),
        "ProfitMargins": emptyIfUndefined(defaultKeyStatistics.profitMargins?.raw),
        "Beta": emptyIfUndefined(defaultKeyStatistics.beta?.raw),
        "EarningsQuarterlyGrowth": emptyIfUndefined(defaultKeyStatistics.earningsQuarterlyGrowth?.raw),
        "TrailingEps": emptyIfUndefined(defaultKeyStatistics.trailingEps?.raw),
        "ForwardEps": emptyIfUndefined(defaultKeyStatistics.forwardEps?.raw),
        "LastDividendValue": emptyIfUndefined(defaultKeyStatistics.lastDividendValue?.raw),
        "LastDividendDate": emptyIfUndefined(defaultKeyStatistics.lastDividendDate),
        "DividendYield": emptyIfUndefined(summaryDetail.dividendYield.raw),
        "PayoutRatio": emptyIfUndefined(summaryDetail.payoutRatio.raw),
        "Updated": Date.now()
      }
    };
    await ddbDocClient.send(new PutCommand(params));
  }
  catch (e) {
    console.log('Failed to store market data quoteSummary for ticker ', ticker, e);
  }
}

function emptyIfUndefined(item: any) {
  if (item === undefined)
    return {};
  return item;
}

interface MarketDataDetail {
  tickers: string[];
}