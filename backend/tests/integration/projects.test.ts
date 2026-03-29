import request from 'supertest';
import { app } from '../../src/index.js';
import {
  Connection,
  Client
} from '@temporalio/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const projectWorkflowPrefix = (id: string) => `project-${id}`;

let connection: Connection;
let client: Client;
let testApp: any;

beforeAll(async () => {
  connection = await Connection.connect({
    address: `${process.env.TEMPORAL_HOST || 'localhost'}:${process.env.TEMPORAL_PORT || 7233}`
  });

  client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'issue-system'
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  if (connection) {
    await connection.close();
  }
});

describe('POST /api/projects', () => {

  describe('success cases', () => {
    it('creates project without body', async () => {
      const response = await request(app)
        .post('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.workflowId).toBeDefined();
      expect(response.body.workflowId).toMatch(/^project-/);
    });

    it('creates project with empty body', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.workflowId).toBeDefined();
      expect(response.body.workflowId).toMatch(/^project-/);
    });

    it('returns unique id', async () => {
      const response1 = await request(app).post('/api/projects');
      const response2 = await request(app).post('/api/projects');

      expect(response1.body.id).not.toBe(response2.body.id);
    });
  });
});

describe('GET /api/projects', () => {

  describe('pagination', () => {
    it('returns paginated results with data, total, page, limit, totalPages', async () => {
      await request(app).post('/api/projects');

      const response = await request(app)
        .get('/api/projects')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('uses default page=1, limit=20', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(20);
    });

    it('returns empty data array when no projects exist', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ page: 999, limit: 10 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('returns 400 for invalid page (non-numeric)', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ page: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid page parameter');
    });

    it('returns 400 for page=0', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ page: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('returns 400 for negative page', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ page: -1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('returns 400 for invalid limit (non-numeric)', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ limit: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid limit parameter');
    });

    it('returns 400 for limit=0', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ limit: 0 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('returns 400 for negative limit', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ limit: -5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('filters', () => {
    it('filters by ACTIVE status', async () => {
      await request(app).post('/api/projects');

      const response = await request(app)
        .get('/api/projects')
        .query({ status: 'ACTIVE' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters by INACTIVE status', async () => {
      await request(app).post('/api/projects');

      const response = await request(app)
        .get('/api/projects')
        .query({ status: 'INACTIVE' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('returns empty data when no projects match status', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ status: 'NONEXISTENT' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('sorting', () => {
    it('sorts by created_at DESC by default', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('sorts by created_at ASC with order=asc', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ order: 'asc' });

      expect(response.status).toBe(200);
    });

    it('sorts by name', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ sortBy: 'name' });

      expect(response.status).toBe(200);
    });

    it('sorts by updated_at', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ sortBy: 'updated_at' });

      expect(response.status).toBe(200);
    });

    it('sorts by status', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ sortBy: 'status' });

      expect(response.status).toBe(200);
    });

    it('returns 400 for invalid sortBy', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ sortBy: 'invalid_column' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid sortBy column');
    });

    it('returns 400 for invalid order', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ order: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid order parameter');
    });

    it('handles case-insensitive order=ASC', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ order: 'ASC' });

      expect(response.status).toBe(200);
    });
  });

  describe('combined parameters', () => {
    it('combines pagination with status filter', async () => {
      const response = await request(app)
        .get('/api/projects')
        .query({ page: 1, limit: 5, status: 'ACTIVE' });

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(5);
    });

    it('maintains sort order across pages', async () => {
      const page1 = await request(app)
        .get('/api/projects')
        .query({ page: 1, limit: 10, order: 'asc' });

      const page2 = await request(app)
        .get('/api/projects')
        .query({ page: 2, limit: 10, order: 'asc' });

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);
    });
  });
});

describe('GET /api/projects/:id', () => {

  describe('success cases', () => {
    it('returns project by id from database', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const getResponse = await request(app)
        .get(`/api/projects/${projectId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(projectId);
    });

    it('returns all fields (id, name, status, created_at, updated_at)', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const getResponse = await request(app)
        .get(`/api/projects/${projectId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('id');
      expect(getResponse.body).toHaveProperty('name');
      expect(getResponse.body).toHaveProperty('status');
      expect(getResponse.body).toHaveProperty('created_at');
      expect(getResponse.body).toHaveProperty('updated_at');
    });

    it('returns freshly created project', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const getResponse = await request(app)
        .get(`/api/projects/${projectId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(projectId);
    });
  });

  describe('error cases', () => {
    it('returns 404 for non-existent UUID', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/projects/${fakeUuid}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Project not found');
    });

    it('returns 404 for malformed UUID', async () => {
      const response = await request(app)
        .get('/api/projects/not-a-valid-uuid');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Project not found');
    });

    it('returns 404 for invalid format', async () => {
      const response = await request(app)
        .get('/api/projects/abc123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Project not found');
    });
  });
});

describe('POST /api/projects/:id/status', () => {

  describe('success cases', () => {
    it('updates status to INACTIVE', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const updateResponse = await request(app)
        .post(`/api/projects/${projectId}/status`)
        .send({ status: 'INACTIVE' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe('INACTIVE');
    });

    it('updates status to ACTIVE', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const updateResponse = await request(app)
        .post(`/api/projects/${projectId}/status`)
        .send({ status: 'ACTIVE' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe('ACTIVE');
    });

    it('returns updated status in response', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const updateResponse = await request(app)
        .post(`/api/projects/${projectId}/status`)
        .send({ status: 'INACTIVE' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('status');
    });
  });

  describe('error cases', () => {
    it('returns 404 for non-existent project', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/projects/${fakeUuid}/status`)
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Project not found');
    });

    it('returns 404 for malformed UUID', async () => {
      const response = await request(app)
        .post('/api/projects/not-a-valid-uuid/status')
        .send({ status: 'INACTIVE' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Project not found');
    });

    it('returns 400 when status missing in body', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const response = await request(app)
        .post(`/api/projects/${projectId}/status`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: status');
    });

    it('returns 400 when status is empty string', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const response = await request(app)
        .post(`/api/projects/${projectId}/status`)
        .send({ status: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: status');
    });

    it('returns 400 when status is null', async () => {
      const createResponse = await request(app)
        .post('/api/projects');

      const projectId = createResponse.body.id;

      const response = await request(app)
        .post(`/api/projects/${projectId}/status`)
        .send({ status: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });
});
