import { useEffect, useState } from "react";
import type { CandidateVersionMatch } from "../../lib/api";
import { candidateVersionCompareRows, normalizeCandidateVersionStatus, versionStatusLabel } from "../lib/candidate-versions";
import { domainLabel, formatBytes, formatDateTime, shortHash } from "../lib/format";
import { EmptyPanel } from "./primitives";

type ResolutionFilter = "all" | "suggested" | "versioned" | "separate" | "review_later";

export function CandidateVersionReview({ clusters, decide }: { clusters: CandidateVersionMatch[]; decide: (id: string, decision: "versioned" | "separate" | "review-later") => void }) {
  const [filter, setFilter] = useState<ResolutionFilter>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(clusters[0]?.id);
  const filteredClusters = clusters.filter((cluster) => filter === "all" || (cluster.status ?? "suggested") === filter);
  const selected = filteredClusters.find((cluster) => cluster.id === selectedId) ?? filteredClusters[0];
  const selectedStatus = normalizeCandidateVersionStatus(selected?.status);
  const resolutionCounts = {
    all: clusters.length,
    suggested: clusters.filter((cluster) => (cluster.status ?? "suggested") === "suggested").length,
    review_later: clusters.filter((cluster) => cluster.status === "review_later").length,
    versioned: clusters.filter((cluster) => cluster.status === "versioned").length,
    separate: clusters.filter((cluster) => cluster.status === "separate").length,
  };
  useEffect(() => {
    if (selectedId && filteredClusters.some((cluster) => cluster.id === selectedId)) return;
    setSelectedId(filteredClusters[0]?.id);
  }, [filteredClusters, selectedId]);
  return (
    <section className="resolutionPage">
      <aside className="clusterList">
        <div className="clusterHead"><h3>Candidate Versions</h3><span>{clusters.length}</span></div>
        <div className="clusterFilters">
          {(["all", "suggested", "review_later", "versioned", "separate"] as ResolutionFilter[]).map((item) => (
            <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
              {domainLabel(item)} <span>{resolutionCounts[item]}</span>
            </button>
          ))}
        </div>
        {filteredClusters.map((item) => (
          <article className={item.id === selected?.id ? "clusterItem active" : "clusterItem"} key={item.id} onClick={() => setSelectedId(item.id)}>
            <strong>{item.left_name ?? item.name ?? "Candidate"} </strong>
            <p>{item.right_name ? `Possible version: ${item.right_name}` : "Review required"}</p>
            <div className="clusterItemMeta">
              <span>{Math.round(item.score * 100)}% Version signal</span>
              <em className={`clusterStatus ${normalizeCandidateVersionStatus(item.status)}`}>{versionStatusLabel(item.status)}</em>
            </div>
          </article>
        ))}
        {!filteredClusters.length ? <p className="muted clusterEmpty">No clusters in this status.</p> : null}
      </aside>
      <main className="resolutionDetail">
        {selected ? (
          <>
            <div className="resolutionHeader">
              <div>
                <h2>Version Stack: {selected.left_name ?? selected.name ?? "Candidate"}</h2>
                <p>Matching identity signals are handled as candidate versions. Every uploaded file is preserved; no data is merged or deleted.</p>
                <span className={`clusterStatus large ${selectedStatus}`}>Status: {versionStatusLabel(selected.status)}</span>
              </div>
              <div className="actions">
                <button className="plain" disabled={selectedStatus === "review_later"} onClick={() => selected.id && decide(selected.id, "review-later")}>
                  {selectedStatus === "review_later" ? "Marked Review Later" : "Review Later"}
                </button>
                <button className="plain" disabled={selectedStatus === "separate"} onClick={() => selected.id && decide(selected.id, "separate")}>
                  {selectedStatus === "separate" ? "Kept Separate" : "Keep Separate"}
                </button>
                <button className="primary" disabled={selectedStatus === "versioned"} onClick={() => selected.id && decide(selected.id, "versioned")}>
                  {selectedStatus === "versioned" ? "Marked as Versions" : "Mark as Versions"}
                </button>
              </div>
            </div>
            <section className="reasonBox">
              <div><span>Version Signal</span><strong>{Math.round(selected.score * 100)}%</strong></div>
              <ul>{selected.reasons.map((reason, index) => <li key={index}>{reason.type}: {reason.detail ?? reason.value ?? "match signal"}</li>)}</ul>
            </section>
            <section className="versionTimelinePanel">
              <div className="cardTitle"><h3>Version Timeline</h3><span>Upload and parse metadata</span></div>
              <div className="versionTimeline">
                <VersionMetadataCard label={selected.left_name ?? "Candidate A"} version={selected.left_version} />
                <VersionMetadataCard label={selected.right_name ?? "Candidate B"} version={selected.right_version} />
              </div>
            </section>
            <section className="comparePanel">
              <div className="cardTitle"><h3>Field Differences</h3><span>Every file remains preserved</span></div>
              <div className="compareGrid">
                <strong>Field</strong>
                <strong>{selected.left_name ?? "Candidate A"}</strong>
                <strong>{selected.right_name ?? "Candidate B"}</strong>
                {candidateVersionCompareRows(selected).map((row) => (
                  <div className={`compareRow ${row.status ?? "different"}`} key={row.label}>
                    <span>
                      {row.label}
                      {row.status ? <b>{domainLabel(row.status)}</b> : null}
                      {row.detail ? <em>{row.detail}</em> : null}
                    </span>
                    <p>{row.left || "Missing"}</p>
                    <p>{row.right || "Missing"}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="auditPanel">
              <div className="cardTitle"><h3>Decision Audit Trail</h3><span>{selected.audit_events?.length ?? 0} events</span></div>
              {selected.audit_events?.length ? (
                <div className="auditList">
                  {selected.audit_events.map((event, index) => (
                    <article key={`${event.action}-${event.created_at}-${index}`}>
                      <strong>{domainLabel(event.action.replace("entity_resolution.", "").replace("candidate_versions.", ""))}</strong>
                      <span>{event.user_email ?? "Unknown user"} | {new Date(event.created_at).toLocaleString()}</span>
                      {event.metadata?.status ? <p>Status: {event.metadata.status}</p> : null}
                    </article>
                  ))}
                </div>
              ) : <EmptyPanel title="No version decision recorded yet" body="Mark-as-versions, keep-separate, and review-later decisions will appear here after they are saved." />}
            </section>
          </>
        ) : <p className="muted">No candidate version groups are pending.</p>}
      </main>
    </section>
  );
}

function VersionMetadataCard({ label, version }: { label: string; version?: CandidateVersionMatch["left_version"] }) {
  const latest = version?.latest_document;
  const pageMethods = version?.page_methods ?? [];
  return (
    <article className="versionCard">
      <div>
        <strong>{label}</strong>
        <span>{version?.document_id ?? "Missing document id"}</span>
      </div>
      <dl>
        <dt>Uploaded</dt>
        <dd>{formatDateTime(latest?.uploaded_at ?? version?.candidate_created_at)}</dd>
        <dt>File</dt>
        <dd>{latest?.original_filename ?? "No document metadata"}</dd>
        <dt>Storage</dt>
        <dd>{latest ? `${latest.storage_backend} / ${shortHash(latest.storage_key)}` : "Missing"}</dd>
        <dt>Parse</dt>
        <dd>{latest?.parse_status ? `${domainLabel(latest.parse_status)}${latest.parse_stage ? ` (${domainLabel(latest.parse_stage)})` : ""}` : "No parse job linked"}</dd>
        <dt>Extraction</dt>
        <dd>{pageMethods.length ? pageMethods.map((item) => `${domainLabel(item.extraction_method ?? "unknown")} ${item.page_count}p`).join(", ") : latest?.extraction_method ?? "Unknown"}</dd>
        <dt>Size</dt>
        <dd>{formatBytes(latest?.size_bytes)}</dd>
      </dl>
    </article>
  );
}
