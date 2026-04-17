/**
 * Loan amortization math. All amounts in cents; rates as annual basis points
 * (350 bps = 3.50% APR). Standard amortization formula with configurable
 * payment frequency (monthly, quarterly, semi-annual, annual). Degrades to a
 * linear split when the interest rate is 0.
 */

export type PaymentFrequency =
  | "monthly"
  | "bi_monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";

export const PERIOD_MONTHS: Record<PaymentFrequency, number> = {
  monthly: 1,
  bi_monthly: 2,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

export type LoanParams = {
  principal: number;
  interestRateBps: number;
  termMonths: number;
  paymentFrequency: PaymentFrequency;
};

export type LoanSummary = {
  periodicPayment: number;
  monthlyEquivalent: number;
  numberOfPayments: number;
  totalPaid: number;
  totalInterest: number;
  paymentsMade: number;
  outstandingBalance: number;
  principalPaid: number;
  interestPaidToDate: number;
  payoffDate: string;
  progress: number;
};

export type ScheduleEntry = {
  index: number;
  paymentDate: string;
  interest: number;
  principal: number;
  payment: number;
  balanceAfter: number;
};

function periodicRate(interestRateBps: number, periodMonths: number) {
  return (interestRateBps / 10000) * (periodMonths / 12);
}

export function numberOfPayments(params: LoanParams): number {
  return Math.max(
    1,
    Math.ceil(params.termMonths / PERIOD_MONTHS[params.paymentFrequency]),
  );
}

export function periodicPayment(params: LoanParams): number {
  const { principal } = params;
  const n = numberOfPayments(params);
  if (n <= 0) return 0;
  const pm = PERIOD_MONTHS[params.paymentFrequency];
  const r = periodicRate(params.interestRateBps, pm);
  if (r === 0) return Math.round(principal / n);
  const factor = Math.pow(1 + r, n);
  return Math.round((principal * r * factor) / (factor - 1));
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid ISO date: ${iso}`);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDayOfTargetMonth);
  const result = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day),
  );
  return result.toISOString().slice(0, 10);
}

function diffMonths(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  return months;
}

/**
 * Count how many scheduled periodic payments have elapsed between the loan
 * start date and the reference date. Payments fall on the start-date
 * anniversary every periodMonths months.
 */
export function paymentsElapsed(
  params: LoanParams,
  startDate: string,
  asOf: string,
): number {
  const pm = PERIOD_MONTHS[params.paymentFrequency];
  const n = numberOfPayments(params);
  const rawMonths = diffMonths(startDate, asOf);
  if (rawMonths <= 0) return 0;
  return Math.min(Math.floor(rawMonths / pm), n);
}

export function buildSchedule(
  params: LoanParams,
  startDate: string,
): ScheduleEntry[] {
  const pm = PERIOD_MONTHS[params.paymentFrequency];
  const n = numberOfPayments(params);
  const r = periodicRate(params.interestRateBps, pm);
  const M = periodicPayment(params);

  const entries: ScheduleEntry[] = [];
  let balance = params.principal;

  for (let i = 1; i <= n; i++) {
    const interest = r === 0 ? 0 : Math.round(balance * r);
    let principalPortion = M - interest;
    let payment = M;
    if (i === n || principalPortion > balance) {
      principalPortion = balance;
      payment = balance + interest;
    }
    balance -= principalPortion;
    if (balance < 0) balance = 0;

    entries.push({
      index: i,
      paymentDate: addMonths(startDate, i * pm),
      interest,
      principal: principalPortion,
      payment,
      balanceAfter: balance,
    });
  }

  return entries;
}

export function summarize(
  params: LoanParams,
  startDate: string,
  asOf: string,
): LoanSummary {
  const pm = PERIOD_MONTHS[params.paymentFrequency];
  const n = numberOfPayments(params);
  const M = periodicPayment(params);
  const paymentsMade = paymentsElapsed(params, startDate, asOf);

  let balance = params.principal;
  let interestPaid = 0;
  let principalPaid = 0;
  const r = periodicRate(params.interestRateBps, pm);

  for (let i = 1; i <= paymentsMade; i++) {
    const interest = r === 0 ? 0 : Math.round(balance * r);
    let principalPortion = M - interest;
    if (i === n || principalPortion > balance) {
      principalPortion = balance;
    }
    balance -= principalPortion;
    interestPaid += interest;
    principalPaid += principalPortion;
    if (balance <= 0) {
      balance = 0;
      break;
    }
  }

  const schedule = buildSchedule(params, startDate);
  const totalPaid = schedule.reduce((s, e) => s + e.payment, 0);
  const totalInterest = schedule.reduce((s, e) => s + e.interest, 0);

  return {
    periodicPayment: M,
    monthlyEquivalent: Math.round(M / pm),
    numberOfPayments: n,
    totalPaid,
    totalInterest,
    paymentsMade,
    outstandingBalance: balance,
    principalPaid,
    interestPaidToDate: interestPaid,
    payoffDate: addMonths(startDate, n * pm),
    progress: params.principal === 0 ? 1 : principalPaid / params.principal,
  };
}
