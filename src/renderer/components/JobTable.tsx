import type { PdfJob } from "../../shared/types";

interface JobTableProps {
  jobs: PdfJob[];
}

const STATUS_LABELS: Record<PdfJob["status"], string> = {
  pending: "Pending",
  processing: "Processing",
  success: "Success",
  skipped: "Skipped",
  warning: "Warning",
  failed: "Failed",
};

function JobTable({ jobs }: JobTableProps) {
  if (jobs.length === 0) {
    return <p className="job-table-empty">No PDFs scanned yet.</p>;
  }

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Filename</th>
          <th>Pages</th>
          <th>Characters</th>
          <th>Status</th>
          <th>Mode</th>
          <th>Output</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.filePath}>
            <td title={job.filePath}>{job.fileName}</td>
            <td>{job.pageCount ?? "—"}</td>
            <td>{job.characterCount ?? "—"}</td>
            <td>
              <span className={`status-badge status-${job.status}`}>
                {STATUS_LABELS[job.status]}
              </span>
            </td>
            <td>{job.processingMode ?? "—"}</td>
            <td title={job.outputPath ?? undefined}>{job.outputPath ?? "—"}</td>
            <td title={job.errorMessage ?? undefined}>{job.errorMessage ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default JobTable;
