interface EntryOrder {
    customerId: string;
    direction: Direction;
    ticker: string;
    type: Type;
    quantity: number;
    price?: number;
};

interface Order extends EntryOrder {
    orderId: string;
    orderDate: string;
    initialQuantity?: number;
    split?: string;
    notMatchedInDarkPool?: string
};

interface Trade extends Order {
    price: number; //overrride to non-optional
    tradeId: string;
    tradeDate: string;
    exchange: string;
    exchangeType: ExchangeType;
    fee: number;
};

enum Direction { Buy, Sell };

enum Type { Market, Limit };

enum ExchangeType { LitPool, DarkPool }

export {
    EntryOrder, Order, Trade, Direction, Type, ExchangeType
}