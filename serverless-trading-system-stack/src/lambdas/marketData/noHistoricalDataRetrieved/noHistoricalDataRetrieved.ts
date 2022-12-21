import { MarketDataRetreivalResult } from "/opt/nodejs/marketDataManager/marketDataManager.js";
import { eventBridgeClient } from '/opt/nodejs/util/utils.js';
import { PutEventsCommand } from '/opt/nodejs/util/dependencies.js';

const eventBusName = process.env.eventBusName;

export async function handler(input: { tickers: MarketDataRetreivalResult[] }, taskToken: string): Promise<void> {
  console.log(input);
  const params = {
    Entries: [
      {
        Source: "MarketDataManagerStepFunction",
        EventBusName: eventBusName,
        DetailType: "NoHistoricalDataRetrieved",
        Time: new Date(),
        Detail: JSON.stringify({
          taskToken: taskToken
        })
      }
    ]};
  const result = await eventBridgeClient.send(new PutEventsCommand(params));
}