import { ddbDocClient, delay, getRandom, getRandomInteger, getRandomArrayEntry } from '../../serverless-trading-system-stack/dependencies/nodejs/src/utils.js';
import { PutCommand } from '../../serverless-trading-system-stack/dependencies/nodejs/src/dependencies.js';

function buildRandomOrders(nrOrders) {
    const customers = ['000001', '000002', '000003', '000004', '000005', '000006', '000007', '000008', '000009', '0000010', '0000011', '0000012'];
    const tickers = ['FB', 'AMD', 'AMZN', 'APPL', 'GOOG', 'NFLX', 'F', 'T', 'MO', 'PFE', 'COIN', 'MRNA', 'ORCL', 'TSLA', 'NVDA', 'MSFT', 'UBSN', 'CSGN', 'HOLN', 'EOG', 'PBR', 'RBLX', 'CDEV','BABA', 'SPY', 'VTI','VOO','ADBE'];
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
async function storeCustomersInfo(tableName) {
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
    storeCustomersInfo
  }