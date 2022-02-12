import { delay, publishToSns, ddbDocClient, snsClient, ssmClient, s3Client, eventBridgeClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, PutObjectCommand, GetParametersCommand, PutCommand, PutEventsCommand } from '/opt/nodejs/src/dependencies.js';

const paramValues = new Map((await ssmClient.send(new GetParametersCommand({ Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/s3-trades-storage', '/darkpool/dev/bus-type', '/darkpool/dev/event-bus-name'] }))).Parameters.map(p => [p.Name, p.Value]));
const tradesStorage = paramValues.get('/darkpool/dev/s3-trades-storage');
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');
const busType = paramValues.get('/darkpool/dev/bus-type'); //SNS or EventBridge
const eventBusName = paramValues.get('/darkpool/dev/event-bus-name');

export async function handler(event) {
    console.log(JSON.stringify(event));
    const today = new Date().toISOString().slice(0, 10);
    switch (busType) {
        case 'EVENT-BRIDGE':
            const fileName = buildS3FileName(today);
            await storeTradesInS3(tradesStorage, fileName, event);
            await storeTradesInDynamoDB(event);
            const result = await eventBridgeClient.send(new PutEventsCommand({
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
            }));
            console.log("Event sent to EventBridge with result:\n", result);
            break;
        case 'SNS':
            for (const record of event.Records) {
                const fileName = buildS3FileName(today);
                const trades = JSON.parse(record.Sns.Message);
                await storeTradesInS3(tradesStorage, fileName, record.Sns.Message);
                await storeTradesInDynamoDB(trades);
                await publishToSns(snsClient, orderDispatcherTopicArn, trades, {
                    "TradesSettled": {
                        "DataType": "String",
                        "StringValue": "True"
                    }
                });
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
            TableName: "trades",
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