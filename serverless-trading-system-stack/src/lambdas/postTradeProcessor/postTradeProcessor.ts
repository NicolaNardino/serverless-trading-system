import { EventBridgeEvent } from 'aws-lambda';

import { delay, ddbDocClient, s3Client, eventBridgeClient } from '/opt/nodejs/util/utils.js';
import { randomUUID, PutObjectCommand, PutCommand, PutEventsCommand } from '/opt/nodejs/util/dependencies.js';
import { Trade } from '/opt/nodejs/util/types.js';

const tradesStorageBucket = process.env.bucketName;
const tableName = process.env.tradesStoreTableName;
const eventBusName = process.env.eventBusName;

export async function handler(event: EventBridgeEvent<string, Trades>) {
    //console.log(JSON.stringify(event));
    const today = new Date().toISOString().slice(0, 10);
    const fileName = buildS3FileName(today);
    const result = await Promise.all([storeTradesInS3(fileName, event.detail.trades), storeTradesInDynamoDB(event.detail.trades), eventBridgeClient.send(new PutEventsCommand({
        Entries: [
            {
                Source: "PostTradeProcessor",
                EventBusName: eventBusName,
                DetailType: "Trades",
                Time: new Date(),
                Detail: JSON.stringify({
                    tradesSettled: "True",
                    trades: event.detail.trades
                })
            }]
    }))]);
    console.log("Event sent to EventBridge with result:\n", result[2]);
    return {
        statusCode: 200,
        body: JSON.stringify('Trades have been post-processed.'),
    };
}

const buildS3FileName = (today: string) => today + "/" + randomUUID() + '.json';

async function storeTradesInS3(fileName: string, trades: Trade[]) {
    await s3Client.send(new PutObjectCommand({
        Bucket: tradesStorageBucket,
        Key: fileName,
        Metadata: {tickers: [...new Set(trades.map(t => t.ticker))].join(','), exchanges: [...new Set(trades.map(t => t.exchange))].join(',')},
        Body: JSON.stringify(trades),
        ContentType: "application/json"
    }));
    console.log("Trades stored in S3 bucket: ", tradesStorageBucket, ", file name: ", fileName);
}

async function storeTradesInDynamoDB(trades: Trade[]) {
    for (const trade of trades) {
        //console.log(JSON.stringify(trade));
        const params = {
            TableName: tableName,
            Item: {
                "PK": "CUST#" + trade.customerId,
                "SK": "TRADE#" + trade.tradeDate.split('T')[0] + "#" + trade.tradeId,
                "Ticker": trade.ticker,
                "Direction": trade.direction,
                "Type": trade.type,
                "Quantity": trade.quantity,
                "Price": trade.price,
                "InternalOrderId": trade.orderId,
                "OrderDate": trade.orderDate,
                "TradeId": trade.tradeId,
                "TradeDate": trade.tradeDate,
                "Exchange": trade.exchange,
                "ExchangeType": trade.exchangeType,
                "Fee": trade.fee,
                "SettlementDate": new Date().toISOString(),
                ...(trade.initialQuantity === undefined ? {} : { "InitialQuantity": trade.initialQuantity }),
                ...(trade.split === undefined ? {} : { "Split": trade.split }),
                ...(trade.notMatchedInDarkPool ? { "NotMatchedInDarkPool": trade.notMatchedInDarkPool } : {})
            }
        };
        //console.log(params);
        await ddbDocClient.send(new PutCommand(params));
        await delay(100);
    }
    console.log("Trades stored in DynamoDB");
}

interface Trades {
    trades: Trade[]
}