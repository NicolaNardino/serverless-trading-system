export async function handler(input: { tickers: {ticker: string; itemsLoaded: number}[] }): Promise<void> {
  console.log(input);
}