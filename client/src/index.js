import fetch from 'node-fetch';
import {SmartOrderRouterInvokeUrl, DataExtractorInvokeUrl, ApiKey } from '../sandbox/constants.js' //this is excluded from the git repo.
import { buildRandomOrders, storeCustomersInfo } from './utils.js'

async function getCustomerTrades() {
    const response = await fetch(DataExtractorInvokeUrl + 'trades/000007?tradeDate=2022-01-22', {//customers/000007
        method: 'GET',
        headers: {'Content-Type': 'application/json',
                  'x-api-key': ApiKey
                 }
    });
    return await response.json();
}

async function postOrders(randomOrders, apiUrl, apiKeyRequired = false) {
    const response = await fetch(apiUrl + 'orders', {
        method: 'POST',
        body: JSON.stringify(randomOrders),
        ...(apiKeyRequired ? {headers: {'Content-Type': 'application/json','x-api-key': ApiKey}} : {}),
    });
    return await response.json();
}



(async () => {
    await storeCustomersInfo("TradesStore");
    //console.log(await getCustomerTrades());
    //console.log(await postOrders(buildRandomOrders(12), SmartOrderRouterInvokeUrl));
})();
