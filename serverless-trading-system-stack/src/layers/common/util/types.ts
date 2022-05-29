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
    split?: boolean;
    notMatchedInDarkPool?: boolean
};

interface Trade extends Order {
    price: number; //overrride to non-optional
    tradeId: string;
    tradeDate: string;
    exchange: string;
    exchangeType: ExchangeType;
    fee: number;
};

enum Direction { 
    Buy = "Buy", 
    Sell = "Sell" 
};

enum Type {
    Market = "Market",
    Limit = "Limit"
};

enum ExchangeType { 
    LitPool = "LitPool", 
    DarkPool = "DarkPool"
}

export {
    EntryOrder, 
    Order, 
    Trade, 
    Direction, 
    Type, 
    ExchangeType
}