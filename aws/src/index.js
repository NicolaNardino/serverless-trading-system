const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });
const apiClient = require('aws-api-gateway-client').default;
const {SmartOrderRouterInvokeUrl, DataExtractorInvokeUrl, ApiKey } = require('../sandbox/constants.js') //this is excluded from the git repo.

const prepareRandomOrders = (nrOrders) => {
  const customers = ['000001', '000002', '000003', '000005', '000005', '000006', '000007', '000008', '000009', '0000010'];
  const tickers = ['FB', 'AMD', 'AMZN', 'APPL', 'GOOG', 'NFLX', 'F', 'T', 'MO', 'PFE', 'COIN', 'MRNA', 'ORCL', 'TSLA', 'NVDA', 'MSFT', 'UBSN', 'CSGN'];
  const directions = ['Buy', 'Sell'];
  const types = ['Market', 'Limit']
  return [...Array(nrOrders)].map((_, i) => {
    const randomType = getRandomArrayEntry(types);
    return {
      customerId: getRandomArrayEntry(customers),
      direction: getRandomArrayEntry(directions),
      ticker: getRandomArrayEntry(tickers),
      type: randomType,
      quantity: getRandomInteger(50, 10000),
      ...(randomType === "Limit" ? { price: getRandom(100, 200).toFixed(2) } : {})
    }
  });
}

async function invokeApi(apiGatewayConfig, body) {
  try {
      return (await apiClient.newClient({
          invokeUrl: apiGatewayConfig.invokeUrl,
          apiKey: apiGatewayConfig.apiKey,
          region: apiGatewayConfig.region
      }).invokeApi(undefined, apiGatewayConfig.path, apiGatewayConfig.httpMethod, undefined, body)).data;
  }
  catch(e) {
      console.log(e)
  }
}

async function testApiClient() {
    console.log(await invokeApi(
    {
      invokeUrl: DataExtractorInvokeUrl,
      apiKey: ApiKey,
      region: 'us-east-2',
      path: '/trades/000007?tradeDate=2022-01-22', //'/customers/000007'
      httpMethod: 'GET'
    }));

    console.log(await invokeApi(
      {
        invokeUrl: SmartOrderRouterInvokeUrl,
        apiKey: ApiKey,
        region: 'us-east-2',
        path: '/orders', 
        httpMethod: 'POST'
      }, prepareRandomOrders(5)));
}

const getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getRandom = (min, max) => Math.random() * (max - min) + min;

const getRandomArrayEntry = (array) => array[Math.floor(Math.random() * array.length)];

(async () => {
  testApiClient();
})();