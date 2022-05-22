import { DynamoDBClient, DynamoDBDocumentClient, PutCommand } from 'serverless-trading-system-utility-layer/util/dependencies.js'; 
import {getRandomInteger, getRandom, getRandomArrayEntry, delay} from 'serverless-trading-system-utility-layer/util/utils.js';
import { fetch } from 'serverless-trading-system-utility-layer/util/dependencies.js';
import { DataExtractorInvokeUrl, ApiKey } from './sandbox/constants' //this is excluded from the git repo.

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));

async function postOrders(randomOrders: object, apiUrl: string, apiKeyRequired = false) {
    const response = await fetch(apiUrl + 'orders', {
        method: 'POST',
        body: JSON.stringify(randomOrders),
        ...(apiKeyRequired ? {headers: {'Content-Type': 'application/json','x-api-key': ApiKey}} : {}),
    });
    return await response.json();
}

async function getCustomerTrades() {
    const response = await fetch(DataExtractorInvokeUrl + 'trades/000007?tradeDate=2022-01-22', {//customers/000007
        method: 'GET',
        headers: {'Content-Type': 'application/json',
                  'x-api-key': ApiKey
                 }
    });
    return await response.json();
}

function buildRandomOrders(nrOrders: number) {
    const customers = ['000001', '000002', '000003', '000004', '000005', '000006', '000007', '000008', '000009', '0000010', '0000011', '0000012'];
    const tickers = ['FB', 'AMD', 'AMZN', 'AAPL', 'GOOG', 'NFLX', 'F', 'T', 'MO', 'PFE', 'COIN', 'MRNA', 'ORCL', 'TSLA', 'NVDA', 'MSFT', 'UBSG.SW', 'CSGN.SW', 'HOLN.SW', 'CHSPI.SW', 'EOG', 'PBR', 'PBR-A', 'RBLX', 'CDEV','BABA', 'SPY', 'VTI','VOO','ADBE'];
    const directions = ['Buy', 'Sell'];
    const types = ['Market', 'Limit'];
    return [...Array(nrOrders)].map((_, i) => {
        const randomType = getRandomArrayEntry(types);
        return {
            customerId: getRandomArrayEntry(customers),
            direction: getRandomArrayEntry(directions),
            ticker: getRandomArrayEntry(tickers),
            type: randomType,
            quantity: getRandomInteger(50, 10000),
            ...(randomType === "Limit" ? { price: getRandom(100, 200).toFixed(2) } : {})
        };
    });
}

//Customers data initialization.
async function storeCustomersInfo(tableName: string) {
    const customers = ['000001', '000002', '000003', '000004', '000005', '000006','000007','000008','000009','0000010', '0000011', '0000012'];
    for (const customerId of customers) {
        try {
            const params = {
                TableName: tableName,
                Item: {
                    "PK" : "CUST#"+customerId,
                    "SK" : "CUST#"+customerId,
                    "Details" : {
                        FirstName: "John",
                        LastName: "Scalper",
                        type: "Retail",
                        address: {
                            city: "NY",
                            postcode: 10005,
                            phone: 214214214
                        }
                    },
                    RemainingFunds: 1000000
                }
            }
            await ddbDocClient.send(new PutCommand(params));
            await delay(150);
            console.log("Added "+customerId);
        }
        catch(e) {
            console.log(e);
        }
    };
}

  export {
    buildRandomOrders,
    storeCustomersInfo,
    postOrders,
    getCustomerTrades,
    delay,
    ddbDocClient
  }