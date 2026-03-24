import { pool } from './index.js';
import {
  Project,
  Issue,
  ProjectQueryParams,
  IssueQueryParams,
  PaginatedResponse
} from '../types/index.js';

const VALID_PROJECT_SORT_COLUMNS = ['name', 'created_at', 'updated_at', 'status'];
const VALID_ISSUE_SORT_COLUMNS = ['title', 'created_at', 'updated_at', 'status'];

function isValidProjectSortColumn(col: string): col is 'name' | 'created_at' | 'updated_at' | 'status' {
  return VALID_PROJECT_SORT_COLUMNS.includes(col);
}

function isValidIssueSortColumn(col: string): col is 'title' | 'created_at' | 'updated_at' | 'status' {
  return VALID_ISSUE_SORT_COLUMNS.includes(col);
}

export async function getProjects(
  params: ProjectQueryParams = {}
): Promise<PaginatedResponse<Project>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;
  const sortBy = params.sortBy ?? 'created_at';
  const order = (params.order ?? 'desc').toLowerCase() as 'asc' | 'desc';
  const status = params.status;

  const validOrder = order === 'asc' ? 'ASC' : 'DESC';
  const validSortBy = isValidProjectSortColumn(sortBy) ? sortBy : 'created_at';

  let countQuery = 'SELECT COUNT(*) FROM projects';
  let dataQuery = `SELECT id, name, status, created_at, updated_at FROM projects`;
  const values: any[] = [];
  const countValues: any[] = [];

  if (status) {
    countQuery += ' WHERE status = $1';
    dataQuery += ' WHERE status = $1';
    countValues.push(status);
    values.push(status);
  }

  dataQuery += ` ORDER BY ${validSortBy} ${validOrder} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
  values.push(limit, offset);

  const countResult = await pool.query(countQuery, countValues);
  const total = parseInt(countResult.rows[0].count);

  const dataResult = await pool.query(dataQuery, values);

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getProjectById(id: string): Promise<Project | null> {
  const result = await pool.query(
    'SELECT id, name, status, created_at, updated_at FROM projects WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

export async function getIssues(
  params: IssueQueryParams = {}
): Promise<PaginatedResponse<Issue>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;
  const sortBy = params.sortBy ?? 'created_at';
  const order = (params.order ?? 'desc').toLowerCase() as 'asc' | 'desc';
  const projectId = params.projectId;
  const status = params.status;
  const author = params.author;

  const validOrder = order === 'asc' ? 'ASC' : 'DESC';
  const validSortBy = isValidIssueSortColumn(sortBy) ? sortBy : 'created_at';

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (projectId) {
    conditions.push(`project_id = $${paramIndex}`);
    values.push(projectId);
    paramIndex++;
  }

  if (status) {
    conditions.push(`status = $${paramIndex}`);
    values.push(status);
    paramIndex++;
  }

  if (author) {
    conditions.push(`author = $${paramIndex}`);
    values.push(author);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `SELECT COUNT(*) FROM issues ${whereClause}`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count);

  const dataQuery = `SELECT id, title, author, project_id, status, created_at, updated_at FROM issues ${whereClause} ORDER BY ${validSortBy} ${validOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  values.push(limit, offset);

  const dataResult = await pool.query(dataQuery, values);

  return {
    data: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
