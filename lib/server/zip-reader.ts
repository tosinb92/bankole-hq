import { inflateRawSync } from "node:zlib";

type ZipEntry = { name: string; compression: number; compressedSize: number; localOffset: number };
const u16 = (bytes: Uint8Array, offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
const u32 = (bytes: Uint8Array, offset: number) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

/** Minimal, dependency-free ZIP reader for trusted Drive skill packages. */
export function readZipTextFiles(bytes: Uint8Array): Map<string, string> {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) if (u32(bytes, offset) === 0x06054b50) { end = offset; break; }
  if (end < 0) throw new Error("Invalid ZIP: end record not found.");
  let cursor = u32(bytes, end + 16);
  const entries: ZipEntry[] = [];
  while (cursor + 46 <= bytes.length && u32(bytes, cursor) === 0x02014b50) {
    const nameLength = u16(bytes, cursor + 28); const extraLength = u16(bytes, cursor + 30); const commentLength = u16(bytes, cursor + 32);
    entries.push({ name: new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength)), compression: u16(bytes, cursor + 10), compressedSize: u32(bytes, cursor + 20), localOffset: u32(bytes, cursor + 42) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  const output = new Map<string, string>();
  for (const entry of entries.filter((item) => /(^|\/)SKILL\.md$/i.test(item.name))) {
    const local = entry.localOffset;
    if (u32(bytes, local) !== 0x04034b50) continue;
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const compressed = bytes.slice(start, start + entry.compressedSize);
    const data = entry.compression === 0 ? compressed : entry.compression === 8 ? inflateRawSync(compressed) : undefined;
    if (!data) throw new Error(`Unsupported ZIP compression for ${entry.name}.`);
    output.set(entry.name, new TextDecoder().decode(data));
  }
  return output;
}
