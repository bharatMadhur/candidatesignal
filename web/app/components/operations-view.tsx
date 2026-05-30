"use client";

import type {
  CandidateMaintenanceJob,
  OperationalAlert,
  OperationalAlertDelivery,
  ParseBatch,
  ParseDeadLetter,
  WorkerStatus,
} from "../../lib/api";
import { domainLabel, formatDateTime } from "../lib/format";
import { isActiveBatch, isActiveMaintenanceJob } from "../lib/workflow-status";
import { EmptyPanel, Metric, ProgressBar } from "./primitives";

type OperationsViewProps = {
  workerStatus: WorkerStatus | null;
  batches: ParseBatch[];
  deadLetters: ParseDeadLetter[];
  alerts: OperationalAlert[];
  alertDeliveries: OperationalAlertDelivery[];
  maintenanceJobs: CandidateMaintenanceJob[];
  canManageMaintenance: boolean;
  selectedBatch: ParseBatch | null;
  selectBatch: (batch: ParseBatch) => void;
  retryJob: (jobId: string) => void;
  resolveDeadLetter: (deadLetterId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  cancelJob: (jobId: string) => void;
  cancelBatch: (batchId: string) => void;
  runCandidateMaintenance: () => void;
  retryCandidateMaintenance: (jobId: string) => void;
  cancelCandidateMaintenance: (jobId: string) => void;
  busy: boolean;
};

function batchProgress(batch: ParseBatch) {
  if (!batch.total_files) return 0;
  return ((batch.completed_count + batch.failed_count) / batch.total_files) * 100;
}

export function OperationsView(props: OperationsViewProps) {
  const activeBatches = props.batches.filter(isActiveBatch);
  const completedBatches = props.batches.filter((batch) => !isActiveBatch(batch));
  const activeMaintenanceJobs = props.maintenanceJobs.filter(isActiveMaintenanceJob);
  const openIssueCount = props.alerts.length + props.deadLetters.length;
  return (
    <section className="operationsPage">
      <div className="pageTitle">
        <div>
          <h2>Resume Processing Review</h2>
          <p>Review failed resumes first, then active and recent upload batches. Advanced diagnostics stay collapsed below.</p>
        </div>
        <span className={openIssueCount ? "statusPill dangerPill" : "statusPill"}>
          {openIssueCount} open issue{openIssueCount === 1 ? "" : "s"}
        </span>
      </div>

      <section className="panel deadLetterPanel uploadQueuePriorityPanel">
        <div className="panelHead">
          <div>
            <h3>Failed Uploads</h3>
            <span>Retry files that can be processed, or acknowledge items that need a corrected replacement upload.</span>
          </div>
          <span className={props.deadLetters.length ? "statusPill dangerPill" : "statusPill"}>{props.deadLetters.length} open</span>
        </div>
        {props.deadLetters.length ? (
          <div className="failedUploadList">
            {props.deadLetters.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.original_filename ?? "Unknown file"}</strong>
                  <span>{item.batch_name ?? "No batch"} | attempts {item.attempt_count}/{item.max_attempts || "?"} | {formatDateTime(item.created_at)}</span>
                  <p>{item.error_message}</p>
                </div>
                <div className="jobActions">
                  <button className="plain small" disabled={props.busy} onClick={() => props.retryJob(item.job_id)}>Retry</button>
                  <button className="plain small danger" disabled={props.busy} onClick={() => props.resolveDeadLetter(item.id)}>Mark reviewed</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No failed resumes" body="Files that exhaust parsing retries will appear here with the exact filename, attempt count, and error." />
        )}
      </section>

      <section className="panel uploadQueueSection">
        <div className="panelHead">
          <div>
            <h3>Active Uploads</h3>
            <span>Resume batches currently waiting, processing, or retrying.</span>
          </div>
          <span className="statusPill">{activeBatches.length} active</span>
        </div>
        {activeBatches.length ? (
          <div className="batchList uploadQueueBatchList">
            {activeBatches.map((batch) => (
              <article key={batch.id} role="button" tabIndex={0} onClick={() => props.selectBatch(batch)}>
                <strong>{batch.name}</strong>
                <span>{domainLabel(batch.status)} | {batch.completed_count}/{batch.total_files} parsed | {batch.failed_count} failed</span>
                <ProgressBar value={batch.progress_percent ?? batchProgress(batch)} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No active uploads" body="Queued or running resume batches will appear here." />
        )}
      </section>

      <section className="panel uploadQueueSection">
        <div className="panelHead">
          <div>
            <h3>Completed Uploads</h3>
            <span>Recent completed, cancelled, or completed-with-errors batches.</span>
          </div>
          <span className="statusPill">{completedBatches.length} total</span>
        </div>
        {completedBatches.length ? (
          <div className="batchList uploadQueueBatchList">
            {completedBatches.slice(0, 10).map((batch) => (
              <article key={batch.id} role="button" tabIndex={0} onClick={() => props.selectBatch(batch)}>
                <strong>{batch.name}</strong>
                <span>{domainLabel(batch.status)} | {batch.completed_count}/{batch.total_files} parsed | {batch.failed_count} failed</span>
                <ProgressBar value={batch.progress_percent ?? batchProgress(batch)} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel title="No completed uploads yet" body="Finished upload batches will appear here after the worker processes resumes." />
        )}
      </section>

      {props.selectedBatch ? (
        <section className="panel batchDetail uploadQueueBatchDetail">
          <div className="panelHead">
            <div>
              <h3>{props.selectedBatch.name}</h3>
              <span>{domainLabel(props.selectedBatch.status)} | {props.selectedBatch.completed_count}/{props.selectedBatch.total_files} parsed | {props.selectedBatch.failed_count} failed</span>
              <ProgressBar value={props.selectedBatch.progress_percent ?? batchProgress(props.selectedBatch)} />
            </div>
            <button className="plain danger" disabled={props.busy || !isActiveBatch(props.selectedBatch)} onClick={() => props.cancelBatch(props.selectedBatch!.id)}>Cancel batch</button>
          </div>
          <div className="jobTable">
            <div className="jobRow header"><span>File</span><span>Status</span><span>Progress</span><span>Actions</span></div>
            {(props.selectedBatch.jobs ?? []).map((job) => (
              <div className="jobRow" key={job.id}>
                <span>{job.original_filename}</span>
                <span>{domainLabel(job.status)}</span>
                <span>
                  <ProgressBar value={job.progress_percent ?? 0} />
                  <small>{job.stage_label ?? domainLabel(job.stage)}{job.error_message ? ` | ${job.error_message}` : ""}</small>
                </span>
                <span className="jobActions">
                  <button className="plain small" disabled={props.busy || !["failed", "retrying", "cancelled"].includes(job.status)} onClick={() => props.retryJob(job.id)}>Retry</button>
                  <button className="plain small danger" disabled={props.busy || !["queued", "retrying", "failed", "running", "processing"].includes(job.status)} onClick={() => props.cancelJob(job.id)}>Cancel</button>
                </span>
              </div>
            ))}
          </div>
          {props.selectedBatch.events?.length ? (
            <details className="queueEventLog">
              <summary>Show processing event log</summary>
              <div>
                {props.selectedBatch.events.slice(0, 20).map((event) => (
                  <article key={event.id}>
                    <strong>{domainLabel(event.event_type)}</strong>
                    <span>{domainLabel(event.status)} | {domainLabel(event.stage)} | {formatDateTime(event.created_at)}</span>
                    {event.message ? <p>{event.message}</p> : null}
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <details className="panel operationsAdvanced">
        <summary>
          <div>
            <strong>Processing Health</strong>
            <span>{props.workerStatus?.online ? "Processing online" : "Processing offline"} | {props.workerStatus?.queued_count ?? 0} waiting | {props.workerStatus?.running_count ?? 0} running</span>
          </div>
          <span className={props.alerts.length ? "statusPill dangerPill" : "statusPill"}>{props.alerts.length} system alert{props.alerts.length === 1 ? "" : "s"}</span>
        </summary>
        <section className="workerStatusPanel">
          <div>
            <h3>Processing Status</h3>
            <p>{props.workerStatus?.online ? "Processing is online." : "Processing is offline. Queued parsing and matching work will wait."}</p>
          </div>
          <div className="workerStats">
            <Metric label="Waiting" value={`${props.workerStatus?.queued_count ?? 0}`} />
            <Metric label="Running" value={`${props.workerStatus?.running_count ?? 0}`} />
            <Metric label="Failed" value={`${props.workerStatus?.failed_count ?? 0}`} />
            <Metric label="Resume Queue" value={`${props.workerStatus?.parse_queued_count ?? 0}`} />
            <Metric label="Match Queue" value={`${props.workerStatus?.campaign_match_queued_count ?? 0}`} />
            <Metric label="Needs Review" value={`${props.workerStatus?.dead_letter_count ?? 0}`} />
            <Metric label="Active Batches" value={`${activeBatches.length}`} />
            <Metric label="Maintenance" value={`${activeMaintenanceJobs.length}`} />
          </div>
        </section>
      </details>

      <details className="panel operationsAdvanced">
        <summary>
          <div>
            <strong>Advanced Diagnostics</strong>
            <span>System alerts, maintenance runs, and alert-delivery history.</span>
          </div>
          <span className="statusPill">Admin</span>
        </summary>
        <section className="operationsAdvancedGrid">
          <section className="operationsAlertPanel">
            <div className="panelHead">
              <div>
                <h3>Processing Alerts</h3>
                <span>Delayed parsing, exhausted retries, OCR warnings, and stale search indexes.</span>
              </div>
              <span className={props.alerts.length ? "statusPill dangerPill" : "statusPill"}>{props.alerts.length} open</span>
            </div>
            {props.alerts.length ? (
              <div className="alertList">
                {props.alerts.map((alert) => (
                  <article key={alert.id} className={`alertCard ${alert.severity === "critical" ? "critical" : ""}`}>
                    <div>
                      <strong>{alert.title}</strong>
                      <span>{alert.alert_type.replaceAll("_", " ")} | {formatDateTime(alert.created_at)}</span>
                      <p>{alert.body}</p>
                    </div>
                    <button className="plain small" disabled={props.busy} onClick={() => props.acknowledgeAlert(alert.id)}>Acknowledge</button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No processing alerts" body="Alerts appear here when queues stall, parsing fails, OCR quality drops, or search indexes need rebuilding." />
            )}
          </section>
          <section className="maintenancePanel">
            <div className="panelHead">
              <div>
                <h3>Candidate Intelligence Maintenance</h3>
                <span>Refresh timeline totals, countries, coverage, and profile analytics from already saved candidate data.</span>
              </div>
              <button className="primary small" disabled={props.busy || activeMaintenanceJobs.length > 0 || !props.canManageMaintenance} onClick={props.runCandidateMaintenance}>
                {props.canManageMaintenance ? "Run local rederive" : "Admin only"}
              </button>
            </div>
            {props.maintenanceJobs.length ? (
              <div className="maintenanceJobList">
                {props.maintenanceJobs.slice(0, 6).map((job) => (
                  <article key={job.id}>
                    <div>
                      <strong>{job.stage_label ?? job.stage}</strong>
                      <span>
                        {job.status} | {job.processed_candidates}/{job.total_candidates} processed | {job.failed_candidates} failed
                      </span>
                      <ProgressBar value={job.progress_percent ?? 0} />
                      {job.error_message ? <p>{job.error_message}</p> : null}
                    </div>
                    <div className="jobActions vertical">
                      <button className="plain small" disabled={props.busy || !props.canManageMaintenance || !["failed", "completed_with_errors", "cancelled"].includes(job.status)} onClick={() => props.retryCandidateMaintenance(job.id)}>Retry</button>
                      <button className="plain small danger" disabled={props.busy || !props.canManageMaintenance || !isActiveMaintenanceJob(job)} onClick={() => props.cancelCandidateMaintenance(job.id)}>Cancel</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyPanel title="No maintenance runs" body="Use local rederive after deterministic parsing logic changes, such as domain-year caps, countries, coverage, or timeline accounting." />
            )}
          </section>
        </section>
        <section className="operationsDeliveryHistory">
          <div className="panelHead">
            <div>
              <h3>Alert Delivery History</h3>
              <span>Delivery attempts for configured processing alerts.</span>
            </div>
            <span>{props.alertDeliveries.length} attempts</span>
          </div>
          {props.alertDeliveries.length ? (
            <div className="deliveryList">
              {props.alertDeliveries.slice(0, 8).map((item) => (
                <article key={item.id}>
                  <strong>{item.channel} | {item.status}</strong>
                  <span>{item.destination} | {item.status_code ?? "no status"} | {item.latency_ms ?? 0}ms | {formatDateTime(item.created_at)}</span>
                  {item.error_message ? <p>{item.error_message}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyPanel title="No alert deliveries" body="No processing alerts have been delivered to an external destination." />
          )}
        </section>
      </details>
    </section>
  );
}
