export enum Direction {Buy, Sell};

export enum Type {Market, Limit};

export interface Order {
    customerId: string;
    direction: Direction;
    ticker: string;
    type: Type;
    quantity: number;
    price: number;
    orderId: string;
    orderDate: string;
};