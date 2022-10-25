/**
 * This is meant to be used in a step function following a Map state in order to determine whether any historical data has been retrieved.
 * It provides the input to a Choice state.
 * */

export async function handler(input: Input): Promise<Output> {
  console.log(input);  
  return {...input, retrievedAnyItem : (input.tickers.find(item => item.itemsLoaded > 0) != undefined ? "Y" : "N")};
}

interface Input {
  tickers: {ticker: string; itemsLoaded: number}[];
}

interface Output extends Input {
  retrievedAnyItem: string;
}