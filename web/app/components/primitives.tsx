import type { ReactNode } from "react";

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export function EmptyPanel({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="designedEmpty">
      <strong>{title}</strong>
      <span>{body}</span>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className="progressTrack" aria-label={`Progress ${percent}%`}>
      <i style={{ width: `${percent}%` }} />
      <span>{percent}%</span>
    </div>
  );
}
