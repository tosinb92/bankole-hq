import { classifyFireSpecialist, FIRE_SPECIALISTS_SPREADSHEET_ID, professionalDedupeKey, toUnverifiedProfessional, type FireSpecialistRow } from "@/lib/fire-specialists";
import { prisma } from "@/lib/server/prisma";

export async function importFireSpecialistRow(input: { tab: string; rowNumber: number; row: FireSpecialistRow }) {
  const dedupeKey = professionalDedupeKey(input.row);
  const existing = await prisma.professionalImport.findFirst({
    where: { sourceSpreadsheetId: FIRE_SPECIALISTS_SPREADSHEET_ID, dedupeKey },
    select: { id: true, professionalId: true },
  });
  if (existing) return { status: "duplicate" as const, importId: existing.id, professionalId: existing.professionalId };

  const classification = classifyFireSpecialist(input.row);
  const professional = await prisma.professional.create({ data: toUnverifiedProfessional(input.row) });
  const source = await prisma.professionalImport.create({
    data: {
      sourceSpreadsheetId: FIRE_SPECIALISTS_SPREADSHEET_ID,
      sourceTab: input.tab,
      sourceRow: input.rowNumber,
      rawRecord: input.row,
      professionalId: professional.id,
      classification,
      dedupeKey,
      importStatus: "Imported — unverified",
    },
  });
  return { status: "imported" as const, importId: source.id, professionalId: professional.id, classification };
}
