import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container">
          <Link className="navbar-brand" to="/">Temporal Issue System</Link>
          <div className="navbar-nav">
            <Link 
              className={`nav-link ${location.pathname === '/projects' ? 'active' : ''}`} 
              to="/projects"
            >
              Projects
            </Link>
            <Link 
              className={`nav-link ${location.pathname === '/issues' ? 'active' : ''}`} 
              to="/issues"
            >
              Issues
            </Link>
          </div>
        </div>
      </nav>
      <main className="container py-4">
        {children}
      </main>
    </div>
  );
};
