import axios from 'axios';
import type { 
  Project, 
  Issue, 
  Comment, 
  PaginatedResponse,
  CreateProjectInput,
  CreateIssueInput,
  CreateCommentInput,
  ProjectQueryParams,
  IssueQueryParams
} from '../types';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const projectsApi = {
  getAll: async (params: ProjectQueryParams = {}): Promise<PaginatedResponse<Project>> => {
    const response = await api.get('/projects', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Project> => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  create: async (data: CreateProjectInput): Promise<{ projectId: string; workflowId: string }> => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  updateStatus: async (id: string, status: string): Promise<any> => {
    const response = await api.post(`/projects/${id}/status`, { status });
    return response.data;
  }
};

export const issuesApi = {
  getAll: async (params: IssueQueryParams = {}): Promise<PaginatedResponse<Issue>> => {
    const response = await api.get('/issues', { params });
    return response.data;
  },

  getStatus: async (id: string): Promise<{ status: string }> => {
    const response = await api.get(`/issues/${id}/status`);
    return response.data;
  },

  create: async (data: CreateIssueInput): Promise<{ workflowId: string; result: any }> => {
    const response = await api.post('/issues', data);
    return response.data;
  },

  updateStatus: async (id: string, status: string): Promise<{ status: string }> => {
    const response = await api.post(`/issues/${id}/status`, { status });
    return response.data;
  }
};

export const commentsApi = {
  getByIssueId: async (issueId: string): Promise<{ comments: Comment[] }> => {
    const response = await api.get(`/issues/${issueId}/comments`);
    return response.data;
  },

  create: async (issueId: string, data: CreateCommentInput): Promise<any> => {
    const response = await api.post(`/issues/${issueId}/comments`, data);
    return response.data;
  }
};
