import { isEducationTimelineEvent, timelineDateRangeLabel } from "../lib/candidate-timeline";
import { EmptyPanel } from "./primitives";
import { WorkstreamList } from "./candidate-detail-widgets";

type TimelineRow = {
  id?: string;
  title?: string | null;
  organization?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  relationship?: string | null;
  kind?: string | null;
  type?: string | null;
  summary?: string | null;
  left?: number;
  width?: number;
  crossCompanyOverlap?: boolean;
  workstreams?: Array<{ name?: string | null; start_date?: string | null; end_date?: string | null; bullets?: string[] }>;
  [key: string]: unknown;
};

export function CandidateWorkEducationTimeline({
  rows,
  markers,
  uniqueExperience,
}: {
  rows: TimelineRow[];
  markers: number[];
  uniqueExperience: string;
}) {
  return (
    <section className="candidateReportTimeline cleanTimeline workEducationTimeline">
      <div className="timelineHeader">
        <div>
          <h3>Work & Education Timeline</h3>
          <p>Employment, same-company project workstreams, and dated education are shown together. Red bars only indicate true cross-company overlap.</p>
        </div>
        <div className="timelineAccounting">
          <span>Unique work experience</span>
          <strong>{uniqueExperience}</strong>
        </div>
      </div>
      {rows.length ? (
        <div className="timelineBoard">
          <div className="timelineYearAxis">
            <span />
            <div>
              {markers.map((year) => <b key={year}>{year}</b>)}
            </div>
          </div>
          {rows.slice(0, 14).map((item, index) => {
            const isEducation = isEducationTimelineEvent(item);
            return (
              <article className={`timelineRow ${isEducation ? "educationTimelineRow" : ""} ${item.crossCompanyOverlap ? "crossOverlap" : ""}`.trim()} key={item.id ?? index}>
                <div className="timelineRoleLabel">
                  <span className={isEducation ? "timelineType education" : "timelineType work"}>{isEducation ? "Education" : "Work"}</span>
                  <strong>{item.title ?? (isEducation ? "Education" : "Role")}</strong>
                  <span>{item.organization ?? (isEducation ? "School not extracted" : "Unknown company")}</span>
                  <em>{timelineDateRangeLabel(item, isEducation)}</em>
                </div>
                <div className="timelineTrack">
                  <i style={{ left: `${Math.max(0, Math.min(96, Number(item.left ?? 0)))}%`, width: `${Math.max(4, Math.min(100, Number(item.width ?? 100)))}%` }} />
                  {item.crossCompanyOverlap ? <b>Cross-company overlap</b> : null}
                </div>
                {item.summary ? <p>{item.summary}</p> : null}
                {item.workstreams?.length ? <WorkstreamList workstreams={item.workstreams} /> : null}
              </article>
            );
          })}
        </div>
      ) : <EmptyPanel title="No dated timeline extracted" body="The parser did not extract dated work or education history. Review the source evidence panel or reparse this CV." />}
    </section>
  );
}
