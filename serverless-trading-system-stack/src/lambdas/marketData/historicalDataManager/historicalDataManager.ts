import { EventBridgeEvent } from 'aws-lambda';
import { getAndstoreHistoricalData, MarketDataDetail } from '/opt/nodejs/marketDataManager/marketDataManager.js'

const marketDataBucketName = process.env.bucketName;
const marketDataTableName = process.env.marketDataTableName;

/**
 * This is meant to be used in a step function with a Parallel state.
 * */
export async function handler(event: EventBridgeEvent<string, MarketDataDetail>): Promise<void> {
  await Promise.all(event.detail.tickers.map(ticker => getAndstoreHistoricalData(ticker, marketDataBucketName, marketDataTableName)));
}