export const FIRE_SPECIALISTS_SPREADSHEET_ID = "17EMSJgJJcyfDqxdGd4uT3nXKH-CztozpfASe0TP4K_s";

export type FireSpecialistRow = Record<string, string | undefined>;
export type FireClassification =
  | "delivery professional"
  | "inspector"
  | "installer"
  | "consultant"
  | "supplier/manufacturer"
  | "potential delivery partner"
  | "decision-maker"
  | "prospect/client"
  | "competitor";

const value = (row: FireSpecialistRow, ...keys: string[]) =>
  keys.map((key) => row[key] ?? "").join(" ").toLowerCase();

/** Conservative classification: source keywords are signals, never credential proof. */
export function classifyFireSpecialist(row: FireSpecialistRow): FireClassification {
  const haystack = value(row, "Title", "Industry", "Keywords", "Company Name", "Departments");
  if (/\bcompetitor\b/.test(haystack)) return "competitor";
  if (/manufacturer|supplier|distributor|wholesale/.test(haystack)) return "supplier/manufacturer";
  if (/inspector|inspection|assessor|fire risk assessor|abbe/.test(haystack)) return "inspector";
  if (/installer|installation|fire door fitter|carpenter/.test(haystack)) return "installer";
  if (/consultant|consultancy|advisor/.test(haystack)) return "consultant";
  if (/director|owner|founder|head of|manager|chief/.test(haystack)) return "decision-maker";
  if (/housing|care home|facilities|property|school|estate/.test(haystack)) return "prospect/client";
  if (/fire door|passive fire|fire stopping|fire safety/.test(haystack)) return "potential delivery partner";
  return "potential delivery partner";
}

export function professionalDedupeKey(row: FireSpecialistRow): string {
  const email = value(row, "Email").trim();
  if (email) return `email:${email}`;
  const linkedIn = value(row, "Person Linkedin Url").trim();
  if (linkedIn) return `linkedin:${linkedIn}`;
  return `name:${value(row, "First Name", "Last Name").replace(/\s+/g, "-")}|company:${value(row, "Company Name").replace(/\s+/g, "-")}`;
}

export function toUnverifiedProfessional(row: FireSpecialistRow) {
  return {
    name: [row["First Name"], row["Last Name"]].filter(Boolean).join(" ") || "Unknown",
    company: row["Company Name"], role: row.Title, email: row.Email, phone: row["Corporate Phone"],
    linkedinUrl: row["Person Linkedin Url"], website: row.Website,
    geography: [row.City, row.State, row.Country].filter(Boolean).join(", ") || undefined,
    source: `Google Sheet ${FIRE_SPECIALISTS_SPREADSHEET_ID}`,
    verification: "UNREVIEWED" as const,
  };
}
