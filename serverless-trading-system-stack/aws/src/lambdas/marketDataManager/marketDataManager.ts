import { EventBridgeEvent } from 'aws-lambda';
// @ts-ignore
import { getParameters, s3Client, ddbDocClient } from '/opt/nodejs/src/utils.js';
// @ts-ignore
import { fetch, PutObjectCommand, PutCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = await getParameters(['/trading-system/dev/market-data-api-base-url', '/trading-system/dev/market-data-api-key']);
const marketDataApiBaseURL = paramValues.get('/trading-system/dev/market-data-api-base-url');
const marketDataApiKey = paramValues.get('/trading-system/dev/market-data-api-key');
const tradesStorageBucket = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;
const quoteSummaryModules = 'summaryDetail,assetProfile,fundProfile,financialData,defaultKeyStatistics,calendarEvents,incomeStatementHistory,incomeStatementHistoryQuarterly,cashflowStatementHistory,balanceSheetHistory,earnings,earningsHistory,insiderHolders,cashflowStatementHistory, cashflowStatementHistoryQuarterly,insiderTransactions,secFilings,indexTrend,sectorTrend,earningsTrend,netSharePurchaseActivity,upgradeDowngradeHistory,institutionOwnership,recommendationTrend,balanceSheetHistory,balanceSheetHistoryQuarterly,fundOwnership,majorDirectHolders, majorHoldersBreakdown, price, quoteType, esgScore';

export const handler = async (event: EventBridgeEvent<string, MarketDataDetail>): Promise<void> => {
  console.log(JSON.stringify(event));
  await getAndStoreMarketData(event.detail.tickers);
};

async function getAndStoreMarketData(tickers: Array<string>) {
  await Promise.all(tickers.map(async (ticker) => {
    const result = await fetch(marketDataApiBaseURL + 'quoteSummary/' + ticker + '?' + (new URLSearchParams({ modules: quoteSummaryModules })).toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': marketDataApiKey }
    });
    const marketDataS3Key = 'marketData/' + ticker + '/quoteSummary';
    const marketData = await result.json();
    await s3Client.send(new PutObjectCommand({
      Bucket: tradesStorageBucket,
      Key: marketDataS3Key,
      Body: JSON.stringify(marketData),
      ContentType: "application/json"
    }));
    console.log("Market data for ", ticker, "stored in S3 bucket ", tradesStorageBucket);
    await storeMarketDataInDyanmoDB(ticker, marketData, marketDataS3Key);
  }));
}

async function storeMarketDataInDyanmoDB(ticker: string, marketData: any, marketDataS3Key: string) {
  try {
    const defaultKeyStatistics = marketData.quoteSummary.result[0].defaultKeyStatistics;
    const summaryDetail = marketData.quoteSummary.result[0].summaryDetail;
    const params = {
      TableName: marketDataTableName,
      Item: {
        "PK": "TICKER#" + ticker,
        "SK": "SUMMARY#" + ticker,
        "S3Key": marketDataS3Key,
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
    console.log(e);
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