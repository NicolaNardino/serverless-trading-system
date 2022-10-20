import { getAndstoreHistoricalData, getAndstoreQuoteSummary } from '/opt/nodejs/marketDataManager/marketDataManager.js'

const marketDataBucketName = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;

export async function handler(input: { ticker: string; }): Promise<{ ticker: string; itemsLoaded: number; }> {
  await getAndstoreQuoteSummary(input.ticker, marketDataBucketName, marketDataTableName);
  return await getAndstoreHistoricalData(input.ticker, marketDataBucketName, marketDataTableName);
}