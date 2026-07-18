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

interface OutputFolderPickerProps {
  value: string | null;
  onSelect: () => void;
}

function OutputFolderPicker({ value, onSelect }: OutputFolderPickerProps) {
  return (
    <div className="field-row">
      <label className="field-label">Output Folder</label>
      <div className="field-control">
        <button type="button" onClick={onSelect}>
          Choose Folder…
        </button>
        <span className="field-value">{value ?? "No output folder selected"}</span>
      </div>
    </div>
  );
}

export default OutputFolderPicker;
