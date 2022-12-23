import { MarketDataRetreivalResult } from "/opt/nodejs/marketDataManager/marketDataManager.js";
import { eventBridgeClient } from '/opt/nodejs/util/utils.js';
import { PutEventsCommand } from '/opt/nodejs/util/dependencies.js';

const eventBusName = process.env.eventBusName;

export async function handler(inputWithTaskToken: InputWithTaskToken): Promise<void> {
  console.log(JSON.stringify(inputWithTaskToken));
  const params = {
    Entries: [
      {
        Source: "MarketDataManagerStepFunction",
        EventBusName: eventBusName,
        DetailType: "NoHistoricalDataRetrieved",
        Time: new Date(),
        Detail: JSON.stringify({
          taskToken: inputWithTaskToken.taskToken
        })
      }
    ]};
  await eventBridgeClient.send(new PutEventsCommand(params));
}

interface InputWithTaskToken {
  input: { tickers: MarketDataRetreivalResult[] },
  taskToken: string
}