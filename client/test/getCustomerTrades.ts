import { getCustomerData, getCustomerTrades} from "../src/clientApi";

describe("get customer details and trades", () => {
    it("get customer data", async () => {
        const result = await getCustomerData('000008');
        expect(result).toHaveProperty("Details");
        expect(result).toHaveProperty("TotalCommissionPaid");
        expect(result).toHaveProperty("NrTrades");
        expect(result).toHaveProperty("TotalAmountInvested");
        expect(result).toHaveProperty("RemainingFunds");
    });

    it("get customer trades in a given date", async () => {
        const trades = await getCustomerTrades('000008', '2022-03-13');
        expect(trades.length).toBe(9);
    });

    it("no trades for customer", async () => {
        expect((await getCustomerTrades('nocustomer','2022-03-13')).length).toBe(0);
    });
});