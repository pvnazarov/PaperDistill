/*
 * PaperDistill
 * Copyright (c) 2026 Petr Nazarov, Luxembourg Institute of Health (LIH)
 *
 * Released under the MIT License.
 * Developed with significant assistance from Anthropic Claude Code.
 * Responsibility for any bugs remains under active investigation.
 *
 * See LICENSE for details.
 */

import JSZip from "jszip";

/*
 * A minimal XLSX reader. An .xlsx file is a ZIP of XML parts, so JSZip plus a
 * little regex work is enough to recover the cell values — which is all the LLM
 * needs. We deliberately ignore styling, merges, charts and images, and read
 * only the cached result of a formula rather than evaluating it.
 */

/** Built-in numFmtIds that Excel reserves for dates and times. */
const BUILTIN_DATE_NUMFMT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Excel's day 1 is 1900-01-01, so the day-zero anchor is 1899-12-31. */
const EXCEL_DAY_ZERO_MS = Date.UTC(1899, 11, 31);
const MS_PER_DAY = 86400000;

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number(dec)))
    // Must come last, so that "&amp;lt;" decodes to "&lt;" and not to "<".
    .replace(/&amp;/g, "&");
}

/** Concatenates every <t> run inside an XML fragment, e.g. a shared-string <si>. */
function joinTextRuns(fragment: string): string {
  const runs = fragment.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return runs
    .map((run) => decodeXmlText(run.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
    .join("");
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXmlText(match[1]) : null;
}

/** "BQ12" -> 68 (zero-based). */
export function columnIndexFromRef(cellRef: string): number {
  const letters = cellRef.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "A";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

/**
 * Converts an Excel serial date to "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", or
 * "HH:MM:SS" for a time-only value. Returns the raw number as text when the
 * serial is out of range.
 */
export function excelSerialToDateString(serial: number): string {
  if (!Number.isFinite(serial) || serial < 0) return String(serial);

  let days = Math.floor(serial);
  const timeMs = Math.round((serial - days) * MS_PER_DAY);
  // Excel treats the non-existent 1900-02-29 (serial 60) as a real day, so
  // every serial past it is one day ahead of the true calendar.
  if (days > 59) days -= 1;

  const date = new Date(EXCEL_DAY_ZERO_MS + days * MS_PER_DAY + timeMs);
  if (Number.isNaN(date.getTime())) return String(serial);

  const iso = date.toISOString();
  if (days === 0) return iso.slice(11, 19);
  if (timeMs === 0) return iso.slice(0, 10);
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
}

/** True for format codes such as "dd/mm/yyyy" but not "#,##0.00" or "General". */
export function looksLikeDateFormat(formatCode: string): boolean {
  const withoutLiterals = formatCode
    .replace(/\\./g, "")
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "");
  return /[ymdhs]/i.test(withoutLiterals);
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const items = xml.match(/<si\b[^>]*>([\s\S]*?)<\/si>/g) ?? [];
  return items.map((item) => joinTextRuns(item));
}

/**
 * Returns the set of cellXfs indices whose number format is a date or time, so
 * that numeric cells carrying those styles can be rendered as dates.
 */
function parseDateStyleIndices(stylesXml: string | null): Set<number> {
  const dateStyles = new Set<number>();
  if (!stylesXml) return dateStyles;

  const dateNumFmtIds = new Set(BUILTIN_DATE_NUMFMT_IDS);
  for (const tag of stylesXml.match(/<numFmt\b[^>]*\/?>/g) ?? []) {
    const id = Number(attribute(tag, "numFmtId"));
    const formatCode = attribute(tag, "formatCode");
    if (Number.isFinite(id) && formatCode && looksLikeDateFormat(formatCode)) {
      dateNumFmtIds.add(id);
    }
  }

  const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  const xfs = cellXfs.match(/<xf\b[^>]*\/?>/g) ?? [];
  xfs.forEach((xf, index) => {
    const numFmtId = Number(attribute(xf, "numFmtId"));
    if (Number.isFinite(numFmtId) && dateNumFmtIds.has(numFmtId)) {
      dateStyles.add(index);
    }
  });

  return dateStyles;
}

interface SheetRef {
  name: string;
  zipPath: string;
}

function resolveSheetRefs(workbookXml: string, relsXml: string | null): SheetRef[] {
  const targetsByRelId = new Map<string, string>();
  for (const tag of relsXml?.match(/<Relationship\b[^>]*\/?>/g) ?? []) {
    const id = attribute(tag, "Id");
    const target = attribute(tag, "Target");
    if (id && target) targetsByRelId.set(id, target);
  }

  const sheetTags = workbookXml.match(/<sheet\b[^>]*\/?>/g) ?? [];
  return sheetTags.map((tag, index) => {
    const name = attribute(tag, "name") ?? `Sheet${index + 1}`;
    const relId = attribute(tag, "r:id") ?? attribute(tag, "id");
    const target = relId ? targetsByRelId.get(relId) : undefined;
    const zipPath = target
      ? target.replace(/^\/?(xl\/)?/, "xl/")
      : `xl/worksheets/sheet${index + 1}.xml`;
    return { name, zipPath };
  });
}

function cellValue(
  attrs: string,
  inner: string,
  sharedStrings: string[],
  dateStyleIndices: Set<number>,
): string {
  const type = attribute(attrs, "t") ?? "n";
  const rawValue = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";

  switch (type) {
    case "s": {
      const index = Number(decodeXmlText(rawValue));
      return sharedStrings[index] ?? "";
    }
    case "inlineStr":
      return joinTextRuns(inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? inner);
    case "b":
      return decodeXmlText(rawValue) === "1" ? "TRUE" : "FALSE";
    case "str":
    case "e":
    case "d":
      return decodeXmlText(rawValue);
    default: {
      const text = decodeXmlText(rawValue);
      if (text === "") return "";
      const styleIndex = Number(attribute(attrs, "s"));
      if (Number.isFinite(styleIndex) && dateStyleIndices.has(styleIndex)) {
        return excelSerialToDateString(Number(text));
      }
      return text;
    }
  }
}

function parseSheetRows(
  sheetXml: string,
  sharedStrings: string[],
  dateStyleIndices: Set<number>,
): string[] {
  const sheetData = sheetXml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/)?.[1] ?? "";
  // Splitting on the row tag keeps self-closing <row/> elements from swallowing
  // the next row, which a single paired-tag regex would do.
  const rowChunks = sheetData.split(/<row\b/).slice(1);

  const rows: string[] = [];
  for (const chunk of rowChunks) {
    const body = chunk.split("</row>")[0];
    const cells: string[] = [];

    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let match: RegExpExecArray | null;
    while ((match = cellPattern.exec(body)) !== null) {
      const attrs = match[1];
      const inner = match[2] ?? "";
      const ref = attribute(attrs, "r");
      const column = ref ? columnIndexFromRef(ref) : cells.length;
      const value = cellValue(attrs, inner, sharedStrings, dateStyleIndices);
      while (cells.length < column) cells.push("");
      cells[column] = value;
    }

    if (cells.some((cell) => cell !== "")) {
      rows.push(cells.join("\t").replace(/\t+$/, ""));
    }
  }

  return rows;
}

/**
 * Extracts every sheet's cell values as tab-separated rows, each sheet prefixed
 * with a `[SHEET <name>]` marker (mirroring the `[PAGE n]` markers used for PDFs).
 * Empty rows and empty sheets are omitted.
 */
export async function extractXlsxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  async function readPart(zipPath: string): Promise<string | null> {
    const file = zip.file(zipPath);
    return file ? file.async("string") : null;
  }

  const workbookXml = await readPart("xl/workbook.xml");
  if (!workbookXml) {
    throw new Error("Not a readable XLSX file: xl/workbook.xml is missing.");
  }

  const sharedStrings = parseSharedStrings(await readPart("xl/sharedStrings.xml"));
  const dateStyleIndices = parseDateStyleIndices(await readPart("xl/styles.xml"));
  const sheetRefs = resolveSheetRefs(workbookXml, await readPart("xl/_rels/workbook.xml.rels"));

  const sections: string[] = [];
  for (const sheet of sheetRefs) {
    const sheetXml = await readPart(sheet.zipPath);
    if (!sheetXml) continue;
    const rows = parseSheetRows(sheetXml, sharedStrings, dateStyleIndices);
    if (rows.length === 0) continue;
    sections.push(`[SHEET ${sheet.name}]\n${rows.join("\n")}`);
  }

  return sections.join("\n\n");
}
