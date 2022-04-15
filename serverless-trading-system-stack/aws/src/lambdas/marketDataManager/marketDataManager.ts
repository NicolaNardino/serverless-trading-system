import { EventBridgeEvent } from 'aws-lambda';
// @ts-ignore
import { getParameters, s3Client } from '/opt/nodejs/src/utils.js';
// @ts-ignore
import { fetch, PutObjectCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = await getParameters(['/trading-system/dev/market-data-api-key']);
const apiKey = paramValues.get('/trading-system/dev/market-data-api-key');
const tradesStorageBucket = process.env.bucketName;
//const marketDataTableName = process.env.marketDataTableName;
const marketDataApiBaseURL = 'https://yfapi.net/v11/finance/quoteSummary/';
const mods = 'summaryDetail,assetProfile,fundProfile,financialData,defaultKeyStatistics,calendarEvents,incomeStatementHistory,incomeStatementHistoryQuarterly,cashflowStatementHistory,balanceSheetHistory,earnings,earningsHistory,insiderHolders,cashflowStatementHistory, cashflowStatementHistoryQuarterly,insiderTransactions,secFilings,indexTrend,sectorTrend,earningsTrend,netSharePurchaseActivity,upgradeDowngradeHistory,institutionOwnership,recommendationTrend,balanceSheetHistory,balanceSheetHistoryQuarterly,fundOwnership,majorDirectHolders, majorHoldersBreakdown, price, quoteType, esgScore';

export const handler = async (event: EventBridgeEvent<string, MarketDataDetail>): Promise<void> => {
  console.log(JSON.stringify(event));
  await getAndStoreMarketData(event.detail.tickers);
};

async function getAndStoreMarketData(tickers: Array<string>) {
  await Promise.all(tickers.map(async (ticker) => {
    const result = await fetch(marketDataApiBaseURL + ticker + '?' + (new URLSearchParams({ modules: mods })).toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
    });
    const marketData = JSON.stringify(await result.json());
    await s3Client.send(new PutObjectCommand({
      Bucket: tradesStorageBucket,
      Key: 'marketData/' + ticker,
      Body: marketData,
      ContentType: "application/json"
    }))
    console.log("Market data for ", ticker, "stored in S3 bucket ", tradesStorageBucket);
  }));
}

interface MarketDataDetail {
  tickers: string[];
}