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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { extractDocumentText } from "./documentExtract";

/*
 * DOCX and XLSX fixtures are assembled here as real ZIP archives rather than
 * checked in as binaries, so the mammoth and JSZip readers are exercised against
 * genuine Office XML rather than a stub.
 */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
</Types>`;

function docxBuffer(paragraphs: string[]): Promise<Buffer> {
  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`)
    .join("");

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

interface SheetSpec {
  name: string;
  /** Raw <row> XML for the sheet's sheetData. */
  rowsXml: string;
}

function xlsxBuffer(
  sheets: SheetSpec[],
  options: { sharedStrings?: string[]; stylesXml?: string } = {},
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets
    .map((sheet, i) => `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("")}</sheets>
</workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map(
        (_sheet, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("")}</Relationships>`,
  );

  sheets.forEach((sheet, i) => {
    zip.file(
      `xl/worksheets/sheet${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheet.rowsXml}</sheetData>
</worksheet>`,
    );
  });

  if (options.sharedStrings) {
    zip.file(
      "xl/sharedStrings.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${options.sharedStrings
        .map((value) => `<si><t xml:space="preserve">${value}</t></si>`)
        .join("")}</sst>`,
    );
  }
  if (options.stylesXml) {
    zip.file("xl/styles.xml", options.stylesXml);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

describe("extractDocumentText", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperdistill-extract-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function write(fileName: string, content: string | Buffer): Promise<string> {
    const filePath = path.join(tempDir, fileName);
    await fs.writeFile(filePath, content);
    return filePath;
  }

  describe("plain text", () => {
    it("reads a .txt file and reports no page count", async () => {
      const filePath = await write("notes.txt", "First line\r\nSecond line\r\n");

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("First line\nSecond line");
      expect(result.fileName).toBe("notes.txt");
      expect(result.pageCount).toBeNull();
      expect(result.characterCount).toBe("First line\nSecond line".length);
      expect(result.extractionBackend).toBe("utf-8");
      expect(result.noTextWarning).toBeNull();
    });

    it("reads a .md file and keeps its Markdown syntax intact", async () => {
      const filePath = await write("readme.md", "# Title\n\n- bullet\n");

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("# Title\n\n- bullet");
      expect(result.pageCount).toBeNull();
    });

    it("strips a UTF-8 byte-order mark", async () => {
      const filePath = await write("bom.txt", "﻿Content after BOM");

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("Content after BOM");
    });

    it("flags an empty file with a warning instead of sending nothing to the LLM", async () => {
      const filePath = await write("blank.txt", "   \n\n  ");

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("");
      expect(result.characterCount).toBe(0);
      expect(result.noTextWarning).toBe("No extractable text found in this file. Skipped.");
    });
  });

  describe("docx", () => {
    it("extracts paragraph text from a real DOCX archive", async () => {
      const filePath = await write(
        "report.docx",
        await docxBuffer(["Work package 1", "Deliverable D1.2 — cohort assembly"]),
      );

      const result = await extractDocumentText(filePath);

      expect(result.text).toContain("Work package 1");
      expect(result.text).toContain("Deliverable D1.2 — cohort assembly");
      expect(result.pageCount).toBeNull();
      expect(result.extractionBackend).toBe("mammoth");
      expect(result.noTextWarning).toBeNull();
    });

    it("warns when a DOCX contains no text", async () => {
      const filePath = await write("empty.docx", await docxBuffer([]));

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("");
      expect(result.noTextWarning).toBe("No extractable text found in this file. Skipped.");
    });
  });

  describe("xlsx", () => {
    it("renders each sheet as tab-separated rows under a [SHEET] marker", async () => {
      const filePath = await write(
        "cohort.xlsx",
        await xlsxBuffer(
          [
            {
              name: "Samples",
              rowsXml:
                '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
                '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>54</v></c></row>',
            },
            {
              name: "Results",
              rowsXml: '<row r="1"><c r="A1" t="s"><v>3</v></c><c r="B1"><v>-1.82</v></c></row>',
            },
          ],
          { sharedStrings: ["patient_id", "age", "P001", "TP53"] },
        ),
      );

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe(
        ["[SHEET Samples]", "patient_id\tage", "P001\t54", "", "[SHEET Results]", "TP53\t-1.82"].join(
          "\n",
        ),
      );
      expect(result.pageCount).toBeNull();
      expect(result.extractionBackend).toBe("jszip");
    });

    it("keeps columns aligned when cells are missing from the middle of a row", async () => {
      const filePath = await write(
        "gaps.xlsx",
        await xlsxBuffer(
          [
            {
              name: "Sheet1",
              // Column B is absent; C must still land in the third position.
              rowsXml: '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>',
            },
          ],
          { sharedStrings: ["left", "right"] },
        ),
      );

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("[SHEET Sheet1]\nleft\t\tright");
    });

    it("handles inline strings, booleans, formula results and errors", async () => {
      const filePath = await write(
        "types.xlsx",
        await xlsxBuffer([
          {
            name: "Types",
            rowsXml:
              '<row r="1">' +
              '<c r="A1" t="inlineStr"><is><t>inline value</t></is></c>' +
              '<c r="B1" t="b"><v>1</v></c>' +
              '<c r="C1" t="b"><v>0</v></c>' +
              '<c r="D1" t="str"><v>formula text</v></c>' +
              '<c r="E1" t="e"><v>#DIV/0!</v></c>' +
              "</row>",
          },
        ]),
      );

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe(
        "[SHEET Types]\ninline value\tTRUE\tFALSE\tformula text\t#DIV/0!",
      );
    });

    it("decodes XML entities in cell text", async () => {
      const filePath = await write(
        "entities.xlsx",
        await xlsxBuffer(
          [{ name: "Sheet1", rowsXml: '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' }],
          { sharedStrings: ["p &lt; 0.05 &amp; n &gt; 10"] },
        ),
      );

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("[SHEET Sheet1]\np < 0.05 & n > 10");
    });

    it("renders date-formatted numbers as dates and leaves plain numbers alone", async () => {
      const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
  <cellStyleXfs count="1"><xf numFmtId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0"/>
    <xf numFmtId="14"/>
    <xf numFmtId="164"/>
  </cellXfs>
</styleSheet>`;

      const filePath = await write(
        "dates.xlsx",
        await xlsxBuffer(
          [
            {
              name: "Dates",
              rowsXml:
                '<row r="1">' +
                '<c r="A1" s="0"><v>44927</v></c>' +
                '<c r="B1" s="1"><v>44927</v></c>' +
                '<c r="C1" s="2"><v>44927</v></c>' +
                "</row>",
            },
          ],
          { stylesXml },
        ),
      );

      const result = await extractDocumentText(filePath);

      // Style 0 is General, so the serial stays a number; styles 1 and 2 are dates.
      expect(result.text).toBe("[SHEET Dates]\n44927\t2023-01-01\t2023-01-01");
    });

    it("drops empty rows and empty sheets", async () => {
      const filePath = await write(
        "sparse.xlsx",
        await xlsxBuffer(
          [
            {
              name: "HasData",
              rowsXml:
                '<row r="1"/>' +
                '<row r="2"><c r="A2" t="s"><v>0</v></c></row>' +
                '<row r="3"><c r="A3"/></row>',
            },
            { name: "Blank", rowsXml: "" },
          ],
          { sharedStrings: ["only value"] },
        ),
      );

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("[SHEET HasData]\nonly value");
    });

    it("warns when the workbook has no cell values at all", async () => {
      const filePath = await write("empty.xlsx", await xlsxBuffer([{ name: "Sheet1", rowsXml: "" }]));

      const result = await extractDocumentText(filePath);

      expect(result.text).toBe("");
      expect(result.noTextWarning).toBe("No extractable text found in this file. Skipped.");
    });

    it("fails with a clear message when the ZIP is not a workbook", async () => {
      const zip = new JSZip();
      zip.file("hello.txt", "not a workbook");
      const filePath = await write("bogus.xlsx", await zip.generateAsync({ type: "nodebuffer" }));

      await expect(extractDocumentText(filePath)).rejects.toThrow(
        "Not a readable XLSX file: xl/workbook.xml is missing.",
      );
    });
  });

  it("rejects a file type it cannot read", async () => {
    const filePath = await write("data.csv", "a,b\n1,2\n");

    await expect(extractDocumentText(filePath)).rejects.toThrow("Unsupported file type: .csv");
  });
});
