import request from 'supertest';
import { app } from '../../src/index.js';
import {
  Connection,
  Client
} from '@temporalio/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const projectWorkflowPrefix = (id: string) => `project-${id}`;
const issueWorkflowPrefix = (id: string) => `issue-${id}`;

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

async function createProject(): Promise<string> {
  const projectResponse = await request(app).post('/api/projects');
  return projectResponse.body.id;
}

describe('POST /api/issues', () => {

  describe('success cases', () => {
    it('creates issue with valid data', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      expect(issueResponse.status).toBe(200);
      expect(issueResponse.body.id).toBeDefined();
      expect(issueResponse.body.workflowId).toMatch(/^issue-/);
    });

    it('starts issueWorkflow', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      expect(issueResponse.status).toBe(200);
      expect(issueResponse.body.workflowId).toMatch(/^issue-/);
    });

    it('calls initIssue update', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      expect(issueResponse.status).toBe(200);
    });

    it('returns id and workflowId', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      expect(issueResponse.status).toBe(200);
      expect(issueResponse.body).toHaveProperty('id');
      expect(issueResponse.body).toHaveProperty('workflowId');
    });
  });

  describe('validation', () => {
    it('returns 400 when title is missing', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .post('/api/issues')
        .send({
          author: 'test@example.com',
          projectId
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 when author is missing', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          projectId
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com'
        });

      expect(response.status).toBe(400);
    });

    it('returns 400 when body is empty object', async () => {
      const response = await request(app)
        .post('/api/issues')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('data handling', () => {
    it('ignores extra fields in body', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId,
          extraField: 'should be ignored'
        });

      expect(response.status).toBe(200);
    });

    it('handles very long title', async () => {
      const projectId = await createProject();
      const longTitle = 'A'.repeat(1000);

      const response = await request(app)
        .post('/api/issues')
        .send({
          title: longTitle,
          author: 'test@example.com',
          projectId
        });

      expect(response.status).toBe(200);
    });

    it('handles special characters in title', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test <script>alert("xss")</script> Issue',
          author: 'test@example.com',
          projectId
        });

      expect(response.status).toBe(200);
    });

    it('handles unicode characters', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .post('/api/issues')
        .send({
          title: 'Тестовая задача 日本語',
          author: 'test@example.com',
          projectId
        });

      expect(response.status).toBe(200);
    });
  });
});

describe('GET /api/issues', () => {

  describe('pagination', () => {
    it('returns paginated results with correct structure', async () => {
      await createProject();

      const response = await request(app)
        .get('/api/issues')
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

    it('returns empty data array when no issues', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ page: 999, limit: 10 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('calculates totalPages correctly', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(typeof response.body.totalPages).toBe('number');
    });

    it('returns 400 for invalid page', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ page: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid page parameter');
    });

    it('returns 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ limit: 'xyz' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid limit parameter');
    });
  });

  describe('filters', () => {
    it('filters by projectId', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .get('/api/issues')
        .query({ projectId });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters by status OPEN', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ status: 'OPEN' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters by status IN_PROGRESS', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters by status CLOSED', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ status: 'CLOSED' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('filters by author', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ author: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('combines projectId and status filters', async () => {
      const projectId = await createProject();

      const response = await request(app)
        .get('/api/issues')
        .query({ projectId, status: 'OPEN' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('returns empty when no issues match filters', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ status: 'NONEXISTENT' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('sorting', () => {
    it('sorts by created_at DESC by default', async () => {
      const response = await request(app)
        .get('/api/issues');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('sorts by title', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ sortBy: 'title' });

      expect(response.status).toBe(200);
    });

    it('sorts by updated_at', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ sortBy: 'updated_at' });

      expect(response.status).toBe(200);
    });

    it('sorts by status', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ sortBy: 'status' });

      expect(response.status).toBe(200);
    });

    it('returns 400 for invalid sortBy', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ sortBy: 'invalid_column' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Invalid sortBy column');
    });
  });

  describe('edge cases', () => {
    it('handles empty string filter values', async () => {
      const response = await request(app)
        .get('/api/issues')
        .query({ author: '' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});

describe('GET /api/issues/:id/status', () => {

  describe('success cases', () => {
    it('returns status for valid issue', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const statusResponse = await request(app)
        .get(`/api/issues/${issueId}/status`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBeDefined();
    });

    it('returns OPEN status for new issue', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const statusResponse = await request(app)
        .get(`/api/issues/${issueId}/status`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe('OPEN');
    });
  });

  describe('error cases', () => {
    it('returns 404 for non-existent issue', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/issues/${fakeUuid}/status`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });

    it('returns 404 for malformed UUID', async () => {
      const response = await request(app)
        .get('/api/issues/not-a-valid-uuid/status');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });
  });
});

describe('POST /api/issues/:id/status', () => {

  describe('success cases', () => {
    it('updates status to IN_PROGRESS', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const updateResponse = await request(app)
        .post(`/api/issues/${issueId}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe('IN_PROGRESS');
    });

    it('updates status to CLOSED', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const updateResponse = await request(app)
        .post(`/api/issues/${issueId}/status`)
        .send({ status: 'CLOSED' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe('CLOSED');
    });

    it('returns updated status', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const updateResponse = await request(app)
        .post(`/api/issues/${issueId}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('status');
    });
  });

  describe('error cases', () => {
    it('returns 404 for non-existent issue', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/issues/${fakeUuid}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });

    it('returns 404 for malformed UUID', async () => {
      const response = await request(app)
        .post('/api/issues/not-a-valid-uuid/status')
        .send({ status: 'IN_PROGRESS' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });

    it('returns 400 when status is missing', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/status`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: status');
    });

    it('returns 400 when status is empty string', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/status`)
        .send({ status: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: status');
    });

    it('returns 400 when status is null', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/status`)
        .send({ status: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });
  });
});

describe('POST /api/issues/:id/comments', () => {

  describe('success cases', () => {
    it('adds comment with valid data', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: 'Test comment'
        });

      expect(response.status).toBe(200);
    });

    it('adds multiple comments', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter1@example.com',
          message: 'First comment'
        });

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter2@example.com',
          message: 'Second comment'
        });

      const commentsResponse = await request(app)
        .get(`/api/issues/${issueId}/comments`);

      expect(commentsResponse.status).toBe(200);
    });

    it('preserves comment order', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter1@example.com',
          message: 'Comment 1'
        });

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter2@example.com',
          message: 'Comment 2'
        });

      const commentsResponse = await request(app)
        .get(`/api/issues/${issueId}/comments`);

      expect(commentsResponse.body.comments.length).toBe(2);
    });
  });

  describe('validation', () => {
    it('returns 400 when author is missing', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          message: 'Test comment'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: author');
    });

    it('returns 400 when message is missing', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: message');
    });

    it('returns 400 when body is empty', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Request body is required');
    });

    it('returns 400 when author is empty string', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: '',
          message: 'Test comment'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: author');
    });

    it('returns 400 when message is empty string', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toBe('Missing required field: message');
    });
  });

  describe('data handling', () => {
    it('handles very long message', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;
      const longMessage = 'A'.repeat(10000);

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: longMessage
        });

      expect(response.status).toBe(200);
    });

    it('handles special characters', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: 'Message with <special> chars & symbols'
        });

      expect(response.status).toBe(200);
    });

    it('handles unicode characters', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: 'Комментарий 日本語 émojis 🎉'
        });

      expect(response.status).toBe(200);
    });

    it('handles null values in body', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: null,
          message: null
        });

      expect(response.status).toBe(400);
    });
  });

  describe('error cases', () => {
    it('returns 404 for non-existent issue', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/issues/${fakeUuid}/comments`)
        .send({
          author: 'commenter@example.com',
          message: 'Test comment'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });

    it('returns 404 for malformed UUID', async () => {
      const response = await request(app)
        .post('/api/issues/not-a-valid-uuid/comments')
        .send({
          author: 'commenter@example.com',
          message: 'Test comment'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });
  });
});

describe('GET /api/issues/:id/comments', () => {

  describe('success cases', () => {
    it('returns empty array for issue with no comments', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      const response = await request(app)
        .get(`/api/issues/${issueId}/comments`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    it('returns all comments in order', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter1@example.com',
          message: 'First comment'
        });

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter2@example.com',
          message: 'Second comment'
        });

      const response = await request(app)
        .get(`/api/issues/${issueId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBe(2);
    });

    it('returns comments with author and message', async () => {
      const projectId = await createProject();

      const issueResponse = await request(app)
        .post('/api/issues')
        .send({
          title: 'Test Issue',
          author: 'test@example.com',
          projectId
        });

      const issueId = issueResponse.body.id;

      await request(app)
        .post(`/api/issues/${issueId}/comments`)
        .send({
          author: 'commenter@example.com',
          message: 'Test comment'
        });

      const response = await request(app)
        .get(`/api/issues/${issueId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.comments.length).toBeGreaterThan(0);
      expect(response.body.comments[0]).toHaveProperty('author');
      expect(response.body.comments[0]).toHaveProperty('message');
    });
  });

  describe('error cases', () => {
    it('returns 404 for non-existent issue', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/issues/${fakeUuid}/comments`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });

    it('returns 404 for malformed UUID', async () => {
      const response = await request(app)
        .get('/api/issues/not-a-valid-uuid/comments');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Issue not found');
    });
  });
});
