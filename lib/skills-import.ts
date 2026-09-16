export type ParsedSkillSource = {
  name: string;
  sourceFile: string;
  version?: string;
  instructions?: string;
  requiredInputs?: unknown;
};

/** A source must explicitly contain instructions; file names alone never create executable content. */
export function canActivateSkill(source: ParsedSkillSource): boolean {
  return Boolean(source.instructions?.trim() && source.sourceFile && source.name);
}

export const blockedSkillImportReason = "Awaiting Google Drive ZIP/source file. No instructions have been inferred.";
