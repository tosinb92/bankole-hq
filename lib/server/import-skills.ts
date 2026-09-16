import { googleDrive } from "@/lib/server/google-workspace";
import { prisma } from "@/lib/server/prisma";
import { readZipTextFiles } from "@/lib/server/zip-reader";

type Frontmatter = { name?: string; description?: string; version?: string };
const frontmatter = (text: string): Frontmatter => {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const entries = match[1].split("\n").flatMap((line) => {
    const divider = line.indexOf(":");
    return divider < 0 ? [] : [[line.slice(0, divider).trim(), line.slice(divider + 1).trim().replace(/^['\"]|['\"]$/g, "")] as const];
  });
  return Object.fromEntries(entries);
};

export async function importSkillZip(input: { fileId: string; fileName: string; bytes: Uint8Array }) {
  const sources = readZipTextFiles(input.bytes);
  const imported: string[] = [];
  for (const [path, instructions] of sources) {
    const meta = frontmatter(instructions);
    if (!meta.name) continue;
    const skill = await prisma.skill.upsert({
      where: { name: meta.name },
      create: { name: meta.name, description: meta.description, sourceUrl: `https://drive.google.com/file/d/${input.fileId}/view`, sourceFileId: input.fileId, sourceFile: `${input.fileName}:${path}`, sourceVersion: meta.version, instructions, active: false },
      update: { description: meta.description, sourceUrl: `https://drive.google.com/file/d/${input.fileId}/view`, sourceFileId: input.fileId, sourceFile: `${input.fileName}:${path}`, sourceVersion: meta.version, instructions, active: false },
    });
    await prisma.skillSource.upsert({
      where: { skillId_driveFileId_sourcePath: { skillId: skill.id, driveFileId: input.fileId, sourcePath: path } },
      create: { skillId: skill.id, driveFileId: input.fileId, zipFileName: input.fileName, sourcePath: path, sourceUrl: `https://drive.google.com/file/d/${input.fileId}/view`, sourceVersion: meta.version, instructions },
      update: { zipFileName: input.fileName, sourceVersion: meta.version, instructions },
    });
    imported.push(meta.name);
  }
  return imported;
}

/** Imports ZIP sources only. It never executes source scripts or activates a skill. */
export async function importSkillsDriveFolder(folderId = process.env.SKILLS_DRIVE_FOLDER_ID) {
  if (!folderId) throw new Error("SKILLS_DRIVE_FOLDER_ID is not configured.");
  const files = await googleDrive.listDocuments(folderId);
  const zipFiles = files.filter((file) => file.mimeType === "application/zip");
  const results: { fileName: string; skills: string[] }[] = [];
  for (const file of zipFiles) {
    const source = await googleDrive.downloadDocument(file.providerFileId);
    results.push({ fileName: file.name, skills: await importSkillZip({ fileId: file.providerFileId, fileName: file.name, bytes: source.bytes }) });
  }
  return results;
}
