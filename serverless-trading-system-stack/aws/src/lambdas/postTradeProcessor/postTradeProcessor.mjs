import { getDefaultIfUndefined, delay, publishToSns, getParameters, ddbDocClient, s3Client, eventBridgeClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, PutObjectCommand, PutCommand, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = await getParameters(['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/s3-trades-storage', '/darkpool/dev/bus-type', '/darkpool/dev/event-bus-name']);
const busType = paramValues.get('/darkpool/dev/bus-type'); //SNS or EventBridge
const eventBusName = paramValues.get('/darkpool/dev/event-bus-name');
const tradesStorageBucket = getDefaultIfUndefined(process.env.bucketName, paramValues.get('/darkpool/dev/s3-trades-storage'));
const tableName = getDefaultIfUndefined(process.env.ddbTableName, "trades");


export async function handler(event) {
    //console.log(JSON.stringify(event));
    const today = new Date().toISOString().slice(0, 10);
    const fileName = buildS3FileName(today);
    switch (busType) {
        case 'EVENT-BRIDGE':
            const result = await Promise.all([storeTradesInS3(tradesStorageBucket, fileName, event), storeTradesInDynamoDB(event), eventBridgeClient.send(new PutEventsCommand({
                Entries: [
                    {
                        Source: "PostTradeProcessor",
                        EventBusName: eventBusName,
                        DetailType: "Trades",
                        Time: new Date(),
                        Detail: JSON.stringify({
                            TradesSettled: "True",
                            Trades: event
                        })
                    }]
            }))]);
            console.log("Event sent to EventBridge with result:\n", result[2]);
            break;
        case 'SNS':
            for (const record of event.Records) {
                const trades = JSON.parse(record.Sns.Message);
                await Promise.all([storeTradesInS3(tradesStorageBucket, fileName, record.Sns.Message), storeTradesInDynamoDB(trades), publishToSns(event.Records[0].Sns.TopicArn, trades, {
                    "TradesSettled": {
                        "DataType": "String",
                        "StringValue": "True"
                    }
                })]);
            }
            break;
        default:
            console.log('Not a valid busType[SNS, EVENT-BRIDGE]: ', busType);
    }
    return {
        statusCode: 200,
        body: JSON.stringify('Trades have been post-processed.'),
    };
}

const buildS3FileName = (today) => today + "/" + randomUUID() + '.json';

async function storeTradesInS3(tradesStorage, fileName, trades) {
    await s3Client.send(new PutObjectCommand({
        Bucket: tradesStorage,
        Key: fileName,
        Body: JSON.stringify(trades),
        ContentType: "application/json"
    }));
    console.log("Trades stored in S3 bucket: ", tradesStorage, ", file name: ", fileName);
}

async function storeTradesInDynamoDB(trades) {
    for (const trade of trades) {
        //console.log(JSON.stringify(trade));
        trade.settlementDate = new Date().toISOString();
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
                "SettlementDate": trade.settlementDate,
                ...(trade.initialQuantity === undefined ? {} : { "InitialQuantity": trade.initialQuantity }),
                ...(trade.split === undefined ? {} : { "Split": trade.split }),
                ...(trade.notMatchedInDarkPool === "True" ? { "NotMatchedInDarkPool": trade.notMatchedInDarkPool } : {})
            }
        };
        //console.log(params);
        await ddbDocClient.send(new PutCommand(params));
        await delay(150);
    }
    console.log("Trades stored in DynamoDB");
}