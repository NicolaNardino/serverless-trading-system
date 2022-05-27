import { fetch } from 'serverless-trading-system-utility-layer/util/dependencies';
import { EntryOrder, Trade } from 'serverless-trading-system-utility-layer/util/types';

import { DataExtractorInvokeUrl, ApiKey } from './sandbox/constants' //this is excluded from the git repo.

async function getCustomerTrades(customerId: string, tradeDate: string): Promise<Trade[]> {
    const uri: string = 'trades/'+customerId+'?tradeDate='+tradeDate;
    const response = await fetch(DataExtractorInvokeUrl + uri, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ApiKey
        }
    });
    const trades = await response.json() as any[];
    return trades.map(trade => {
        const { InitialQuantity, TradeId, Fee, Direction, TradeDate, OrderDate, Quantity, Type, InternalOrderId, Ticker, ExchangeType, Price, Exchange } = trade;
        return {
            customerId: customerId, direction: Direction, ticker: Ticker, type: Type, quantity: Quantity, price: Price, orderId: InternalOrderId, orderDate: OrderDate, initialQuantity: InitialQuantity, tradeId: TradeId,
            tradeDate: TradeDate, exchange: Exchange, exchangeType: ExchangeType, fee: Fee
        };
    });
}

async function getCustomerData(customerId: string) {
    const uri: string = 'customers/'+customerId;
    const response = await fetch(DataExtractorInvokeUrl + uri, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ApiKey
        }
    });
    return await response.json();
}

async function postOrders(randomOrders: object, apiUrl: string, apiKeyRequired = false): Promise<PostOrdersReply> {
    const response = await fetch(apiUrl + 'orders', {
        method: 'POST',
        body: JSON.stringify(randomOrders),
        ...(apiKeyRequired ? { headers: { 'Content-Type': 'application/json', 'x-api-key': ApiKey } } : {}),
    });
    const { message, validOrders, invalidOrders } = await response.json() as any;
    return { message: message, validOrders: validOrders, invalidOrders: invalidOrders };
}

interface PostOrdersReply {
    message: string;
    validOrders: EntryOrder[];
    invalidOrders: EntryOrder[];
}

export {
    postOrders,
    getCustomerData,
    getCustomerTrades
}