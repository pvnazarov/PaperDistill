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
