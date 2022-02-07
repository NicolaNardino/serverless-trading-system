import fetch from 'node-fetch';
import {SmartOrderRouterInvokeUrl, DataExtractorInvokeUrl, ApiKey } from '../sandbox/constants.js' //this is excluded from the git repo.
import {getRandom, getRandomInteger, getRandomArrayEntry} from '../../lambda-layer/nodejs/src/utils.js';

async function getCustomerTrades() {
    const response = await fetch(DataExtractorInvokeUrl + 'trades/000007?tradeDate=2022-01-22', {//customers/000007
        method: 'GET',
        headers: {'Content-Type': 'application/json',
                  'x-api-key': ApiKey
                 }
    });
    return await response.json();
}

async function postOrders(randomOrders) {
    const response = await fetch(SmartOrderRouterInvokeUrl + 'orders', {
        method: 'POST',
        headers: {'Content-Type': 'application/json',
                  'x-api-key': ApiKey
                 },
        body: JSON.stringify(randomOrders)
    });
    return await response.json();
}

const prepareRandomOrders = (nrOrders) => {
    const customers = ['000001', '000002', '000003', '000004', '000005', '000006','000007','000008','000009','0000010', '0000011', '0000012'];
    const tickers = ['FB', 'AMD', 'AMZN', 'APPL', 'GOOG', 'NFLX', 'F', 'T', 'MO', 'PFE', 'COIN', 'MRNA', 'ORCL', 'TSLA', 'NVDA', 'MSFT', 'UBSN', 'CSGN'];
    const directions = ['Buy', 'Sell'];
    const types = ['Market', 'Limit']
    return [...Array(nrOrders)].map((_, i) => {
      const randomType = getRandomArrayEntry(types);
      return {
        customerId: getRandomArrayEntry(customers),
        direction: getRandomArrayEntry(directions),
        ticker: getRandomArrayEntry(tickers),
        type: randomType,
        quantity: getRandomInteger(50, 10000),
        ...(randomType === "Limit" ? { price: getRandom(100, 200).toFixed(2) } : {})
      }
    });
  }

(async () => {
    console.log(await getCustomerTrades());
    console.log(await postOrders(prepareRandomOrders(12)));
})();