export type EntitlementComponent = {
  kind: "fixed" | "percentage" | "introduction" | "success" | "milestone";
  amount?: number;
  percentage?: number;
  basisValue?: number;
  contractuallyEvidenced?: boolean;
  earned?: boolean;
  invoicedAmount?: number;
  paidAmount?: number;
  trigger?: string;
};

export type EntitlementSummary = {
  projected: number;
  contractuallyEvidenced: number;
  earned: number;
  invoiced: number;
  paid: number;
  outstanding: number;
};

/**
 * Calculates each economic state independently.  Projected value never leaks
 * into earned, invoiced or paid totals without an explicit state on the fee.
 */
export function calculateEntitlement(components: EntitlementComponent[]): EntitlementSummary {
  return components.reduce<EntitlementSummary>((totals, component) => {
    const value = component.kind === "percentage"
      ? ((component.basisValue ?? 0) * (component.percentage ?? 0)) / 100
      : (component.amount ?? 0);
    totals.projected += value;
    if (component.contractuallyEvidenced) totals.contractuallyEvidenced += value;
    if (component.earned) totals.earned += value;
    totals.invoiced += component.invoicedAmount ?? 0;
    totals.paid += component.paidAmount ?? 0;
    totals.outstanding = Math.max(0, totals.invoiced - totals.paid);
    return totals;
  }, { projected: 0, contractuallyEvidenced: 0, earned: 0, invoiced: 0, paid: 0, outstanding: 0 });
}
