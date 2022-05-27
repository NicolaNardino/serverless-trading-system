import { buildRandomOrders } from "../src/utils";
import { postOrders } from "../src/clientApi";
import { SmartOrderRouterInvokeUrl } from '../src/sandbox/constants'

describe("post orders and get reply", () => {
  it("should get the same number of sent orders in the returned arrays of valid and invalidOrders", async () => {
    const nrOrders = 10;
    const result = await postOrders(buildRandomOrders(nrOrders), SmartOrderRouterInvokeUrl);
    console.log(result);
    expect(result).toHaveProperty("validOrders");
    expect(result).toHaveProperty("invalidOrders");
    expect(result.validOrders.length + result.invalidOrders.length).toBe(nrOrders);
  });
});