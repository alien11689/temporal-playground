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

    res.json({
      id,
      workflowId: projectWorkflowPrefix(id)
    });
  });

  app.get('/projects/:id', async (req, res) => {
    const handle = client.workflow.getHandle(projectWorkflowPrefix(req.params.id));
    const state = await handle.query('getProjectState');
    res.json(state);
  });

  app.post('/projects/:id/status', async (req, res) => {
    const handle = client.workflow.getHandle(projectWorkflowPrefix(req.params.id));
    const result = await handle.executeUpdate('changeProjectStatus', {
      args: [req.body.status]
    });
    res.json(result);
  });
});

afterAll(async () => {
  if (connection) {
    await connection.close();
  }
});

describe('POST /projects', () => {
  it('should create a new project', async () => {
    const response = await request(app)
      .post('/projects');

    expect(response.status).toBe(200);
    expect(response.body.id).toBeDefined();
    expect(response.body.workflowId).toBeDefined();
    expect(response.body.workflowId).toMatch(/^project-/);
  });
});

describe('GET /projects/:id', () => {
  it('should return project state', async () => {
    const createResponse = await request(app)
      .post('/projects');

    const projectId = createResponse.body.id;

    const getResponse = await request(app)
      .get(`/projects/${projectId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.projectId).toBe(projectId);
  });
});

describe('POST /projects/:id/status', () => {
  it('should update project status', async () => {
    const createResponse = await request(app)
      .post('/projects');

    const projectId = createResponse.body.id;

    const updateResponse = await request(app)
      .post(`/projects/${projectId}/status`)
      .send({ status: 'INACTIVE' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe('INACTIVE');
  });
});
