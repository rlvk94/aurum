import { describe, it, expect } from "vitest";
import {
  buildSchedule,
  numberOfPayments,
  paymentsElapsed,
  periodicPayment,
  summarize,
  type LoanParams,
} from "./amortization";

const monthly = (p: Omit<LoanParams, "paymentFrequency">): LoanParams => ({
  ...p,
  paymentFrequency: "monthly",
});

describe("amortization", () => {
  describe("periodicPayment", () => {
    it("computes standard monthly amortization payment", () => {
      // $100,000 @ 6% APR for 30 years ≈ $599.55
      const cents = periodicPayment(
        monthly({
          principal: 10_000_000,
          interestRateBps: 600,
          termMonths: 360,
        }),
      );
      expect(cents).toBeGreaterThan(59_900);
      expect(cents).toBeLessThan(60_000);
    });

    it("degrades to linear split when rate is 0", () => {
      expect(
        periodicPayment(
          monthly({
            principal: 120_000,
            interestRateBps: 0,
            termMonths: 12,
          }),
        ),
      ).toBe(10_000);
    });

    it("quarterly payment on 100k / 4% / 2 years ≈ $13,069", () => {
      const cents = periodicPayment({
        principal: 10_000_000,
        interestRateBps: 400,
        termMonths: 24,
        paymentFrequency: "quarterly",
      });
      // 8 quarterly payments, quarterly rate 1%
      expect(cents).toBeGreaterThan(1_306_000);
      expect(cents).toBeLessThan(1_308_000);
    });

    it("annual payment on 100k / 5% / 10 years ≈ $12,950", () => {
      const cents = periodicPayment({
        principal: 10_000_000,
        interestRateBps: 500,
        termMonths: 120,
        paymentFrequency: "annual",
      });
      expect(cents).toBeGreaterThan(1_290_000);
      expect(cents).toBeLessThan(1_300_000);
    });
  });

  describe("numberOfPayments", () => {
    it("divides term by period length", () => {
      expect(
        numberOfPayments({
          principal: 100,
          interestRateBps: 500,
          termMonths: 24,
          paymentFrequency: "quarterly",
        }),
      ).toBe(8);
      expect(
        numberOfPayments({
          principal: 100,
          interestRateBps: 500,
          termMonths: 60,
          paymentFrequency: "semi_annual",
        }),
      ).toBe(10);
      expect(
        numberOfPayments({
          principal: 100,
          interestRateBps: 500,
          termMonths: 120,
          paymentFrequency: "annual",
        }),
      ).toBe(10);
    });

    it("rounds up non-divisible terms", () => {
      expect(
        numberOfPayments({
          principal: 100,
          interestRateBps: 500,
          termMonths: 25,
          paymentFrequency: "quarterly",
        }),
      ).toBe(9);
    });
  });

  describe("buildSchedule", () => {
    it("produces termMonths entries for monthly loans and ends at zero", () => {
      const schedule = buildSchedule(
        monthly({
          principal: 10_000_000,
          interestRateBps: 600,
          termMonths: 360,
        }),
        "2024-01-15",
      );
      expect(schedule).toHaveLength(360);
      expect(schedule[359]?.balanceAfter).toBe(0);
      expect(schedule[0]?.paymentDate).toBe("2024-02-15");
    });

    it("keeps interest + principal equal to payment each row", () => {
      const schedule = buildSchedule(
        monthly({
          principal: 500_000,
          interestRateBps: 1200,
          termMonths: 24,
        }),
        "2024-01-01",
      );
      for (const row of schedule) {
        expect(row.interest + row.principal).toBe(row.payment);
      }
    });

    it("quarterly schedule spaces payments 3 months apart", () => {
      const schedule = buildSchedule(
        {
          principal: 1_000_000,
          interestRateBps: 400,
          termMonths: 12,
          paymentFrequency: "quarterly",
        },
        "2024-01-15",
      );
      expect(schedule).toHaveLength(4);
      expect(schedule[0]?.paymentDate).toBe("2024-04-15");
      expect(schedule[1]?.paymentDate).toBe("2024-07-15");
      expect(schedule[2]?.paymentDate).toBe("2024-10-15");
      expect(schedule[3]?.paymentDate).toBe("2025-01-15");
      expect(schedule[3]?.balanceAfter).toBe(0);
    });

    it("annual schedule spaces payments 12 months apart", () => {
      const schedule = buildSchedule(
        {
          principal: 5_000_000,
          interestRateBps: 500,
          termMonths: 60,
          paymentFrequency: "annual",
        },
        "2024-06-01",
      );
      expect(schedule).toHaveLength(5);
      expect(schedule[0]?.paymentDate).toBe("2025-06-01");
      expect(schedule[4]?.paymentDate).toBe("2029-06-01");
    });

    it("handles zero interest cleanly", () => {
      const schedule = buildSchedule(
        monthly({
          principal: 120_000,
          interestRateBps: 0,
          termMonths: 12,
        }),
        "2024-01-31",
      );
      expect(schedule).toHaveLength(12);
      expect(schedule[11]?.balanceAfter).toBe(0);
      for (const row of schedule) expect(row.interest).toBe(0);
    });
  });

  describe("paymentsElapsed", () => {
    it("counts monthly payments past the anniversary day", () => {
      expect(
        paymentsElapsed(
          monthly({
            principal: 100,
            interestRateBps: 500,
            termMonths: 360,
          }),
          "2024-05-15",
          "2024-08-15",
        ),
      ).toBe(3);
    });

    it("counts quarterly payments only after 3 months elapsed", () => {
      const params: LoanParams = {
        principal: 100,
        interestRateBps: 500,
        termMonths: 24,
        paymentFrequency: "quarterly",
      };
      expect(paymentsElapsed(params, "2024-01-15", "2024-02-15")).toBe(0);
      expect(paymentsElapsed(params, "2024-01-15", "2024-04-15")).toBe(1);
      expect(paymentsElapsed(params, "2024-01-15", "2024-07-15")).toBe(2);
    });

    it("caps at number of payments", () => {
      expect(
        paymentsElapsed(
          {
            principal: 100,
            interestRateBps: 500,
            termMonths: 12,
            paymentFrequency: "annual",
          },
          "2020-01-01",
          "2099-01-01",
        ),
      ).toBe(1);
    });
  });

  describe("summarize", () => {
    it("returns full principal outstanding before first payment", () => {
      const s = summarize(
        monthly({
          principal: 1_000_000,
          interestRateBps: 500,
          termMonths: 60,
        }),
        "2024-06-01",
        "2024-06-15",
      );
      expect(s.paymentsMade).toBe(0);
      expect(s.outstandingBalance).toBe(1_000_000);
      expect(s.progress).toBe(0);
    });

    it("returns zero balance after full term has elapsed", () => {
      const s = summarize(
        monthly({
          principal: 500_000,
          interestRateBps: 1200,
          termMonths: 24,
        }),
        "2022-01-01",
        "2024-02-01",
      );
      expect(s.paymentsMade).toBe(24);
      expect(s.outstandingBalance).toBe(0);
    });

    it("returns a mid-term balance for quarterly loan", () => {
      const s = summarize(
        {
          principal: 10_000_000,
          interestRateBps: 400,
          termMonths: 24,
          paymentFrequency: "quarterly",
        },
        "2024-01-01",
        "2024-10-01",
      );
      expect(s.paymentsMade).toBe(3);
      expect(s.outstandingBalance).toBeLessThan(10_000_000);
      expect(s.outstandingBalance).toBeGreaterThan(5_000_000);
    });

    it("exposes monthlyEquivalent for cross-frequency summing", () => {
      const quarterly = summarize(
        {
          principal: 1_200_000,
          interestRateBps: 0,
          termMonths: 12,
          paymentFrequency: "quarterly",
        },
        "2024-01-01",
        "2024-01-01",
      );
      expect(quarterly.periodicPayment).toBe(300_000);
      expect(quarterly.monthlyEquivalent).toBe(100_000);
    });
  });
});
