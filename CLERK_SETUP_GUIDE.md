# Clerk Authentication Setup Guide for EduGrade

## Overview

EduGrade now uses Clerk for authentication with Google OAuth support. This guide will help you complete the setup.

## Prerequisites

- A Clerk account (sign up at https://clerk.com)
- Google OAuth credentials configured in Clerk dashboard

---

## Step 1: Get Your Clerk Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application (or create a new one)
3. Navigate to **API Keys** section
4. Copy your **Publishable Key**

---

## Step 2: Configure Environment Variables

### Client (.env)

Update `/home/user/edugrade/client/.env` with your Clerk publishable key:

```env
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

**Note:** For React apps, use `REACT_APP_` prefix (not `NEXT_PUBLIC_`)

### Server (.env) - Optional

If you need to verify tokens on the backend, add to `/home/user/edugrade/server/.env`:

```env
CLERK_SECRET_KEY=sk_test_your_secret_key_here
```

---

## Step 3: Enable Google OAuth in Clerk

1. In Clerk Dashboard, go to **User & Authentication** → **Social Connections**
2. Enable **Google** OAuth provider
3. Configure your Google OAuth credentials:
   - If you don't have Google OAuth credentials:
     - Go to [Google Cloud Console](https://console.cloud.google.com)
     - Create a new project or select existing one
     - Enable Google+ API
     - Create OAuth 2.0 credentials
     - Add authorized redirect URIs from Clerk dashboard
   - Enter your Google Client ID and Client Secret in Clerk

4. **Important:** Add these authorized redirect URIs in your Google OAuth app:
   - Development: `https://[your-clerk-frontend-api].clerk.accounts.dev/v1/oauth_callback`
   - Production: Your production domain callback URL

---

## Step 4: Configure Clerk Application Settings

### Allow Sign-ups

1. Go to **User & Authentication** → **Email, Phone, Username**
2. Configure sign-up options:
   - Enable email addresses
   - Enable Google OAuth
   - Configure password requirements (optional)

### Redirect URLs

1. Go to **Paths** section
2. Set redirect URLs:
   - **Sign-in fallback redirect URL:** `/` or `/assignments`
   - **Sign-up fallback redirect URL:** `/` or `/assignments`
   - **Sign-out redirect URL:** `/`

---

## Step 5: Test Authentication Flow

1. **Start the application:**

```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
cd client
npm start
```

2. **Test the following:**
   - Visit http://localhost:3000
   - Click "Sign Up" button
   - Sign up using Google OAuth
   - Verify redirect to home page
   - Check that UserButton appears in header
   - Try creating an assignment (should work)
   - Sign out and verify redirect
   - Try accessing `/assignments` while signed out (should redirect to sign-in)

---

## What Has Been Implemented

### ✅ Frontend Changes

1. **ClerkProvider Setup** (`client/src/index.js`)
   - Wraps entire app with Clerk authentication

2. **Sign-In Page** (`client/src/pages/SignIn.js`)
   - Beautiful sign-in UI with Clerk component
   - Google OAuth integration
   - Link to sign-up page

3. **Sign-Up Page** (`client/src/pages/SignUp.js`)
   - Sign-up UI with Clerk component
   - Google OAuth integration
   - Link to sign-in page

4. **Protected Routes** (`client/src/components/ProtectedRoute.js`)
   - Wraps protected pages
   - Redirects to sign-in if not authenticated
   - Shows loading state while checking auth

5. **Updated Header** (`client/src/components/Header.js`)
   - Shows UserButton when authenticated (with avatar, sign-out)
   - Shows Sign-In/Sign-Up buttons when not authenticated
   - Conditionally shows "Create Assignment" and "Assignments" links

6. **Updated Home Page** (`client/src/pages/Home.js`)
   - Different CTAs for authenticated vs non-authenticated users
   - "Get Started" button for new users
   - "Create Assignment" button for authenticated users

7. **Updated Routes** (`client/src/App.js`)
   - All assignment and project routes are now protected
   - Public routes: Home, Sign-In, Sign-Up
   - Protected routes: Everything else

---

## Environment Variables Summary

### Required for Client

```env
# client/.env
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
REACT_APP_API_URL=http://localhost:5000
```

### Optional for Server (if implementing backend auth)

```env
# server/.env
CLERK_SECRET_KEY=sk_test_xxxxx
MONGO_URI=mongodb://localhost:27017/edugrade
GEMINI_API_KEY=your_gemini_api_key
PORT=5000
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User visits EduGrade                                     │
│    └─▶ Home page (public)                                   │
│                                                              │
│ 2. User clicks "Get Started" or "Sign Up"                  │
│    └─▶ Redirects to /sign-up                               │
│                                                              │
│ 3. User signs up with Google OAuth                         │
│    └─▶ Clerk handles authentication                        │
│    └─▶ Creates user session                                │
│    └─▶ Redirects to home page                              │
│                                                              │
│ 4. User navigates to protected route (/assignments)        │
│    └─▶ ProtectedRoute checks authentication                │
│    └─▶ If authenticated: Show content                      │
│    └─▶ If not: Redirect to /sign-in                        │
│                                                              │
│ 5. Authenticated user can:                                  │
│    ✓ View assignments                                       │
│    ✓ Create new assignments                                 │
│    ✓ Upload submissions                                     │
│    ✓ View results                                           │
│    ✓ Export to Excel                                        │
│                                                              │
│ 6. User signs out                                           │
│    └─▶ Clerk clears session                                │
│    └─▶ Redirects to home page                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: "Missing Clerk Publishable Key" Error

**Solution:**
- Ensure `.env` file exists in `client/` directory
- Verify `REACT_APP_CLERK_PUBLISHABLE_KEY` is set
- Restart development server after adding environment variables

### Issue: Google OAuth Not Working

**Solution:**
- Verify Google OAuth is enabled in Clerk dashboard
- Check authorized redirect URIs in Google Cloud Console
- Ensure Google credentials are correctly entered in Clerk

### Issue: Redirect Loop After Sign-In

**Solution:**
- Check redirect URLs in Clerk dashboard **Paths** section
- Ensure `/sign-in` and `/sign-up` routes are not protected
- Verify ClerkProvider is wrapping the entire app

### Issue: UserButton Not Appearing

**Solution:**
- Check browser console for errors
- Verify `@clerk/clerk-react` is installed (v4.30.0)
- Clear browser cache and reload

### Issue: Protected Routes Not Working

**Solution:**
- Verify ProtectedRoute component is imported correctly
- Check that routes are wrapped with `<ProtectedRoute>` component
- Ensure ClerkProvider is initialized before routing

---

## Next Steps

### Optional Backend Integration

If you want to verify user authentication on the backend:

1. Install Clerk SDK for Node.js:
```bash
cd server
npm install @clerk/clerk-sdk-node
```

2. Create middleware to verify Clerk tokens:
```javascript
// server/middleware/clerkAuth.js
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

module.exports = ClerkExpressRequireAuth();
```

3. Protect API routes:
```javascript
// server/routes/assignments.js
const clerkAuth = require('../middleware/clerkAuth');

router.post('/', clerkAuth, assignmentController.createAssignment);
```

### User-Specific Data

Currently, all users can see all assignments. To make data user-specific:

1. Update Assignment model to include `userId`:
```javascript
// server/models/assignment.js
userId: {
  type: String,
  required: true,
  index: true
}
```

2. Update controllers to filter by `userId`
3. Pass user ID from frontend using Clerk's `useUser()` hook

---

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use environment variables** for all sensitive data
3. **Keep Clerk secret key** on server-side only
4. **Enable MFA** in Clerk for additional security
5. **Configure session timeout** in Clerk dashboard
6. **Monitor authentication logs** in Clerk dashboard

---

## Support

- **Clerk Documentation:** https://clerk.com/docs
- **Clerk Support:** https://clerk.com/support
- **EduGrade Issues:** Check CLAUDE.md for troubleshooting

---

**Last Updated:** 2025-11-19
**Clerk Version:** @clerk/clerk-react v4.30.0
