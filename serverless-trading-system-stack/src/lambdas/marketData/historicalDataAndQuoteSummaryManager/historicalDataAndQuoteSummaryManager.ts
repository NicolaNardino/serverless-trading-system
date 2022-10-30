import { getAndstoreHistoricalData, getAndstoreQuoteSummary, MarketDataRetreivalResult } from '/opt/nodejs/marketDataManager/marketDataManager.js'

const marketDataBucketName = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;

/**
 * This is meant to be used in a step function with a Map state.
 * */
export async function handler(input: { ticker: string; }): Promise<MarketDataRetreivalResult> {
  await getAndstoreQuoteSummary(input.ticker, marketDataBucketName, marketDataTableName);
  return await getAndstoreHistoricalData(input.ticker, marketDataBucketName, marketDataTableName);
}