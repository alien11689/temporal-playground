import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  Client,
  Connection
} from '@temporalio/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const projectWorkflowPrefix = (id: string) => `project-${id}`;
const issueWorkflowPrefix = (id: string) => `issue-${id}`;

let connection: Connection;
let client: Client;
let app: express.Application;
let testIssueId: string;

beforeAll(async () => {
  connection = await Connection.connect({
    address: `${process.env.TEMPORAL_HOST || 'localhost'}:${process.env.TEMPORAL_PORT || 7233}`
  });

  client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'issue-system'
  });

  app = express();
  app.use(express.json());

  app.post('/projects', async (req, res) => {
    const id = uuidv4();
    await client.workflow.start('projectWorkflow', {
      workflowId: projectWorkflowPrefix(id),
      taskQueue: 'projects',
      args: [{ projectId: id }]
    } as any);
    res.json({ id, workflowId: projectWorkflowPrefix(id) });
  });

  app.post('/issues', async (req, res) => {
    const id = uuidv4();
    const workflowId = issueWorkflowPrefix(id);
    const handle = await client.workflow.start('issueWorkflow', {
      workflowId,
      taskQueue: 'issues'
    } as any);
    await handle.executeUpdate('initIssue', { args: [req.body] });
    res.json({ id, workflowId });
  });

  app.post('/issues/:id/comments', async (req, res) => {
    const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));
    const result = await handle.executeUpdate('addComment', { args: [req.body] });
    res.json(result);
  });

  app.post('/issues/:id/status', async (req, res) => {
    const handle = client.workflow.getHandle(issueWorkflowPrefix(req.params.id));
    const result = await handle.executeUpdate('changeStatus', { args: [req.body.status] });
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
});

afterAll(async () => {
  if (connection) {
    await connection.close();
  }
});

describe('POST /issues', () => {
  it('should create a new issue', async () => {
    const projectResponse = await request(app)
      .post('/projects');
    const projectId = projectResponse.body.id;

    const issueResponse = await request(app)
      .post('/issues')
      .send({
        title: 'Test Issue',
        author: 'test@example.com',
        projectId
      });

    expect(issueResponse.status).toBe(200);
    expect(issueResponse.body.id).toBeDefined();
    expect(issueResponse.body.workflowId).toMatch(/^issue-/);
  });
});

describe('GET /issues/:id/status', () => {
  it('should return issue status', async () => {
    const projectResponse = await request(app)
      .post('/projects');
    const projectId = projectResponse.body.id;

    const issueResponse = await request(app)
      .post('/issues')
      .send({
        title: 'Test Issue',
        author: 'test@example.com',
        projectId
      });

    const issueId = issueResponse.body.id;

    const statusResponse = await request(app)
      .get(`/issues/${issueId}/status`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status).toBeDefined();
  });
});

describe('POST /issues/:id/status', () => {
  it('should update issue status', async () => {
    const projectResponse = await request(app)
      .post('/projects');
    const projectId = projectResponse.body.id;

    const issueResponse = await request(app)
      .post('/issues')
      .send({
        title: 'Test Issue',
        author: 'test@example.com',
        projectId
      });

    const issueId = issueResponse.body.id;

    const updateResponse = await request(app)
      .post(`/issues/${issueId}/status`)
      .send({ status: 'IN_PROGRESS' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe('IN_PROGRESS');
  });
});

describe('Comments', () => {
  beforeEach(async () => {
    const projectResponse = await request(app).post('/projects');
    const projectId = projectResponse.body.id;

    const issueResponse = await request(app)
      .post('/issues')
      .send({
        title: 'Test Issue for Comments',
        author: 'test@example.com',
        projectId
      });

    testIssueId = issueResponse.body.id;
  });

  describe('POST /issues/:id/comments', () => {
    it('should add a comment to issue', async () => {
      const response = await request(app)
        .post(`/issues/${testIssueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: 'Test comment'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /issues/:id/comments', () => {
    it('should return all comments for issue', async () => {
      await request(app)
        .post(`/issues/${testIssueId}/comments`)
        .send({
          author: 'commenter1@example.com',
          message: 'First comment'
        });

      await request(app)
        .post(`/issues/${testIssueId}/comments`)
        .send({
          author: 'commenter2@example.com',
          message: 'Second comment'
        });

      const response = await request(app)
        .get(`/issues/${testIssueId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.comments).toBeDefined();
      expect(Array.isArray(response.body.comments)).toBe(true);
      expect(response.body.comments.length).toBe(2);
    });
  });
});
