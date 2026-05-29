import { useEffect, useState } from "react";
import {
  createCollaborationComment,
  createRecruiterTask,
  deleteCollaborationComment,
  deleteRecruiterTask,
  listCollaborationComments,
  listRecruiterTasks,
  updateRecruiterTask,
  type CollaborationComment,
  type RecruiterTask,
  type TeamMember,
} from "../../lib/api";
import { domainLabel, formatDateTime } from "../lib/format";

export function CollaborationPanel({
  token,
  entityType,
  entityId,
  teamMembers,
  compact = false,
}: {
  token: string;
  entityType: "candidate" | "campaign" | "campaign_candidate";
  entityId: string;
  teamMembers: TeamMember[];
  compact?: boolean;
}) {
  const [comments, setComments] = useState<CollaborationComment[]>([]);
  const [tasks, setTasks] = useState<RecruiterTask[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentVisibility, setCommentVisibility] = useState("team");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBody, setTaskBody] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("normal");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeTeamMembers = teamMembers.filter((member) => member.status === "active");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      listCollaborationComments(token, entityType, entityId),
      listRecruiterTasks(token, { entity_type: entityType, entity_id: entityId }),
    ])
      .then(([commentResult, taskResult]) => {
        if (!active) return;
        setComments(commentResult.comments);
        setTasks(taskResult.tasks);
      })
      .catch((loadError) => {
        if (active) setError(readablePanelError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entityId, entityType, token]);

  async function refresh() {
    const [commentResult, taskResult] = await Promise.all([
      listCollaborationComments(token, entityType, entityId),
      listRecruiterTasks(token, { entity_type: entityType, entity_id: entityId }),
    ]);
    setComments(commentResult.comments);
    setTasks(taskResult.tasks);
  }

  async function addComment() {
    if (!commentBody.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createCollaborationComment(token, {
        entity_type: entityType,
        entity_id: entityId,
        body: commentBody,
        visibility: commentVisibility,
      });
      setComments((value) => [...value, result.comment]);
      setCommentBody("");
    } catch (commentError) {
      setError(readablePanelError(commentError));
    } finally {
      setSaving(false);
    }
  }

  async function removeComment(commentId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteCollaborationComment(token, commentId);
      setComments((value) => value.filter((comment) => comment.id !== commentId));
    } catch (deleteError) {
      setError(readablePanelError(deleteError));
    } finally {
      setSaving(false);
    }
  }

  async function addTask() {
    if (!taskTitle.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await createRecruiterTask(token, {
        entity_type: entityType,
        entity_id: entityId,
        title: taskTitle,
        body: taskBody,
        assignee_user_id: taskAssignee || null,
        priority: taskPriority,
      });
      setTasks((value) => [result.task, ...value]);
      setTaskTitle("");
      setTaskBody("");
      setTaskAssignee("");
      setTaskPriority("normal");
    } catch (taskError) {
      setError(readablePanelError(taskError));
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: "open" | "in_progress" | "done" | "cancelled") {
    setSaving(true);
    setError("");
    try {
      const result = await updateRecruiterTask(token, taskId, { status });
      setTasks((value) => value.map((task) => task.id === taskId ? result.task : task));
    } catch (taskError) {
      setError(readablePanelError(taskError));
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(taskId: string) {
    setSaving(true);
    setError("");
    try {
      await deleteRecruiterTask(token, taskId);
      setTasks((value) => value.filter((task) => task.id !== taskId));
    } catch (taskError) {
      setError(readablePanelError(taskError));
    } finally {
      setSaving(false);
    }
  }

  const openTasks = tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const completedTasks = tasks.filter((task) => task.status === "done");
  const entityLabel = entityType === "campaign_candidate" ? "candidate in this campaign" : entityType;

  return (
    <section className={compact ? "collaborationPanel handoffPanel compact" : "collaborationPanel handoffPanel"}>
      <header className="collaborationHeader">
        <div>
          <span className="reportLabel">Team Handoff</span>
          <h3>Shared context</h3>
          <p>Leave internal notes, mention teammates, and assign follow-ups for this {entityLabel}.</p>
        </div>
        <div className="handoffHeaderActions">
          <span>{openTasks.length} open</span>
          <span>{comments.length} comments</span>
          <button className="plain small" type="button" onClick={() => void refresh()} disabled={loading || saving}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>
      {error ? <p className="noteSaveFeedback error">{error}</p> : null}
      <div className="collaborationGrid">
        <article className="collaborationComposer">
          <strong>Team note</strong>
          <textarea
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Add context for the team. Use @email if someone needs to see it."
          />
          <div className="collaborationControls">
            <select value={commentVisibility} onChange={(event) => setCommentVisibility(event.target.value)}>
              <option value="team">Team visible</option>
              <option value="private">Private to me</option>
              <option value="client_ready">Client-ready note</option>
            </select>
            <button className="secondary small" type="button" onClick={() => void addComment()} disabled={saving || !commentBody.trim()}>Post</button>
          </div>
        </article>
        <article className="collaborationComposer">
          <strong>Follow-up</strong>
          <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" />
          <textarea value={taskBody} onChange={(event) => setTaskBody(event.target.value)} placeholder="What should happen next?" />
          <div className="collaborationControls">
            <select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)}>
              <option value="">Unassigned</option>
              {activeTeamMembers.map((member) => <option key={member.id} value={member.user_id}>{member.email}</option>)}
            </select>
            <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="low">Low</option>
            </select>
            <button className="secondary small" type="button" onClick={() => void addTask()} disabled={saving || !taskTitle.trim()}>Create</button>
          </div>
        </article>
      </div>
      <div className="collaborationLists">
        <section className="collaborationList">
          <div className="collaborationListHeader">
            <strong>Follow-ups</strong>
            <span>{openTasks.length}</span>
          </div>
          {openTasks.length ? openTasks.slice(0, compact ? 4 : 8).map((task) => (
            <article className="collaborationItem task" key={task.id}>
              <div>
                <strong>{task.title}</strong>
                {task.body ? <p>{task.body}</p> : null}
                <span>{task.assignee_email ? `Assigned to ${task.assignee_email}` : "Unassigned"} · {domainLabel(task.priority)} · {formatDateTime(task.created_at)}</span>
              </div>
              <div className="collaborationItemActions">
                {task.status === "open" ? <button className="plain small" type="button" onClick={() => void updateTaskStatus(task.id, "in_progress")}>Start</button> : null}
                <button className="secondary small" type="button" onClick={() => void updateTaskStatus(task.id, "done")}>Done</button>
                <button className="plain small danger" type="button" onClick={() => void removeTask(task.id)}>Delete</button>
              </div>
            </article>
          )) : <p className="muted">No open tasks for this item.</p>}
          {completedTasks.length ? <span className="collaborationCompleteCount">{completedTasks.length} completed</span> : null}
        </section>
        <section className="collaborationList">
          <div className="collaborationListHeader">
            <strong>Shared notes</strong>
            <span>{comments.length}</span>
          </div>
          {comments.length ? comments.slice(0, compact ? 4 : 10).map((comment) => (
            <article className="collaborationItem" key={comment.id}>
              <div>
                <strong>{comment.user_name || comment.user_email || "Team member"}</strong>
                <p>{comment.body}</p>
                <span>{domainLabel(comment.visibility)} · {formatDateTime(comment.created_at)}</span>
              </div>
              <button className="plain small danger" type="button" onClick={() => void removeComment(comment.id)}>Delete</button>
            </article>
          )) : <p className="muted">No team comments yet.</p>}
        </section>
      </div>
    </section>
  );
}

function readablePanelError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "Action failed");
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => item?.msg ?? JSON.stringify(item)).join("; ");
  } catch {
    // Fall through to normalized raw text.
  }
  if (raw === "Failed to fetch") return "Cannot reach the backend. Check that the API is running.";
  return raw;
}
