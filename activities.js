import { Client, Connection } from "@temporalio/client";
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
  let connection = null;

  try {
    connection = await Connection.connect({
      address: `${process.env.TEMPORAL_HOST || "localhost"}:${process.env.TEMPORAL_PORT || 7233}`
    });

    const workflowService = connection.workflowService;
    const namespace = process.env.TEMPORAL_NAMESPACE || "issue-system";

    // Visibility query: wszystkie aktywne issues projektu
    const visibilityQuery = 
      `ProjectId="${projectId}" AND ` +
      `IssueStatus!="FINISHED" AND IssueStatus!="REJECTED"`;

    console.log(`[BatchSignal] Starting batch operation for project ${projectId}`);
    console.log(`[BatchSignal] Query: ${visibilityQuery}`);

    // Temporal Batch API - wysyła sygnały na serwerze
    const response = await workflowService.startBatchOperation({
      namespace,
      visibilityQuery,
      signalOperation: {
        signal: "closeIssue",
      },
      reason: `Project ${projectId} deactivation: closing all open issues`,
      jobId: `batch-close-${projectId}-${Date.now()}`
    });

    console.log(`[BatchSignal] Batch operation submitted with jobId: ${response.jobId}`);
    
    return {
      ok: true,
      jobId: response.jobId
    };

  } catch (error) {
    console.error(`[BatchSignal] Failed to start batch operation: ${error.message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}
