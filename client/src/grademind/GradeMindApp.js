import React, { useState, useEffect } from 'react';
import { useAuth, useUser, SignIn, SignUp } from '@clerk/clerk-react';
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
  TERMS: 'TERMS',
  SIGN_IN: 'SIGN_IN',
  SIGN_UP: 'SIGN_UP'
};

function GradeMindApp() {
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const [view, setView] = useState(AppView.LANDING);
  const [assignments, setAssignments] = useState([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState(null);

  // Load assignments from localStorage on mount (keyed by user ID for data isolation)
  useEffect(() => {
    if (isSignedIn && user) {
      const storageKey = `grademind-assignments-${user.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setAssignments(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load saved assignments:', e);
        }
      }
    }
  }, [isSignedIn, user]);

  // Save assignments to localStorage whenever they change (keyed by user ID)
  useEffect(() => {
    if (isSignedIn && user) {
      const storageKey = `grademind-assignments-${user.id}`;
      localStorage.setItem(storageKey, JSON.stringify(assignments));
    }
  }, [assignments, isSignedIn, user]);

  // Redirect to workspaces when user signs in
  useEffect(() => {
    if (isLoaded && isSignedIn && (view === AppView.SIGN_IN || view === AppView.SIGN_UP || view === AppView.LANDING)) {
      setView(AppView.WORKSPACES);
    }
  }, [isLoaded, isSignedIn, view]);

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

  const handleLogout = async () => {
    await signOut();
    setView(AppView.LANDING);
    setActiveAssignmentId(null);
    setAssignments([]);
  };

  const activeAssignment = assignments.find(a => a.id === activeAssignmentId);

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
              }
            }}
          />
          <div className="mt-4 text-sm text-zinc-500">
            Don't have an account?{' '}
            <button
              onClick={() => setView(AppView.SIGN_UP)}
              className="text-zinc-900 font-medium hover:underline"
            >
              Sign up
            </button>
          </div>
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
              }
            }}
          />
          <div className="mt-4 text-sm text-zinc-500">
            Already have an account?{' '}
            <button
              onClick={() => setView(AppView.SIGN_IN)}
              className="text-zinc-900 font-medium hover:underline"
            >
              Sign in
            </button>
          </div>
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
          onCreateNew={() => setView(AppView.SETUP)}
          onSelect={handleSelectAssignment}
          onDelete={handleDeleteAssignment}
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

      {view === AppView.DASHBOARD && activeAssignment && isSignedIn && (
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
