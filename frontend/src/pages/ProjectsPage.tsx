import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../services/api';
import { Project, PaginatedResponse } from '../types';
import { Pagination } from '../components/Pagination';
import { Loading } from '../components/Loading';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchProjects = async (pageNum: number) => {
    setLoading(true);
    try {
      const response: PaginatedResponse<Project> = await projectsApi.getAll({
        page: pageNum,
        limit: 10,
        sortBy: 'created_at',
        order: 'desc'
      });
      setProjects(response.data);
      setTotalPages(response.totalPages);
      setTotal(response.total);
      setPage(response.page);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects(1);
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setCreating(true);
    try {
      await projectsApi.create({ name: newProjectName });
      setNewProjectName('');
      fetchProjects(1);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading && projects.length === 0) {
    return <Loading />;
  }

  return (
    <div>
      <h1>Projects</h1>
      <p className="text-muted">Total: {total} projects</p>

      <div className="card mb-4">
        <div className="card-body">
          <form onSubmit={handleCreateProject} className="d-flex gap-2">
            <input
              type="text"
              className="form-control"
              placeholder="New project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={creating || !newProjectName.trim()}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>
      </div>

      <div className="row">
        {projects.map(project => (
          <div key={project.id} className="col-md-6 mb-3">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">{project.name}</h5>
                <p className="card-text">
                  <span className={`badge bg-${project.status === 'ACTIVE' ? 'success' : 'secondary'}`}>
                    {project.status}
                  </span>
                </p>
                <Link to={`/projects/${project.id}`} className="btn btn-sm btn-outline-primary">
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="alert alert-info">No projects found. Create one above.</div>
      )}

      <Pagination 
        currentPage={page} 
        totalPages={totalPages} 
        onPageChange={fetchProjects} 
      />
    </div>
  );
};
