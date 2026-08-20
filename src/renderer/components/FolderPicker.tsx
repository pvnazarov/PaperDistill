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

import { INPUT_FILE_KINDS, INPUT_FILE_KIND_LABELS } from "../../shared/types";
import type { InputFileKind } from "../../shared/types";

interface FolderPickerProps {
  value: string | null;
  fileTypes: InputFileKind[];
  onSelect: () => void;
  onFileTypesChange: (fileTypes: InputFileKind[]) => void;
}

function FolderPicker({ value, fileTypes, onSelect, onFileTypesChange }: FolderPickerProps) {
  function toggle(kind: InputFileKind, checked: boolean) {
    // Rebuilt from INPUT_FILE_KINDS so the selection keeps a stable order.
    onFileTypesChange(
      INPUT_FILE_KINDS.filter((candidate) =>
        candidate === kind ? checked : fileTypes.includes(candidate),
      ),
    );
  }

  return (
    <div className="field-row">
      <label className={value ? "field-label" : "field-label field-label-missing"}>
        Input Folder
      </label>
      <div className="field-control">
        <button type="button" onClick={onSelect}>
          Choose Folder…
        </button>
        <span className={value ? "field-value" : "field-value field-value-missing"}>
          {value ?? "No folder selected"}
        </span>
      </div>
      <div className="field-control options-row file-type-row">
        {INPUT_FILE_KINDS.map((kind) => (
          <label key={kind} className="checkbox-label">
            <input
              type="checkbox"
              checked={fileTypes.includes(kind)}
              onChange={(e) => toggle(kind, e.target.checked)}
            />
            {INPUT_FILE_KIND_LABELS[kind]}
          </label>
        ))}
        {fileTypes.length === 0 && (
          <span className="field-hint">Select at least one file type to scan.</span>
        )}
      </div>
    </div>
  );
}

export default FolderPicker;
