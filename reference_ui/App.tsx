
import React, { useState } from 'react';
import Landing from './components/Landing';
import SetupForm from './components/SetupForm';
import Dashboard from './components/Dashboard';
import Workspaces from './components/Workspaces';
import Pricing from './components/Pricing';
import Docs from './components/Docs';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import { AppView, Assignment, AssignmentConfig, Section } from './types';

function App() {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  const handleStart = () => {
    setView(AppView.PRICING);
  };

  const handleLogin = () => {
    // In a real app, checking auth token would happen here
    setView(AppView.WORKSPACES);
  };

  const handlePlanSelect = (plan: string) => {
    // In a real app, this would handle payment processing or user upgrading
    console.log(`Selected plan: ${plan}`);
    setView(AppView.WORKSPACES);
  };

  const handleCreateAssignment = (config: AssignmentConfig) => {
    const newAssignment: Assignment = {
      id: crypto.randomUUID(),
      config,
      sections: [],
      createdAt: Date.now()
    };
    setAssignments(prev => [...prev, newAssignment]);
    setActiveAssignmentId(newAssignment.id);
    setView(AppView.DASHBOARD);
  };

  const handleUpdateAssignment = (updatedAssignment: Assignment) => {
    setAssignments(prev => prev.map(a => a.id === updatedAssignment.id ? updatedAssignment : a));
  };

  const handleSelectAssignment = (id: string) => {
    setActiveAssignmentId(id);
    setView(AppView.DASHBOARD);
  };

  const handleDeleteAssignment = (id: string) => {
    if(confirm('Are you sure you want to delete this assignment?')) {
        setAssignments(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleLogout = () => {
      setView(AppView.LANDING);
      setActiveAssignmentId(null);
  }

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

export default App;
