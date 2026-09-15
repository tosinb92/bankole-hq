export type Stage = "New lead" | "Requirements" | "Venue sourcing" | "Pricing" | "Call" | "Quote" | "Follow-up" | "Deposit" | "Venue secured" | "Confirmed" | "Event" | "Won" | "Lost";
export type VenueStatus = "Estimated" | "Historical" | "Verified" | "Booked";
export type AiStatus = "Queued" | "Running" | "Needs Approval" | "Completed" | "Failed" | "Blocked";
export type PricingRule = { id: string; name: string; activity: string; customerType: string; duration: number; min: number; max: number; staffing: number; equipment: number; minMargin: number; active: boolean };
