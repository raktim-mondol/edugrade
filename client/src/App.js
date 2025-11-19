import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { useAuth } from '@clerk/clerk-react';
import { configureAuth } from './api/axios';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
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
  const { getToken } = useAuth();

  // Configure axios to use Clerk authentication
  useEffect(() => {
    configureAuth(getToken);
  }, [getToken]);

  return (
    <Router>
      <Header />
      <main className="py-3">
        <Container>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />

            {/* Protected routes - require authentication */}
            <Route path="/assignments" element={<ProtectedRoute><AssignmentList /></ProtectedRoute>} />
            <Route path="/assignments/new" element={<ProtectedRoute><AssignmentForm /></ProtectedRoute>} />
            <Route path="/assignments/edit/:id" element={<ProtectedRoute><AssignmentForm /></ProtectedRoute>} />
            <Route path="/assignments/:id/processing" element={<ProtectedRoute><AssignmentProcessingPage /></ProtectedRoute>} />
            <Route path="/assignments/:id/submissions" element={<ProtectedRoute><SubmissionList /></ProtectedRoute>} />
            <Route path="/assignments/:id/submit" element={<ProtectedRoute><SubmissionForm /></ProtectedRoute>} />
            <Route path="/assignments/:id/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />

            {/* Protected project routes */}
            <Route path="/projects" element={<ProtectedRoute><ProjectList /></ProtectedRoute>} />
            <Route path="/projects/new" element={<ProtectedRoute><ProjectForm /></ProtectedRoute>} />
            <Route path="/projects/edit/:id" element={<ProtectedRoute><ProjectForm /></ProtectedRoute>} />
            <Route path="/projects/:id/submit" element={<ProtectedRoute><ProjectSubmissionForm /></ProtectedRoute>} />
            <Route path="/projects/:id/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
            <Route path="/projects/:id/processing" element={<ProtectedRoute><AssignmentProcessingPage /></ProtectedRoute>} />
          </Routes>
        </Container>
      </main>
    </Router>
  );
}

export default App;