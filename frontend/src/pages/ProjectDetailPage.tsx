import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsApi, issuesApi } from '../services/api';
import { Project, Issue, PaginatedResponse } from '../types';
import { Loading } from '../components/Loading';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchProject = async () => {
    if (!id) return;
    try {
      const projectData = await projectsApi.getById(id);
      setProject(projectData);
    } catch (error) {
      console.error('Error fetching project:', error);
    }
  };

  const fetchIssues = async () => {
    if (!id) return;
    try {
      const response: PaginatedResponse<Issue> = await issuesApi.getAll({
        projectId: id,
        limit: 100
      });
      setIssues(response.data);
    } catch (error) {
      console.error('Error fetching issues:', error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchProject(), fetchIssues()]);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    try {
      await projectsApi.updateStatus(id, newStatus);
      await fetchProject();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!project) {
    return (
      <div className="alert alert-danger">
        Project not found. <Link to="/projects">Back to projects</Link>
      </div>
    );
  }

  return (
    <div>
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/projects">Projects</Link></li>
          <li className="breadcrumb-item active">{project.name}</li>
        </ol>
      </nav>

      <div className="card mb-4">
        <div className="card-body">
          <h2>{project.name}</h2>
          <p>
            Status: 
            <span className={`badge bg-${project.status === 'ACTIVE' ? 'success' : 'secondary'} ms-2`}>
              {project.status}
            </span>
          </p>
          <p className="text-muted">
            Created: {new Date(project.created_at).toLocaleString()}
          </p>
          
          <div className="btn-group">
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleStatusChange('ACTIVE')}
              disabled={updatingStatus || project.status === 'ACTIVE'}
            >
              Set ACTIVE
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => handleStatusChange('INACTIVE')}
              disabled={updatingStatus || project.status === 'INACTIVE'}
            >
              Set INACTIVE
            </button>
          </div>
        </div>
      </div>

      <h3>Issues ({issues.length})</h3>
      {issues.length === 0 ? (
        <p className="text-muted">No issues in this project.</p>
      ) : (
        <div className="list-group">
          {issues.map(issue => (
            <div key={issue.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="mb-1">{issue.title}</h6>
                  <small className="text-muted">by {issue.author}</small>
                </div>
                <span className={`badge bg-${issue.status === 'OPEN' ? 'primary' : issue.status === 'IN_PROGRESS' ? 'warning' : 'success'}`}>
                  {issue.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
