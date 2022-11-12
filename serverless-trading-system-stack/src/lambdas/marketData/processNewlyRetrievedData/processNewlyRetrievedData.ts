import { ddbDocClient, formatDate } from '/opt/nodejs/util/utils.js';
import { MarketDataRetreivalResult } from "/opt/nodejs/marketDataManager/marketDataManager.js";
import { QueryCommand } from '/opt/nodejs/util/dependencies.js';

const marketDataTableName = process.env.marketDataTableName;

export async function handler(input: { tickers: MarketDataRetreivalResult[] }): Promise<void> {
    await Promise.all(input.tickers.map(async item => {
        if (item.itemsLoaded > 0) {
            const params = {
                TableName: marketDataTableName,
                ExpressionAttributeValues: {
                    ":ticker": "TICKER#" + item.ticker,
                    ":date1": "HIST#"+item.ticker+"#"+item.histDataNewestBatchStart,
                    ":date2": "HIST#"+item.ticker+"#"+formatDate(new Date()),
                },
                KeyConditionExpression: "PK = :ticker and SK BETWEEN :date1 and :date2"
            };
            const result = (await ddbDocClient.send(new QueryCommand(params))).Items;
            console.log(item.ticker, result);
        }
    }));
}