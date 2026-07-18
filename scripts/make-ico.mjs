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

import pngToIco from "png-to-ico";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sizes = [16, 32, 64, 256];
const inputs = sizes.map((s) => path.join(root, "icons", `paperdistill${s}.png`));

const buf = await pngToIco(inputs);
await fs.writeFile(path.join(root, "build", "icon.ico"), buf);
console.log("wrote build/icon.ico from", inputs);
