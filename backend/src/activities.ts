import { Pool } from 'pg';
import { Connection } from '@temporalio/client';
import { Project, Issue, Comment } from './types/index.ts';

let dbPool: Pool | null = null;

export function initializeDbPool(pool: Pool): void {
  dbPool = pool;
}

// ==================== PROJECT ACTIVITIES ====================

export async function saveProject(
  projectId: string, 
  name: string | null, 
  status: string
): Promise<{ ok: boolean; project?: Project }> {
  if (!dbPool) throw new Error('Database pool not initialized');

  try {
    if (name === null || name === undefined) {
      const query = `
        UPDATE projects
        SET status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, name, status, created_at, updated_at;
      `;
      const result = await dbPool.query(query, [projectId, status]);
      console.log('Project status updated:', result.rows[0]);
      return { ok: true, project: result.rows[0] };
    }

    const query = `
      INSERT INTO projects (id, name, status, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        status = $3,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, name, status, created_at, updated_at;
    `;

    const result = await dbPool.query(query, [projectId, name, status]);
    console.log('Project saved:', result.rows[0]);
    return { ok: true, project: result.rows[0] };
  } catch (error) {
    console.error('Failed to save project:', error);
    throw error;
  }
}

export async function getProject(projectId: string): Promise<Project | null> {
  if (!dbPool) throw new Error('Database pool not initialized');

  try {
    const query = `SELECT * FROM projects WHERE id = $1;`;
    const result = await dbPool.query(query, [projectId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Failed to get project:', error);
    throw error;
  }
}

// ==================== ISSUE ACTIVITIES ====================

export async function saveIssue(
  issueId: string,
  title: string,
  author: string,
  projectId: string,
  status: string
): Promise<{ ok: boolean; issue?: Issue }> {
  if (!dbPool) throw new Error('Database pool not initialized');

  try {
    const query = `
      INSERT INTO issues (id, title, author, project_id, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        title = $2,
        author = $3,
        status = $5,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, title, author, project_id, status, created_at, updated_at;
    `;

    const result = await dbPool.query(query, [issueId, title, author, projectId, status]);
    console.log('Issue saved:', result.rows[0]);
    return { ok: true, issue: result.rows[0] };
  } catch (error) {
    console.error('Failed to save issue:', error);
    throw error;
  }
}

export async function getIssue(issueId: string): Promise<Issue | null> {
  if (!dbPool) throw new Error('Database pool not initialized');

  try {
    const query = `SELECT * FROM issues WHERE id = $1;`;
    const result = await dbPool.query(query, [issueId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Failed to get issue:', error);
    throw error;
  }
}

// ==================== COMMENT ACTIVITIES ====================

export async function saveComment(
  issueId: string,
  author: string,
  message: string
): Promise<{ ok: boolean; comment?: Comment }> {
  if (!dbPool) throw new Error('Database pool not initialized');

  try {
    const query = `
      INSERT INTO comments (issue_id, author, message, datetime, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, issue_id, author, message, datetime, created_at;
    `;

    const result = await dbPool.query(query, [issueId, author, message]);
    console.log('Comment saved:', result.rows[0]);
    return { ok: true, comment: result.rows[0] };
  } catch (error) {
    console.error('Failed to save comment:', error);
    throw error;
  }
}

export async function getIssueComments(issueId: string): Promise<Comment[]> {
  if (!dbPool) throw new Error('Database pool not initialized');

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
    console.error('Failed to get issue comments:', error);
    throw error;
  }
}

// ==================== LEGACY ACTIVITIES ====================

export async function updateProjectStatus(
  projectId: string, 
  status: string
): Promise<{ ok: boolean; project?: Project }> {
  console.log('Updating project', projectId, 'to status', status);
  return await saveProject(projectId, null, status);
}

export async function signalProjectIssues(projectId: string): Promise<{ ok: boolean; jobId: string }> {
  let connection: Connection | null = null;

  try {
    connection = await Connection.connect({
      address: `${process.env.TEMPORAL_HOST || 'localhost'}:${process.env.TEMPORAL_PORT || 7233}`
    });

    const workflowService = connection.workflowService;
    const namespace = process.env.TEMPORAL_NAMESPACE || 'issue-system';

    const visibilityQuery = 
      `ProjectId="${projectId}" AND ` +
      `IssueStatus!="FINISHED" AND IssueStatus!="REJECTED"`;

    console.log(`[BatchSignal] Starting batch operation for project ${projectId}`);
    console.log(`[BatchSignal] Query: ${visibilityQuery}`);

    const response = await workflowService.startBatchOperation({
      namespace,
      visibilityQuery,
      signalOperation: {
        signal: 'closeIssue',
      },
      reason: `Project ${projectId} deactivation: closing all open issues`,
      jobId: `batch-close-${projectId}-${Date.now()}`
    } as any);

    console.log(`[BatchSignal] Batch operation submitted with jobId: ${(response as any).jobId}`);
    
    return {
      ok: true,
      jobId: (response as any).jobId
    };

  } catch (error) {
    console.error(`[BatchSignal] Failed to start batch operation: ${(error as Error).message}`);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}
