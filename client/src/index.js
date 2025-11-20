import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';

// Get the publishable key from environment variables
const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn('Missing REACT_APP_CLERK_PUBLISHABLE_KEY - Auth will not work');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: '#18181b',
          colorText: '#18181b',
          colorBackground: '#ffffff',
          colorInputBackground: '#ffffff',
          colorInputText: '#18181b',
          borderRadius: '0.75rem',
        },
        elements: {
          formButtonPrimary: 'bg-zinc-900 hover:bg-zinc-800 text-white',
          card: 'shadow-xl border border-zinc-100',
          headerTitle: 'text-zinc-900 font-bold',
          headerSubtitle: 'text-zinc-500',
          socialButtonsBlockButton: 'border-zinc-200 hover:bg-zinc-50',
          formFieldInput: 'border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400',
          footerActionLink: 'text-zinc-900 hover:text-zinc-700',
        }
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
