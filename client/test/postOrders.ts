import { buildRandomOrders, postOrders } from "../src/utils";
import { SmartOrderRouterInvokeUrl } from '../src/sandbox/constants'

describe("post orders and get for reply", () => {
  it("should get the same number of items in the returned array", async () => {
    const nrOrders = 10;
    const result = await postOrders(buildRandomOrders(nrOrders), SmartOrderRouterInvokeUrl);
    expect(result).toHaveProperty("validOrders");
    expect(result).toHaveProperty("invalidOrders");
  });
});