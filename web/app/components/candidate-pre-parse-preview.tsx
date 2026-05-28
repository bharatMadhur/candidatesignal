"use client";

import { AlertTriangle, FileSearch, Loader2 } from "lucide-react";

import { formatBytes } from "../lib/format";

export function CandidatePreParsePreview({
  file,
  previewUrl,
  previewKind,
  documentHtml,
  loading,
  error,
  clear,
}: {
  file: File | null;
  previewUrl: string;
  previewKind: "pdf" | "image" | "document" | "none";
  documentHtml: string;
  loading: boolean;
  error: string;
  clear: () => void;
}) {
  if (!file) {
    return (
      <div className="candidatePreParsePreview empty">
        <FileSearch size={18} />
        <div>
          <strong>Preview before extraction</strong>
          <span>Select the file first. Nothing is parsed until you confirm.</span>
        </div>
      </div>
    );
  }

  const sizeLabel = formatBytes(file.size);
  return (
    <article className="candidatePreParsePreview">
      <header>
        <div>
          <span className="eyebrow">Confirm file before parsing</span>
          <strong>{file.name}</strong>
          <small>
            {sizeLabel} · {file.type || "Unknown type"}
          </small>
        </div>
        <button className="plain small" type="button" onClick={clear}>
          Replace file
        </button>
      </header>
      {previewKind === "pdf" ? <iframe src={previewUrl} title="Selected resume preview before extraction" /> : null}
      {previewKind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Selected resume preview before extraction" />
      ) : null}
      {previewKind === "document" ? (
        loading ? (
          <div className="candidatePreParseFallback">
            <Loader2 size={20} className="spin" />
            <strong>Building safe document preview</strong>
            <span>This does not extract the resume into your profile yet.</span>
          </div>
        ) : error ? (
          <div className="candidatePreParseFallback">
            <AlertTriangle size={20} />
            <strong>Preview unavailable</strong>
            <span>{error}</span>
          </div>
        ) : documentHtml ? (
          <div className="docxPreview candidatePreParseDocHtml" dangerouslySetInnerHTML={{ __html: documentHtml }} />
        ) : (
          <div className="candidatePreParseFallback">
            <FileSearch size={20} />
            <strong>Document selected</strong>
            <span>Confirm this is the right file before extraction.</span>
          </div>
        )
      ) : null}
    </article>
  );
}
