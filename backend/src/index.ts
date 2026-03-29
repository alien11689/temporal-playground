import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Client,
  Connection
} from '@temporalio/client';
import dotenv from 'dotenv';
import { pool } from './db/index.js';
import { getProjects, getProjectById, getIssues } from './db/queries.js';

dotenv.config();

const projectWorkflowPrefix = (id: string) => `project-${id}`;
const issueWorkflowPrefix = (id: string) => `issue-${id}`;

const connection = await Connection.connect({
  address: `${process.env.TEMPORAL_HOST || 'localhost'}:${process.env.TEMPORAL_PORT || 7233}`
});

const client = new Client({
  connection,
  namespace: process.env.TEMPORAL_NAMESPACE || 'issue-system'
});

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function parseIntParam(value: string | undefined, defaultValue: number): { value: number; valid: boolean } {
  if (value === undefined) return { value: defaultValue, valid: true };
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return { value: 0, valid: false };
  return { value: parsed, valid: true };
}

const VALID_PROJECT_SORT_COLUMNS = ['name', 'created_at', 'updated_at', 'status'];
const VALID_ISSUE_SORT_COLUMNS = ['title', 'created_at', 'updated_at', 'status'];

/*
────────────────────────────
ISSUES ENDPOINTS
────────────────────────────
*/

app.post('/api/issues', async (req, res) => {

  const body = req.body;
  
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
  }
  if (!body.title || (typeof body.title === 'string' && body.title.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: title' });
  }
  if (!body.author || (typeof body.author === 'string' && body.author.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: author' });
  }
  if (!body.projectId || (typeof body.projectId === 'string' && body.projectId.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: projectId' });
  }

  const id = uuidv4();
  const workflowId = issueWorkflowPrefix(id);

  const handle = await client.workflow.start('issueWorkflow', {
    workflowId,
    taskQueue: 'issues'
  } as any);

  await handle.executeUpdate('initIssue', {
    args: [req.body]
  });

  try {
    await pool.query(
      `INSERT INTO issues (id, title, author, project_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, body.title, body.author, body.projectId, 'OPEN']
    );
    console.log(`Issue ${id} saved to database`);
  } catch (error) {
    console.error('Error saving issue to DB:', error);
  }

  res.json({
    id,
    workflowId
  });
});

app.get('/api/issues', async (req, res) => {
  const pageResult = parseIntParam(req.query.page as string, 1);
  const limitResult = parseIntParam(req.query.limit as string, 20);
  const sortBy = req.query.sortBy as string | undefined;
  const order = req.query.order as string | undefined;
  const projectId = req.query.projectId as string | undefined;
  const status = req.query.status as string | undefined;
  const author = req.query.author as string | undefined;

  if (!pageResult.valid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid page parameter' });
  }
  if (pageResult.value < 1) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid page parameter' });
  }

  if (!limitResult.valid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid limit parameter' });
  }
  if (limitResult.value < 1) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid limit parameter' });
  }

  if (sortBy && !VALID_ISSUE_SORT_COLUMNS.includes(sortBy)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid sortBy column' });
  }

  if (order && !['asc', 'desc', 'ASC', 'DESC'].includes(order)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid order parameter' });
  }

  try {
    const result = await getIssues({
      page: pageResult.value,
      limit: limitResult.value,
      sortBy: sortBy as any,
      order: order as any,
      projectId: projectId || undefined,
      status: status || undefined,
      author: author || undefined
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error fetching issues' });
  }
});

app.post('/api/issues/:id/comments', async (req, res) => {

  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
  }

  const body = req.body;
  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Bad Request', message: 'Request body is required' });
  }
  if (!body.author || (typeof body.author === 'string' && body.author.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: author' });
  }
  if (!body.message || (typeof body.message === 'string' && body.message.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: message' });
  }

  try {
    const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));
    const result = await handle.executeUpdate('addComment', {
      args: [body]
    });
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('NotFound') || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
    }
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error adding comment' });
  }
});

app.post('/api/issues/:id/status', async (req, res) => {

  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
  }

  const body = req.body;
  if (body === undefined || body === null || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: status' });
  }
  if (body.status === undefined || body.status === null || (typeof body.status === 'string' && body.status.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: status' });
  }

  try {
    const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));
    const result = await handle.executeUpdate('changeStatus', {
      args: [body.status]
    });
    res.json({ status: result });
  } catch (error: any) {
    if (error.message?.includes('NotFound') || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
    }
    console.error('Error updating issue status:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error updating issue status' });
  }
});

app.get('/api/issues/:id/status', async (req, res) => {

  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
  }

  try {
    const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));
    const result = await handle.query('getStatus');
    res.json({ status: result });
  } catch (error: any) {
    if (error.message?.includes('NotFound') || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
    }
    console.error('Error getting issue status:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error getting issue status' });
  }
});

app.get('/api/issues/:id/comments', async (req, res) => {

  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
  }

  try {
    const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));
    const result = await handle.query('getComments');
    res.json({ comments: result });
  } catch (error: any) {
    if (error.message?.includes('NotFound') || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Issue not found' });
    }
    console.error('Error getting comments:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error getting comments' });
  }
});

/*
────────────────────────────
PROJECTS ENDPOINTS
────────────────────────────
*/

app.post('/api/projects', async (req, res) => {

  const id = uuidv4();
  const name = req.body?.name?.trim() || 'New Project';

  await client.workflow.start('projectWorkflow', {
    workflowId: projectWorkflowPrefix(id),
    taskQueue: 'projects',
    args: [{ projectId: id }]
  } as any);

  try {
    await pool.query(
      `INSERT INTO projects (id, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [id, name, 'ACTIVE']
    );
  } catch (error) {
    console.error('Error saving project to DB:', error);
  }

  res.json({
    id,
    workflowId: projectWorkflowPrefix(id),
    name
  });
});

app.get('/api/projects', async (req, res) => {
  const pageResult = parseIntParam(req.query.page as string, 1);
  const limitResult = parseIntParam(req.query.limit as string, 20);
  const sortBy = req.query.sortBy as string | undefined;
  const order = req.query.order as string | undefined;
  const status = req.query.status as string | undefined;

  if (!pageResult.valid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid page parameter' });
  }
  if (pageResult.value < 1) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid page parameter' });
  }

  if (!limitResult.valid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid limit parameter' });
  }
  if (limitResult.value < 1) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid limit parameter' });
  }

  if (sortBy && !VALID_PROJECT_SORT_COLUMNS.includes(sortBy)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid sortBy column' });
  }

  if (order && !['asc', 'desc', 'ASC', 'DESC'].includes(order)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Invalid order parameter' });
  }

  try {
    const result = await getProjects({
      page: pageResult.value,
      limit: limitResult.value,
      sortBy: sortBy as any,
      order: order as any,
      status: status || undefined
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error fetching projects' });
  }
});

app.get('/api/projects/:id', async (req, res) => {

  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
  }

  try {
    const project = await getProjectById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error fetching project' });
  }
});

app.post('/api/projects/:id/status', async (req, res) => {

  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
  }

  const body = req.body;
  if (body === undefined || body === null || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: status' });
  }
  if (body.status === undefined || body.status === null || (typeof body.status === 'string' && body.status.trim() === '')) {
    return res.status(400).json({ error: 'Bad Request', message: 'Missing required field: status' });
  }

  try {
    const handle = client.workflow.getHandle(projectWorkflowPrefix(req.params.id));
    const result = await handle.executeUpdate('changeProjectStatus', {
      args: [body.status]
    });
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('NotFound') || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    }
    console.error('Error updating project status:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Error updating project status' });
  }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API Server running on http://localhost:${PORT}`);
  });
}

export { app };
