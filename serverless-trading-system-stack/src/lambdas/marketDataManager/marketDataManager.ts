import { EventBridgeEvent } from 'aws-lambda';
import { getParameters, s3Client, ddbDocClient } from '/opt/nodejs/util/utils.js';
import { fetch, PutObjectCommand, PutCommand, UpdateCommand, GetCommand } from '/opt/nodejs/util/dependencies.js';
import { yahooFinance } from '/opt/nodejs/util/dependencies.js';

const paramValues = await getParameters(['/trading-system/dev/market-data-api-base-url', '/trading-system/dev/market-data-api-key']);
const marketDataApiBaseURL = paramValues.get('/trading-system/dev/market-data-api-base-url');
const marketDataApiKey = paramValues.get('/trading-system/dev/market-data-api-key');
const marketDataBucketName = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;

export const handler = async (event: EventBridgeEvent<string, MarketDataDetail>): Promise<void> => {
  const tickers = event.detail.tickers;
  await Promise.all(tickers.map(ticker => storeQuoteSummaryInDyanmoDBAndS3(ticker)));
  await Promise.all(tickers.map(ticker => storeHistoricalDataInS3(ticker)));
}

async function storeHistoricalDataInS3(ticker: string) {//it'll be enhanced to store data in DynamoDB too.
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
    //only update the data past a the current end date (HistDataEnd)
    const currentHistDataEnd = await getCurrentHistDataEnd(ticker);
    const filteredResult = (result.filter(item => item.date > currentHistDataEnd));
    console.log('Current hist data end for ticker', ticker, ' is ', currentHistDataEnd, ', target end', formatDate(histDataEnd), '\nItems to upload:', filteredResult.length);
    await Promise.all(filteredResult.slice(0, 50).map(async item => {//temporarily limiting it to 50 items per ticker
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
    const params = {
      TableName: marketDataTableName,
      Item: {
        "PK": "TICKER#" + ticker,
        "SK": "SUMMARY#" + ticker,
        "QuoteSummaryS3Key": quoteSummaryS3Key,
        "EnterpriseValue": emptyIfUndefined(defaultKeyStatistics?.enterpriseValue),
        "ForwardPE": emptyIfUndefined(defaultKeyStatistics?.forwardPE),
        "ProfitMargins": emptyIfUndefined(defaultKeyStatistics?.profitMargins),
        "Beta": emptyIfUndefined(defaultKeyStatistics?.beta),
        "EarningsQuarterlyGrowth": emptyIfUndefined(defaultKeyStatistics?.earningsQuarterlyGrowth),
        "TrailingEps": emptyIfUndefined(defaultKeyStatistics?.trailingEps),
        "ForwardEps": emptyIfUndefined(defaultKeyStatistics?.forwardEps),
        "LastDividendValue": emptyIfUndefined(defaultKeyStatistics?.lastDividendValue),
        "LastDividendDate": emptyIfUndefined(defaultKeyStatistics?.lastDividendDate?.toISOString().split('T')[0]),
        "InsidersPercentHeld": emptyIfUndefined(majorHoldersBreakdown?.insidersPercentHeld),
        "InstitutionsCount": emptyIfUndefined(majorHoldersBreakdown?.institutionsCount),
        "Updated": Date.now()
      }
    }
    await ddbDocClient.send(new PutCommand(params));
  }
  catch (e) {
    console.log('Failed to store market data quoteSummary for ticker ', ticker, e);
  }
}

async function storeQuoteSummaryInDyanmoDBAndS3_drictFromYahooFinanceAPI(ticker: string) {
  try {
    const quoteSummaryModules = 'summaryDetail,assetProfile,fundProfile,financialData,defaultKeyStatistics,calendarEvents,incomeStatementHistory,incomeStatementHistoryQuarterly,cashflowStatementHistory,balanceSheetHistory,earnings,earningsHistory,insiderHolders,cashflowStatementHistory, cashflowStatementHistoryQuarterly,insiderTransactions,secFilings,indexTrend,sectorTrend,earningsTrend,netSharePurchaseActivity,upgradeDowngradeHistory,institutionOwnership,recommendationTrend,balanceSheetHistory,balanceSheetHistoryQuarterly,fundOwnership,majorDirectHolders, majorHoldersBreakdown, price, quoteType, esgScore';
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

async function getCurrentHistDataEnd(ticker: string) {
  const params = {
    TableName: marketDataTableName,
    Key: {
      PK: "TICKER#" + ticker,
      SK: "SUMMARY#" + ticker,
    },
    ProjectionExpression: "HistDataEnd"
  };
  const result : any = (await ddbDocClient.send(new GetCommand(params))).Item;
  return result.HistDataEnd;
}

function emptyIfUndefined(item: any) {
  if (item === undefined)
    return {};
  return item;
}

interface MarketDataDetail {
  tickers: string[];
}

const formatDate = (inputDate: Date) => {
  return inputDate.toISOString().split('T')[0];
}