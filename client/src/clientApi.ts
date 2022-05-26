import { fetch } from 'serverless-trading-system-utility-layer/util/dependencies'; 
import { EntryOrder } from 'serverless-trading-system-utility-layer/util/types';

import { DataExtractorInvokeUrl, ApiKey } from './sandbox/constants' //this is excluded from the git repo.

interface PostOrdersReply {
    message: string;
    validOrders: EntryOrder[];
    invalidOrders: EntryOrder[];
}

async function postOrders(randomOrders: object, apiUrl: string, apiKeyRequired = false) : Promise<PostOrdersReply> {
    const response = await fetch(apiUrl + 'orders', {
        method: 'POST',
        body: JSON.stringify(randomOrders),
        ...(apiKeyRequired ? {headers: {'Content-Type': 'application/json','x-api-key': ApiKey}} : {}),
    });
    const { message, validOrders, invalidOrders } = await response.json() as any;
    return { message: message, validOrders:  validOrders, invalidOrders: invalidOrders };
}

async function getCustomerTrades(uri: string) {
    const response = await fetch(DataExtractorInvokeUrl + uri, {
        method: 'GET',
        headers: {'Content-Type': 'application/json',
                  'x-api-key': ApiKey
                 }
    });
    return await response.json();
}

  export {
    postOrders,
    getCustomerTrades,
  }