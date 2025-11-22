import React, { useState, useEffect } from 'react';
import { useAuth, useUser, SignIn, SignUp } from '@clerk/clerk-react';
import api from '../utils/api';
import Landing from './Landing';
import SetupForm from './SetupForm';
import ProjectSetupForm from './ProjectSetupForm';
import Dashboard from './Dashboard';
import Workspaces from './Workspaces';
import Pricing from './Pricing';
import Docs from './Docs';
import Privacy from './Privacy';
import Terms from './Terms';

const AppView = {
  LANDING: 'LANDING',
  PRICING: 'PRICING',
  WORKSPACES: 'WORKSPACES',
  SETUP: 'SETUP',
  PROJECT_SETUP: 'PROJECT_SETUP',
  DASHBOARD: 'DASHBOARD',
  PROJECT_DASHBOARD: 'PROJECT_DASHBOARD',
  DOCS: 'DOCS',
  PRIVACY: 'PRIVACY',
  TERMS: 'TERMS',
  SIGN_IN: 'SIGN_IN',
  SIGN_UP: 'SIGN_UP'
};

function GradeMindApp() {
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const [view, setView] = useState(AppView.LANDING);
  const [assignments, setAssignments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Load assignments and projects from backend API (with localStorage fallback)
  useEffect(() => {
    if (isSignedIn && user) {
      const fetchFromBackend = async () => {
        try {
          // Get auth token from Clerk
          const token = await window.Clerk?.session?.getToken();

          // Fetch assignments from backend
          const assignmentsResponse = await api.get('/assignments', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });

          if (assignmentsResponse.data?.assignments) {
            // Transform backend assignments to local format
            const backendAssignments = assignmentsResponse.data.assignments.map(a => ({
              id: a._id,
              config: {
                title: a.title,
                description: a.description,
                totalScore: a.totalPoints,
                assignmentFile: a.assignmentFile ? { name: a.assignmentFile.split('/').pop() } : undefined,
                rubricFile: a.rubricFile ? { name: a.rubricFile.split('/').pop() } : undefined,
                solutionFile: a.solutionFile ? { name: a.solutionFile.split('/').pop() } : undefined,
              },
              sections: (a.sections || []).map(s => ({
                ...s,
                students: s.students || []
              })),
              submissionCount: a.submissionCount || 0,
              createdAt: new Date(a.createdAt).getTime(),
              backendId: a._id,
              processingStatus: a.processingStatus
            }));

            setAssignments(backendAssignments);
            console.log('✅ Loaded', backendAssignments.length, 'assignments from backend');
          }

          // Fetch projects from backend
          const projectsResponse = await api.get('/projects', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });

          if (projectsResponse.data?.projects) {
            const backendProjects = projectsResponse.data.projects.map(p => ({
              id: p._id,
              config: {
                title: p.title,
                description: p.description,
                totalPoints: p.totalPoints,
                projectType: p.projectType,
                programmingLanguage: p.programmingLanguage,
                rubricFile: p.rubricFile ? { name: p.rubricFile.split('/').pop() } : undefined,
              },
              submissions: [],
              createdAt: new Date(p.createdAt).getTime(),
              backendId: p._id,
              processingStatus: p.processingStatus
            }));

            setProjects(backendProjects);
            console.log('✅ Loaded', backendProjects.length, 'projects from backend');
          }

        } catch (error) {
          console.error('❌ Error fetching from backend, falling back to localStorage:', error);

          // Fallback to localStorage
          const assignmentKey = `grademind-assignments-${user.id}`;
          const projectKey = `grademind-projects-${user.id}`;

          const savedAssignments = localStorage.getItem(assignmentKey);
          if (savedAssignments) {
            try {
              setAssignments(JSON.parse(savedAssignments));
            } catch (e) {
              console.error('Failed to load saved assignments:', e);
            }
          }

          const savedProjects = localStorage.getItem(projectKey);
          if (savedProjects) {
            try {
              setProjects(JSON.parse(savedProjects));
            } catch (e) {
              console.error('Failed to load saved projects:', e);
            }
          }
        }
      };

      fetchFromBackend();
    }
  }, [isSignedIn, user]);

  // Save assignments to localStorage whenever they change (keyed by user ID)
  useEffect(() => {
    if (isSignedIn && user) {
      const storageKey = `grademind-assignments-${user.id}`;
      // Remove large file data before saving to localStorage to prevent quota errors
      const assignmentsToSave = assignments.map(a => ({
        ...a,
        config: a.config ? {
          ...a.config,
          // Remove base64 file data - only keep file names
          assignmentFile: a.config.assignmentFile ? { name: a.config.assignmentFile.name } : undefined,
          rubricFile: a.config.rubricFile ? { name: a.config.rubricFile.name } : undefined,
          solutionFile: a.config.solutionFile ? { name: a.config.solutionFile.name } : undefined,
        } : a.config
      }));
      try {
        localStorage.setItem(storageKey, JSON.stringify(assignmentsToSave));
      } catch (error) {
        console.error('Failed to save assignments to localStorage:', error);
      }
    }
  }, [assignments, isSignedIn, user]);

  // Save projects to localStorage whenever they change (keyed by user ID)
  useEffect(() => {
    if (isSignedIn && user) {
      const storageKey = `grademind-projects-${user.id}`;
      const projectsToSave = projects.map(p => ({
        ...p,
        config: p.config ? {
          ...p.config,
          rubricFile: p.config.rubricFile ? { name: p.config.rubricFile.name } : undefined,
        } : p.config
      }));
      try {
        localStorage.setItem(storageKey, JSON.stringify(projectsToSave));
      } catch (error) {
        console.error('Failed to save projects to localStorage:', error);
      }
    }
  }, [projects, isSignedIn, user]);

  // Redirect to workspaces when user signs in
  useEffect(() => {
    if (isLoaded && isSignedIn && (view === AppView.SIGN_IN || view === AppView.SIGN_UP || view === AppView.LANDING)) {
      setView(AppView.WORKSPACES);
    }
  }, [isLoaded, isSignedIn, view]);

  // Handle hash changes for Clerk's internal navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('sign-in')) {
        setView(AppView.SIGN_IN);
      } else if (hash.includes('sign-up')) {
        setView(AppView.SIGN_UP);
      } else if (hash.includes('workspaces')) {
        if (isSignedIn) {
          setView(AppView.WORKSPACES);
        }
      }
      // Clear the hash after handling
      if (hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    // Check initial hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isSignedIn]);

  const handleStart = () => {
    setView(AppView.PRICING);
  };

  const handleSignIn = () => {
    setView(AppView.SIGN_IN);
  };

  const handleSignUp = () => {
    setView(AppView.SIGN_UP);
  };

  const handlePlanSelect = (plan) => {
    console.log(`Selected plan: ${plan}`);
    if (isSignedIn) {
      setView(AppView.WORKSPACES);
    } else {
      setView(AppView.SIGN_UP);
    }
  };

  const handleCreateAssignment = async (config) => {
    try {
      // Create FormData for multipart upload
      const formData = new FormData();

      // Add basic fields
      formData.append('title', config.title);
      formData.append('totalPoints', config.totalScore || 100);
      formData.append('description', config.description || '');

      // Helper to convert base64 to Blob
      const base64ToBlob = (base64Data, mimeType) => {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      };

      // Handle assignment PDF file or text
      if (config.assignmentFile) {
        const blob = base64ToBlob(config.assignmentFile.data, config.assignmentFile.mimeType);
        formData.append('assignment', blob, config.assignmentFile.name);
      } else if (config.assignmentText) {
        // Send assignment text as a text field
        formData.append('assignmentText', config.assignmentText);
      }

      // Handle rubric file
      if (config.rubricFile) {
        const blob = base64ToBlob(config.rubricFile.data, config.rubricFile.mimeType);
        formData.append('rubric', blob, config.rubricFile.name);
      } else if (config.rubric) {
        const blob = new Blob([config.rubric], { type: 'text/plain' });
        formData.append('rubric', blob, 'rubric.txt');
      }

      // Handle solution file
      if (config.solutionFile) {
        const blob = base64ToBlob(config.solutionFile.data, config.solutionFile.mimeType);
        formData.append('solution', blob, config.solutionFile.name);
      } else if (config.solution) {
        const blob = new Blob([config.solution], { type: 'text/plain' });
        formData.append('solution', blob, 'solution.txt');
      }

      // Add AI config as JSON in sections
      const sections = [{
        selectedModels: config.selectedModels || ['gemini-2.5-pro'],
        useAverageGrading: config.useAverageGrading || false
      }];
      formData.append('sections', JSON.stringify(sections));

      console.log('📤 Sending assignment to backend API...');

      // Get auth token from Clerk
      const token = await window.Clerk?.session?.getToken();

      // POST to backend API
      const response = await api.post('/assignments', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      console.log('✅ Assignment created:', response.data);

      // Create local assignment object with backend ID
      const newAssignment = {
        id: response.data.assignment._id,
        config,
        sections: [],
        createdAt: Date.now(),
        backendId: response.data.assignment._id,
        processingStatus: response.data.assignment.processingStatus
      };

      setAssignments(prev => [...prev, newAssignment]);
      setActiveAssignmentId(newAssignment.id);
      setView(AppView.DASHBOARD);

    } catch (error) {
      console.error('❌ Error creating assignment:', error);
      alert(`Failed to create assignment: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleUpdateAssignment = (updatedAssignment) => {
    setAssignments(prev => prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a));
  };

  const handleSelectAssignment = (id) => {
    setActiveAssignmentId(id);
    setView(AppView.DASHBOARD);
  };

  const handleDeleteAssignment = async (id) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        // Get auth token from Clerk
        const token = await window.Clerk?.session?.getToken();

        // Call backend API to delete
        await api.delete(`/assignments/${id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        console.log('✅ Assignment deleted from backend:', id);

        // Remove from local state
        setAssignments(prev => prev.filter(a => a.id !== id));
      } catch (error) {
        console.error('❌ Error deleting assignment:', error);
        alert(`Failed to delete assignment: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  // Project handlers
  const handleCreateProject = async (config) => {
    try {
      // Create FormData for multipart upload
      const formData = new FormData();

      // Add basic fields
      formData.append('title', config.title);
      formData.append('description', config.description || '');
      formData.append('totalPoints', config.totalPoints || 100);
      formData.append('projectType', config.projectType);
      formData.append('programmingLanguage', config.programmingLanguage || '');

      // Helper to convert base64 to Blob
      const base64ToBlob = (base64Data, mimeType) => {
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
      };

      // Handle rubric file
      if (config.rubricFile) {
        const blob = base64ToBlob(config.rubricFile.data, config.rubricFile.mimeType);
        formData.append('rubric', blob, config.rubricFile.name);
      } else if (config.rubric) {
        const blob = new Blob([config.rubric], { type: 'text/plain' });
        formData.append('rubric', blob, 'rubric.txt');
      }

      console.log('📤 Sending project to backend API...');

      // Get auth token from Clerk
      const token = await window.Clerk?.session?.getToken();

      // POST to backend API
      const response = await api.post('/projects', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      console.log('✅ Project created:', response.data);

      // Create local project object with backend ID
      const newProject = {
        id: response.data.project._id,
        config,
        submissions: [],
        createdAt: Date.now(),
        backendId: response.data.project._id,
        processingStatus: response.data.project.processingStatus
      };

      setProjects(prev => [...prev, newProject]);
      setActiveProjectId(newProject.id);
      setView(AppView.PROJECT_DASHBOARD);

    } catch (error) {
      console.error('❌ Error creating project:', error);
      alert(`Failed to create project: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleUpdateProject = (updatedProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleSelectProject = (id) => {
    setActiveProjectId(id);
    setView(AppView.PROJECT_DASHBOARD);
  };

  const handleDeleteProject = (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleLogout = async () => {
    await signOut();
    setView(AppView.LANDING);
    setActiveAssignmentId(null);
    setActiveProjectId(null);
    setAssignments([]);
    setProjects([]);
  };

  const activeAssignment = assignments.find(a => a.id === activeAssignmentId);
  const activeProject = projects.find(p => p.id === activeProjectId);

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'User';
    if (user.firstName) return user.firstName;
    if (user.fullName) return user.fullName;
    if (user.primaryEmailAddress) return user.primaryEmailAddress.emailAddress.split('@')[0];
    return 'User';
  };

  // Show loading state while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-zinc-900 bg-white min-h-screen selection:bg-zinc-900 selection:text-white">
      {view === AppView.LANDING && (
        <Landing
          onStart={handleStart}
          onLogin={handleSignIn}
          onDocs={() => setView(AppView.DOCS)}
          onPrivacy={() => setView(AppView.PRIVACY)}
          onTerms={() => setView(AppView.TERMS)}
        />
      )}

      {view === AppView.SIGN_IN && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
          <div className="mb-8">
            <button
              onClick={() => setView(AppView.LANDING)}
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Back to home
            </button>
          </div>
          <SignIn
            routing="hash"
            signUpUrl="#sign-up"
            afterSignInUrl="#workspaces"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-xl border border-zinc-100 rounded-2xl',
                footerActionLink: 'text-zinc-900 hover:text-zinc-700 font-medium',
              }
            }}
          />
        </div>
      )}

      {view === AppView.SIGN_UP && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
          <div className="mb-8">
            <button
              onClick={() => setView(AppView.LANDING)}
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              &larr; Back to home
            </button>
          </div>
          <SignUp
            routing="hash"
            signInUrl="#sign-in"
            afterSignUpUrl="#workspaces"
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-xl border border-zinc-100 rounded-2xl',
                footerActionLink: 'text-zinc-900 hover:text-zinc-700 font-medium',
              }
            }}
          />
        </div>
      )}

      {view === AppView.PRICING && (
        <Pricing
          onSelectPlan={handlePlanSelect}
          onBack={() => setView(AppView.LANDING)}
        />
      )}

      {view === AppView.DOCS && (
        <Docs
          onBack={() => setView(AppView.LANDING)}
        />
      )}

      {view === AppView.PRIVACY && (
        <Privacy
          onBack={() => setView(AppView.LANDING)}
        />
      )}

      {view === AppView.TERMS && (
        <Terms
          onBack={() => setView(AppView.LANDING)}
        />
      )}

      {view === AppView.WORKSPACES && isSignedIn && (
        <Workspaces
          assignments={assignments}
          projects={projects}
          onCreateNew={() => setView(AppView.SETUP)}
          onCreateProject={() => setView(AppView.PROJECT_SETUP)}
          onSelect={handleSelectAssignment}
          onSelectProject={handleSelectProject}
          onDelete={handleDeleteAssignment}
          onDeleteProject={handleDeleteProject}
          onLogout={handleLogout}
          userName={getUserDisplayName()}
          userImageUrl={user?.imageUrl}
        />
      )}

      {view === AppView.SETUP && isSignedIn && (
        <SetupForm
          onComplete={handleCreateAssignment}
          onCancel={() => setView(AppView.WORKSPACES)}
        />
      )}

      {view === AppView.PROJECT_SETUP && isSignedIn && (
        <ProjectSetupForm
          onComplete={handleCreateProject}
          onCancel={() => setView(AppView.WORKSPACES)}
        />
      )}

      {view === AppView.DASHBOARD && activeAssignment && isSignedIn && (
        <Dashboard
          assignment={activeAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          onBack={() => setView(AppView.WORKSPACES)}
        />
      )}

      {view === AppView.PROJECT_DASHBOARD && activeProject && isSignedIn && (
        <Dashboard
          assignment={activeProject}
          onUpdateAssignment={handleUpdateProject}
          onBack={() => setView(AppView.WORKSPACES)}
          isProject={true}
        />
      )}
    </div>
  );
}

export default GradeMindApp;
