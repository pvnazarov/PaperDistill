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

import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { INPUT_FILE_KIND_EXTENSIONS } from "../shared/types";
import type { InputFileKind } from "../shared/types";

export async function selectInputFolder(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: "Select Input Folder",
    defaultPath: app.getPath("documents"),
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

export async function selectPromptFile(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: "Select Prompt TXT File",
    defaultPath: app.getPath("documents"),
    properties: ["openFile"],
    filters: [{ name: "Text Files", extensions: ["txt"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

/** Finds every file in the folder whose extension matches one of the selected types. */
export async function discoverInputFiles(
  folderPath: string,
  recursive: boolean,
  fileTypes: InputFileKind[],
): Promise<string[]> {
  const wantedExtensions = new Set(fileTypes.map((kind) => INPUT_FILE_KIND_EXTENSIONS[kind]));
  if (wantedExtensions.size === 0) return [];

  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name).slice(1).toLowerCase();
        if (wantedExtensions.has(extension)) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(folderPath);
  results.sort();
  return results;
}

export async function selectOutputFolder(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, {
    title: "Select Output Folder",
    defaultPath: app.getPath("documents"),
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}
