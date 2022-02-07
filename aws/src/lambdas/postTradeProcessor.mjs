import { delay, publishToSns, ddbDocClient } from '/opt/nodejs/src/utils.js';
import { randomUUID, SNSClient, S3Client, PutObjectCommand, SSMClient, GetParametersCommand, PutCommand } from '/opt/nodejs/src/dependencies.js';

const region = { region: 'us-east-2' };
const snsClient = new SNSClient(region);
const ssmClient = new SSMClient(region);
const s3Client = new S3Client(region);

const paramValues = new Map((await ssmClient.send(new GetParametersCommand({Names: ['/darkpool/dev/order-dispatcher-topic-arn', '/darkpool/dev/s3-trades-storage']}))).Parameters.map(p => [p.Name, p.Value]));
const tradesStorage = paramValues.get('/darkpool/dev/s3-trades-storage');
const orderDispatcherTopicArn = paramValues.get('/darkpool/dev/order-dispatcher-topic-arn');

export async function handler(event) {
    //console.log(JSON.stringify(event));
    const today = new Date().toISOString().slice(0,10);
    for (const record of event.Records) {
        const fileName = today+"/"+randomUUID()+'.json';
        await s3Client.send(new PutObjectCommand({
            Bucket: tradesStorage,
            Key: fileName,
            Body: record.Sns.Message,
            ContentType: "application/json"}));
        console.log("Stored "+fileName+" trades.");
        const trades = JSON.parse(record.Sns.Message);
        for (const trade of trades) {
            //console.log(JSON.stringify(trade));
            trade.settlementDate = new Date().toISOString();
            const params = {
                TableName: "trades",
                Item: {
                    "PK" : "CUST#"+trade.customerId,
                    "SK" : "TRADE#"+trade.tradeDate.split('T')[0]+"#"+trade.tradeId,
                    "Ticker" : trade.ticker,
                    "Direction" : trade.direction,
                    "Type" : trade.type,
                    "Quantity" : trade.quantity,
                    "Price" : trade.price,
                    "InternalOrderId" : trade.orderId,
                    "OrderDate" : trade.orderDate,
                    "TradeId" : trade.tradeId,
                    "TradeDate" : trade.tradeDate,
                    "Exchange" : trade.exchange,
                    "ExchangeType" : trade.exchangeType,
                    "Fee" : trade.fee,
                    "SettlementDate" : trade.settlementDate,
                    ...(trade.initialQuantity===undefined ? {} : {"InitialQuantity" : trade.initialQuantity}),
                    ...(trade.split===undefined ? {} : {"Split" : trade.split}),
                    ...(trade.notMatchedInDarkPool==="True" ? { "NotMatchedInDarkPool" : trade.notMatchedInDarkPool } : {})
                }
            };
            //console.log(params);
            await ddbDocClient.send(new PutCommand(params));
            await delay(150);
        };
        console.log("Trades stored in DynamoDB");
        await publishToSns(snsClient, orderDispatcherTopicArn, trades, {"TradesSettled": {
                "DataType": "String",
                "StringValue": "True"
            }});
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify('Trades have been post-processed.'),
    };
};