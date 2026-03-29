import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { issuesApi, projectsApi } from '../services/api';
import { Issue, Project, PaginatedResponse } from '../types';
import { Pagination } from '../components/Pagination';
import { Loading } from '../components/Loading';

export const IssuesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const projectId = searchParams.get('projectId') || undefined;
  const status = searchParams.get('status') || undefined;

  const fetchIssues = async (pageNum: number, projId?: string, stat?: string) => {
    setLoading(true);
    try {
      const response: PaginatedResponse<Issue> = await issuesApi.getAll({
        page: pageNum,
        limit: 10,
        projectId: projId,
        status: stat,
        sortBy: 'created_at',
        order: 'desc'
      });
      setIssues(response.data);
      setTotalPages(response.totalPages);
      setTotal(response.total);
      setPage(response.page);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues(1, projectId, status);
  }, [searchParams]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsApi.getAll({ limit: 100 });
        setProjects(response.data);
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };
    fetchProjects();
  }, []);

  const handlePageChange = (newPage: number) => {
    fetchIssues(newPage, projectId, status);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  if (loading && issues.length === 0) {
    return <Loading />;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="mb-0">Issues</h1>
        <Link to="/issues/new" className="btn btn-primary">New Issue</Link>
      </div>
      <p className="text-muted">Total: {total} issues</p>

      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Project</label>
              <select 
                className="form-select"
                value={projectId || ''}
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select 
                className="form-select"
                value={status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="FINISHED">FINISHED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Project ID</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {issues.map(issue => (
              <tr key={issue.id}>
                <td>{issue.title}</td>
                <td>{issue.author}</td>
                <td>
                  <Link to={`/projects/${issue.project_id}`}>
                    {issue.project_id.slice(0, 8)}...
                  </Link>
                </td>
                <td>
                  <span className={`badge bg-${
                    issue.status === 'OPEN' ? 'primary' : 
                    issue.status === 'IN_PROGRESS' ? 'warning' : 
                    issue.status === 'FINISHED' ? 'success' : 'danger'
                  }`}>
                    {issue.status}
                  </span>
                </td>
                <td>{new Date(issue.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issues.length === 0 && (
        <div className="alert alert-info">No issues found.</div>
      )}

      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={handlePageChange} 
      />
    </div>
  );
};
