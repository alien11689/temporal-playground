export interface Project {
  id: string;
  name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Issue {
  id: string;
  title: string;
  author: string;
  project_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Comment {
  id: string;
  issue_id: string;
  author: string;
  message: string;
  datetime: Date;
  created_at: Date;
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

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  sortBy: string;
  order: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProjectQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'status';
  order?: 'asc' | 'desc';
}

export interface IssueQueryParams {
  page?: number;
  limit?: number;
  projectId?: string;
  status?: string;
  author?: string;
  sortBy?: 'title' | 'created_at' | 'updated_at' | 'status';
  order?: 'asc' | 'desc';
}
