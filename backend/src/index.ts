import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Client,
  Connection
} from '@temporalio/client';
import dotenv from 'dotenv';

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

/*
────────────────────────────
ISSUES ENDPOINTS
────────────────────────────
*/

app.post('/issues', async (req, res) => {

  const id = uuidv4();
  const workflowId = issueWorkflowPrefix(id);

  const handle = await client.workflow.start('issueWorkflow', {
    workflowId,
    taskQueue: 'issues'
  } as any);

  await handle.executeUpdate('initIssue', {
    args: [req.body]
  });

  res.json({
    id,
    workflowId
  });
});

app.post('/issues/:id/comments', async (req, res) => {

  const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));

  const result = await handle.executeUpdate('addComment', {
    args: [req.body]
  });

  res.json(result);
});

app.post('/issues/:id/status', async (req, res) => {

  const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));

  const result = await handle.executeUpdate('changeStatus', {
    args: [req.body.status]
  });

  res.json({ status: result });
});

app.get('/issues/:id/status', async (req, res) => {

  const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));

  const result = await handle.query('getStatus');

  res.json({ status: result });
});

app.get('/issues/:id/comments', async (req, res) => {

  const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));

  const result = await handle.query('getComments');

  res.json({ comments: result });
});

/*
────────────────────────────
PROJECTS ENDPOINTS
────────────────────────────
*/

app.post('/projects', async (req, res) => {

  const id = uuidv4();

  await client.workflow.start('projectWorkflow', {
    workflowId: projectWorkflowPrefix(id),
    taskQueue: 'projects',
    args: [{ projectId: id }]
  } as any);

  res.json({
    id,
    workflowId: projectWorkflowPrefix(id)
  });
});

app.post('/projects/:id/status', async (req, res) => {

  const handle = client.workflow.getHandle(projectWorkflowPrefix(req.params.id));

  const result = await handle.executeUpdate('changeProjectStatus', {
    args: [req.body.status]
  });

  res.json(result);
});

app.get('/projects/:id', async (req, res) => {

  const handle = client.workflow.getHandle(projectWorkflowPrefix(req.params.id));

  const state = await handle.query('getProjectState');

  res.json(state);
});

app.listen(3000, () => {
  console.log('API running on :3000');
});
