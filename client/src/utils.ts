import { PutCommand } from 'serverless-trading-system-utility-layer/util/dependencies';
import { getRandomInteger, getRandom, getRandomArrayEntry, getRandomEnum, delay, ddbDocClient } from 'serverless-trading-system-utility-layer/util/utils';
import { Direction, Type, EntryOrder } from 'serverless-trading-system-utility-layer/util/types';

function buildRandomOrders(nrOrders: number): EntryOrder[] {
    const customers = ['000001', '000002', '000003', '000004', '000005', '000006', '000007', '000008', '000009', '0000010', '0000011', '0000012'];
    const tickers = ['MMM', 'ABT', 'ACN', 'AKAM', 'GOOGL', 'AXP', 'AEP', 'AON', 'AMAT', 'ATO', 'VTV', 'PM', 'BTI', 'META', 'AMD', 'AMZN', 'AAPL', 'GOOG', 'NFLX', 'F', 'T', 'MO', 'PFE', 'COIN', 'MRNA', 'ORCL', 'TSLA', 'SOPH', 'NVDA', 'MSFT', 'UBSG.SW', 'CSGN.SW', 'HOLN.SW', 'CHSPI.SW', 'EOG', 'PBR', 'PBR-A', 'RBLX', 'CDEV', 'BABA', 'SPY', 'VTI', 'VOO', 'ADBE'];
    return [...Array(nrOrders)].map((_, i) => {
        const randomType = getRandomEnum(Type);
        return {
            customerId: getRandomArrayEntry(customers) as string,
            direction: getRandomEnum(Direction),
            ticker: getRandomArrayEntry(tickers) as string,
            type: randomType,
            quantity: getRandomInteger(50, 10000),
            price: (Type.Limit === randomType ? +getRandom(100, 200).toFixed(2) : undefined)
        }
    });
}

//Customers data initialization.
async function storeCustomersInfo(tableName: string) {
    const customers = ['000001', '000002', '000003', '000004', '000005', '000006', '000007', '000008', '000009', '0000010', '0000011', '0000012'];
    for (const customerId of customers) {
        try {
            const params = {
                TableName: tableName,
                Item: {
                    "PK": "CUST#" + customerId,
                    "SK": "CUST#" + customerId,
                    "Details": {
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
            console.log("Added " + customerId);
        }
        catch (e) {
            console.log(e);
        }
    };
}

export {
    buildRandomOrders,
    storeCustomersInfo,
    delay,
    ddbDocClient
}