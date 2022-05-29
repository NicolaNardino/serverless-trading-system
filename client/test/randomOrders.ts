import { Type } from "serverless-trading-system-utility-layer/util/types";
import { buildRandomOrders } from "../src/utils";

describe("random orders test", () => {
  it("random orders with undefined price have type = Market", () => {
    const nrOrders = 10;
    const randomOrders = buildRandomOrders(nrOrders);
    expect(randomOrders.length).toBe(nrOrders);
    randomOrders.forEach(order => {
      if (order.price == undefined) 
        expect(order.type).toBe(Type.Market);
    })
  });
});