export interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  title: string;
  author: string;
  project_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;
  message: string;
  datetime: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProjectInput {
  name: string;
}

export interface CreateIssueInput {
  title: string;
  author: string;
  projectId: string;
}

export interface CreateCommentInput {
  author: string;
  message: string;
}

export interface ProjectQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  order?: string;
}

export interface IssueQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
  status?: string;
  author?: string;
  sortBy?: string;
  order?: string;
}
