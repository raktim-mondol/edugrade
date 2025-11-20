import React, { useState, useEffect } from 'react';
import Landing from './Landing';
import SetupForm from './SetupForm';
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
  DASHBOARD: 'DASHBOARD',
  DOCS: 'DOCS',
  PRIVACY: 'PRIVACY',
  TERMS: 'TERMS'
};

function GradeMindApp() {
  const [view, setView] = useState(AppView.LANDING);
  const [assignments, setAssignments] = useState([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);

  // Load assignments from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('grademind-assignments');
    if (saved) {
      try {
        setAssignments(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved assignments:', e);
      }
    }
  }, []);

  // Save assignments to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('grademind-assignments', JSON.stringify(assignments));
  }, [assignments]);

  const handleStart = () => {
    setView(AppView.PRICING);
  };

  const handleLogin = () => {
    setView(AppView.WORKSPACES);
  };

  const handlePlanSelect = (plan) => {
    console.log(`Selected plan: ${plan}`);
    setView(AppView.WORKSPACES);
  };

  const handleCreateAssignment = (config) => {
    const newAssignment = {
      id: crypto.randomUUID(),
      config,
      sections: [],
      createdAt: Date.now()
    };
    setAssignments(prev => [...prev, newAssignment]);
    setActiveAssignmentId(newAssignment.id);
    setView(AppView.DASHBOARD);
  };

  const handleUpdateAssignment = (updatedAssignment) => {
    setAssignments(prev => prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a));
  };

  const handleSelectAssignment = (id) => {
    setActiveAssignmentId(id);
    setView(AppView.DASHBOARD);
  };

  const handleDeleteAssignment = (id) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      setAssignments(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleLogout = () => {
    setView(AppView.LANDING);
    setActiveAssignmentId(null);
  };

  const activeAssignment = assignments.find(a => a.id === activeAssignmentId);

  return (
    <div className="font-sans antialiased text-zinc-900 bg-white min-h-screen selection:bg-zinc-900 selection:text-white">
      {view === AppView.LANDING && (
        <Landing
          onStart={handleStart}
          onLogin={handleLogin}
          onDocs={() => setView(AppView.DOCS)}
          onPrivacy={() => setView(AppView.PRIVACY)}
          onTerms={() => setView(AppView.TERMS)}
        />
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

      {view === AppView.WORKSPACES && (
        <Workspaces
          assignments={assignments}
          onCreateNew={() => setView(AppView.SETUP)}
          onSelect={handleSelectAssignment}
          onDelete={handleDeleteAssignment}
          onLogout={handleLogout}
        />
      )}

      {view === AppView.SETUP && (
        <SetupForm
          onComplete={handleCreateAssignment}
          onCancel={() => setView(AppView.WORKSPACES)}
        />
      )}

      {view === AppView.DASHBOARD && activeAssignment && (
        <Dashboard
          assignment={activeAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          onBack={() => setView(AppView.WORKSPACES)}
        />
      )}
    </div>
  );
}

export default GradeMindApp;
