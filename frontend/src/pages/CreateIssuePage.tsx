import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { issuesApi, projectsApi } from '../services/api';
import { Project } from '../types';

export const CreateIssuePage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsApi.getAll({ limit: 100 });
        setProjects(response.data);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || !projectId) {
      setError('All fields are required');
      return;
    }

    setCreating(true);
    setError('');
    try {
      await issuesApi.create({ title: title.trim(), author: author.trim(), projectId });
      navigate('/issues');
    } catch (err: any) {
      console.error('Error creating issue:', err);
      setError(err.response?.data?.message || 'Failed to create issue');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div>
      <h1>Create Issue</h1>
      <p className="text-muted">Create a new issue for a project</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Title</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter issue title"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Author</label>
              <input
                type="text"
                className="form-control"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Enter author name or email"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={creating || !title.trim() || !author.trim() || !projectId}
              >
                {creating ? 'Creating...' : 'Create Issue'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/issues')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
