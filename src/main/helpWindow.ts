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

import { app, BrowserWindow } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { markdownToHtml } from "./markdown";

let helpWindow: BrowserWindow | null = null;

export async function showHelpWindow(parent: BrowserWindow): Promise<void> {
  if (helpWindow) {
    helpWindow.focus();
    return;
  }

  const readmePath = path.join(app.getAppPath(), "README.md");
  const markdown = await fs.readFile(readmePath, "utf8");
  const bodyHtml = markdownToHtml(markdown);

  helpWindow = new BrowserWindow({
    width: 760,
    height: 840,
    parent,
    title: "PaperDistill Help",
    autoHideMenuBar: true,
    webPreferences: { sandbox: true },
  });
  helpWindow.setMenu(null);

  const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>PaperDistill Help</title>
<style>
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #1e1f22;
    color: #e6e6e6;
    padding: 24px 32px 40px;
    line-height: 1.6;
  }
  h1, h2, h3 { color: #ffffff; }
  h1 { border-bottom: 1px solid #33353a; padding-bottom: 8px; }
  code { background: #2a2b2f; padding: 1px 5px; border-radius: 3px; font-family: Consolas, Menlo, monospace; font-size: 0.9em; }
  pre { background: #17181a; border: 1px solid #33353a; border-radius: 6px; padding: 12px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  a { color: #7fc4ff; }
  ul { padding-left: 22px; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

  helpWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  helpWindow.on("closed", () => {
    helpWindow = null;
  });
}
