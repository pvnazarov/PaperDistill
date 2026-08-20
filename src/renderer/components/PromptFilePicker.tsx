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

import type { BundledPromptId } from "../../shared/types";

interface PromptFilePickerProps {
  value: string | null;
  onSelect: () => void;
  onUseBundled: (id: BundledPromptId) => void;
}

function PromptFilePicker({ value, onSelect, onUseBundled }: PromptFilePickerProps) {
  return (
    <div className="field-row">
      <label className={value ? "field-label" : "field-label field-label-missing"}>
        Prompt TXT File
      </label>
      <div className="field-control">
        <button type="button" onClick={onSelect}>
          Choose File…
        </button>
        <button type="button" onClick={() => onUseBundled("papers")}>
          Use Papers Prompt
        </button>
        <button type="button" onClick={() => onUseBundled("proposals")}>
          Use Proposals Prompt
        </button>
        <span className={value ? "field-value" : "field-value field-value-missing"}>
          {value ?? "No prompt file selected"}
        </span>
      </div>
    </div>
  );
}

export default PromptFilePicker;
