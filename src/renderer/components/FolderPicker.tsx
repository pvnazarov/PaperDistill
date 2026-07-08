interface FolderPickerProps {
  value: string | null;
  onSelect: () => void;
}

function FolderPicker({ value, onSelect }: FolderPickerProps) {
  return (
    <div className="field-row">
      <label className="field-label">PDF Folder</label>
      <div className="field-control">
        <button type="button" onClick={onSelect}>
          Choose Folder…
        </button>
        <span className="field-value">{value ?? "No folder selected"}</span>
      </div>
    </div>
  );
}

export default FolderPicker;
