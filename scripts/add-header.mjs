import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const HEADER = `/*
 * PaperDistill
 * Copyright (c) 2026 Petr Nazarov, Luxembourg Institute of Health (LIH)
 *
 * Released under the MIT License.
 * Developed with significant assistance from Anthropic Claude Code.
 * Responsibility for any bugs remains under active investigation.
 *
 * See LICENSE for details.
 */
`;

const files = [
  "src/main/batchRunner.test.ts",
  "src/main/batchRunner.ts",
  "src/main/chunker.test.ts",
  "src/main/chunker.ts",
  "src/main/configStore.ts",
  "src/main/fileSystem.test.ts",
  "src/main/fileSystem.ts",
  "src/main/ipc.ts",
  "src/main/main.ts",
  "src/main/pdfExtract.test.ts",
  "src/main/pdfExtract.ts",
  "src/main/preload.ts",
  "src/main/promptBuilder.test.ts",
  "src/main/promptBuilder.ts",
  "src/main/providers/anthropicProvider.ts",
  "src/main/providers/base.ts",
  "src/main/providers/index.test.ts",
  "src/main/providers/index.ts",
  "src/main/providers/mockProvider.test.ts",
  "src/main/providers/mockProvider.ts",
  "src/main/providers/ollamaProvider.ts",
  "src/main/providers/openaiProvider.test.ts",
  "src/main/providers/openaiProvider.ts",
  "src/renderer/App.tsx",
  "src/renderer/components/FolderPicker.tsx",
  "src/renderer/components/JobTable.tsx",
  "src/renderer/components/LogPanel.tsx",
  "src/renderer/components/OutputFolderPicker.tsx",
  "src/renderer/components/PromptFilePicker.tsx",
  "src/renderer/components/ProviderSettings.tsx",
  "src/renderer/main.tsx",
  "src/shared/types.ts",
  "scripts/make-ico.mjs",
  "vite.config.ts",
];

let changed = 0;
let skipped = 0;

for (const rel of files) {
  const filePath = path.join(root, rel);
  const original = await fs.readFile(filePath, "utf8");
  if (original.includes("Copyright (c) 2026 Petr Nazarov")) {
    skipped++;
    continue;
  }
  await fs.writeFile(filePath, HEADER + "\n" + original, "utf8");
  changed++;
}

console.log(`Header added to ${changed} file(s), skipped ${skipped} already-headered file(s).`);
