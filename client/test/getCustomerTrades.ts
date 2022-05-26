import { getCustomerTrades } from "../src/clientApi";

describe("get customer details and trades", () => {
    it("get customer data", async () => {
        const result = await getCustomerTrades('customers/000008');
        expect(result).toHaveProperty("Details");
        expect(result).toHaveProperty("TotalCommissionPaid");
        expect(result).toHaveProperty("NrTrades");
        expect(result).toHaveProperty("TotalAmountInvested");
        expect(result).toHaveProperty("RemainingFunds");
    });

    it("get customer trades in a given date", async () => {
        const result = await getCustomerTrades('trades/000008?tradeDate=2022-03-13');
        //console.log(result);
        expect((result as any[]).length).toBe(9);
    });

    it("no trades for customer", async () => {
        expect((await getCustomerTrades('trades/noway?tradeDate=2022-03-13') as any[]).length).toBe(0);
    });
});