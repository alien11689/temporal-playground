import { Client } from "@temporalio/client";
import { Pool } from "pg";

let dbPool = null;

export function initializeDbPool(pool) {
  dbPool = pool;
}

// ==================== PROJECT ACTIVITIES ====================

export async function saveProject(projectId, name, status) {
  if (!dbPool) throw new Error("Database pool not initialized");

  try {
    // Only update status if name wasn't provided
    if (name === null || name === undefined) {
      const query = `
        UPDATE projects
        SET status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, name, status;
      `;
      const result = await dbPool.query(query, [projectId, status]);
      console.log("Project status updated:", result.rows[0]);
      return { ok: true, project: result.rows[0] };
    }

    const query = `
      INSERT INTO projects (id, name, status, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, name, status;
    `;

    const result = await dbPool.query(query, [projectId, name, status]);
    console.log("Project saved:", result.rows[0]);
    return { ok: true, project: result.rows[0] };
  } catch (error) {
    console.error("Failed to save project:", error);
    throw error;
  }
}

export async function getProject(projectId) {
  if (!dbPool) throw new Error("Database pool not initialized");

  try {
    const query = `SELECT * FROM projects WHERE id = $1;`;
    const result = await dbPool.query(query, [projectId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error("Failed to get project:", error);
    throw error;
  }
}

// ==================== ISSUE ACTIVITIES ====================

export async function saveIssue(issueId, title, author, projectId, status) {
  if (!dbPool) throw new Error("Database pool not initialized");

  try {
    const query = `
      INSERT INTO issues (id, title, author, project_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = $2,
        author = $3,
        status = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, title, author, project_id, status;
    `;

    const result = await dbPool.query(query, [issueId, title, author, projectId, status]);
    console.log("Issue saved:", result.rows[0]);
    return { ok: true, issue: result.rows[0] };
  } catch (error) {
    console.error("Failed to save issue:", error);
    throw error;
  }
}

export async function getIssue(issueId) {
  if (!dbPool) throw new Error("Database pool not initialized");

  try {
    const query = `SELECT * FROM issues WHERE id = $1;`;
    const result = await dbPool.query(query, [issueId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error("Failed to get issue:", error);
    throw error;
  }
}

// ==================== COMMENT ACTIVITIES ====================

export async function saveComment(issueId, author, message) {
  if (!dbPool) throw new Error("Database pool not initialized");

  try {
    const query = `
      INSERT INTO comments (issue_id, author, message, datetime, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, issue_id, author, message, datetime;
    `;

    const result = await dbPool.query(query, [issueId, author, message]);
    console.log("Comment saved:", result.rows[0]);
    return { ok: true, comment: result.rows[0] };
  } catch (error) {
    console.error("Failed to save comment:", error);
    throw error;
  }
}

export async function getIssueComments(issueId) {
  if (!dbPool) throw new Error("Database pool not initialized");

  try {
    const query = `
      SELECT id, issue_id, author, message, datetime
      FROM comments
      WHERE issue_id = $1
      ORDER BY datetime ASC;
    `;

    const result = await dbPool.query(query, [issueId]);
    return result.rows;
  } catch (error) {
    console.error("Failed to get issue comments:", error);
    throw error;
  }
}

// ==================== LEGACY ACTIVITIES ====================

export async function updateProjectStatus(projectId, status) {
  console.log("Updating project", projectId, "to status", status);
  return await saveProject(projectId, null, status);
}

export async function signalProjectIssues(projectId) {
  const client = new Client({
    namespace: "issue-system"
  });

  const query =
    `ProjectId="${projectId}" AND ` +
    `IssueStatus!="FINISHED" AND IssueStatus!="REJECTED"`;

  const workflows = client.workflow.list({ query });

  for await (const wf of workflows) {
    try {
      const handle = client.workflow.getHandle(wf.workflowId);

      console.log("Sending change status to REJECTED to ", wf.workflowId);
      await handle.signal("closeIssue", "REJECTED");
      console.log("Sent");

    } catch (err) {
      console.log("signal failed", err.message);
    }
  }
}
