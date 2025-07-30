import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import Header from './components/Header';
import Home from './pages/Home';
import AssignmentList from './pages/AssignmentList';
import AssignmentForm from './pages/AssignmentForm';
import AssignmentProcessingPage from './pages/AssignmentProcessingPage';
import SubmissionList from './pages/SubmissionList';
import SubmissionForm from './pages/SubmissionForm';
import ResultsPage from './pages/ResultsPage';
import ProjectList from './pages/ProjectList';
import ProjectForm from './pages/ProjectForm';
import ProjectSubmissionForm from './pages/ProjectSubmissionForm';

function App() {
  return (
    <Router>
      <Header />
      <main className="py-3">
        <Container>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/assignments" element={<AssignmentList />} />
            <Route path="/assignments/new" element={<AssignmentForm />} />
            <Route path="/assignments/edit/:id" element={<AssignmentForm />} />
            <Route path="/assignments/:id/processing" element={<AssignmentProcessingPage />} />
            <Route path="/assignments/:id/submissions" element={<SubmissionList />} />
            <Route path="/assignments/:id/submit" element={<SubmissionForm />} />
            <Route path="/assignments/:id/results" element={<ResultsPage />} />
            
            {/* Project routes */}
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/edit/:id" element={<ProjectForm />} />
            <Route path="/projects/:id/submit" element={<ProjectSubmissionForm />} />
            <Route path="/projects/:id/results" element={<ResultsPage />} />
            <Route path="/projects/:id/processing" element={<AssignmentProcessingPage />} />
          </Routes>
        </Container>
      </main>
    </Router>
  );
}

export default App;