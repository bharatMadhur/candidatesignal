import type { CandidateMaintenanceJob, ParseBatch } from "../../lib/api";

const ACTIVE_BATCH_STATUSES = new Set(["created", "queued", "running", "processing", "retrying"]);
const ACTIVE_MAINTENANCE_STATUSES = new Set(["queued", "running"]);

export function isActiveBatchStatus(status: string) {
  return ACTIVE_BATCH_STATUSES.has(status);
}

export function isActiveBatch(batch: Pick<ParseBatch, "status">) {
  return isActiveBatchStatus(batch.status);
}

export function isActiveMaintenanceJob(job: Pick<CandidateMaintenanceJob, "status">) {
  return ACTIVE_MAINTENANCE_STATUSES.has(job.status);
}
