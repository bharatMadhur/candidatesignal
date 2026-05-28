import type { CandidateResumeUpload } from "../../lib/api";
import { formatDateTime, humanizeLabel } from "../lib/format";
import { EmptyPanel, ProgressBar } from "./primitives";

type CandidateUploadListProps = {
  uploads: CandidateResumeUpload[];
  activeUploadId: string;
  selectUpload: (id: string) => void;
  retryUpload: (id: string) => void;
};

export function CandidateUploadList({ uploads, activeUploadId, selectUpload, retryUpload }: CandidateUploadListProps) {
  if (!uploads.length) return <EmptyPanel title="No uploads yet" body="Upload a resume to start parsing and build the master profile." />;
  return (
    <div className="candidateUploadList">
      {uploads.map((upload) => (
        <div key={upload.id} className={activeUploadId === upload.id ? "candidateUploadListItem active" : "candidateUploadListItem"}>
          <button type="button" onClick={() => selectUpload(upload.id)}>
            <span>{humanizeLabel(upload.status)}</span>
            <strong>{upload.original_filename}</strong>
            <small>{upload.stage_label ?? humanizeLabel(upload.stage)} · {formatDateTime(upload.updated_at)}</small>
          </button>
          <ProgressBar value={upload.progress} />
          {upload.status === "failed" || upload.status === "retrying" ? (
            <button className="miniButton" type="button" onClick={() => { selectUpload(upload.id); retryUpload(upload.id); }}>
              Retry parse
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
