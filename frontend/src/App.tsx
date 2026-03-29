import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { IssuesPage } from './pages/IssuesPage';
import { CreateIssuePage } from './pages/CreateIssuePage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/issues/new" element={<CreateIssuePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
