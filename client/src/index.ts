import { SmartOrderRouterInvokeUrl } from './sandbox/constants' //this is excluded from the git repo.
import { buildRandomOrders, postOrders } from './utils'

(async () => {
    //await storeCustomersInfo("TradesStore");
    //console.log(await getCustomerTrades());
    
    console.log(await postOrders(buildRandomOrders(7), SmartOrderRouterInvokeUrl));
})();