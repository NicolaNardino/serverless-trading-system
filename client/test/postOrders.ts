import { postOrders } from "../src/index";
import { buildRandomOrders} from '../src/utils.js'
import { SmartOrderRouterInvokeUrl } from '../src/sandbox/constants'

describe("post orders and get for reply", () => {
  it("should get the same number of items in the returned array", async () => {
    const nrOrders = 10;
    const result = await postOrders(buildRandomOrders(10), SmartOrderRouterInvokeUrl);
    //TODO
  });
});