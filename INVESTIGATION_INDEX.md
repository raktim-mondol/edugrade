# Investigation Index: Assignment Upload Flow

## Overview

This investigation identified why the assignment upload feature doesn't use the Gemini API or communicate with the backend.

**Root Cause**: The frontend stores assignments in localStorage only and never POSTs them to the backend API.

---

## Investigation Documents (Created 2025-11-21)

### 1. INVESTIGATION_QUICK_REFERENCE.md ⭐ START HERE
**Size**: ~2 KB | **Read Time**: 5 minutes

Quick 30-second summary of the problem, root cause, and files involved. Best for getting the gist of the issue quickly.

**Contains**:
- Problem in 30 seconds
- Root cause diagram
- Key files with line numbers
- What works vs what's broken
- Three fix options

---

### 2. INVESTIGATION_SUMMARY.md
**Size**: 8.5 KB | **Read Time**: 15 minutes

Executive summary with detailed evidence, impact analysis, and three possible solutions.

**Contains**:
- The problem statement
- Root cause in one sentence
- Five key pieces of evidence with code snippets
- What's broken vs what works
- Why this happened (two systems merged)
- Impact on users
- What would be needed to fix
- Verification checklist

---

### 3. FLOW_ANALYSIS.md
**Size**: 7.6 KB | **Read Time**: 20 minutes

Component-by-component breakdown of the entire system with status for each file and section.

**Contains**:
- Executive summary
- Complete flow diagrams (current vs intended)
- Root causes (5 main issues)
- Verification steps
- Summary table of all components
- Best practices

---

### 4. FLOW_COMPARISON.md
**Size**: 23 KB | **Read Time**: 30 minutes

Detailed side-by-side comparison of current (broken) flow vs intended (working) flow with ASCII diagrams.

**Contains**:
- ASCII flow diagrams for current state
- ASCII flow diagrams for intended state
- Component status matrix
- Data flow comparison
- API endpoints map
- Queue job flow diagram
- Summary table of architectural differences

---

## Problem Summary

### Current State
```
User uploads assignment
         ↓
SetupForm converts to base64
         ↓
GradeMindApp stores in localStorage
         ↓
❌ STOPS HERE
         ↓
Backend API never called
Queue jobs never created
Gemini API never invoked
```

### What's Needed
```
Frontend needs to POST assignments to /api/assignments
Backend already ready:
  ✅ Routes configured
  ✅ Controllers implemented
  ✅ Queue system ready
  ✅ Workers waiting
  ✅ Gemini service configured
```

---

## Key Evidence

### File: client/src/grademind/GradeMindApp.js (Line 47-53)
```javascript
// Saves ONLY to localStorage, never to backend
useEffect(() => {
  if (isSignedIn && user) {
    localStorage.setItem(storageKey, JSON.stringify(assignments));
  }
}, [assignments, isSignedIn, user]);
```

### File: client/src/grademind/SetupForm.js (Line 20-36)
```javascript
// Reads files as base64, never sends to server
const handleFileChange = async (field, e) => {
  const base64String = reader.result.split(',')[1];
  setConfig(prev => ({
    ...prev,
    [field]: {
      data: base64String,  // ← stored in memory only
      mimeType: file.type
    }
  }));
};
```

### Backend: server/server.js (Line 75-81)
```javascript
// Workers initialized but never receive jobs
require('./workers/assignmentProcessor');
require('./workers/rubricProcessor');
require('./workers/solutionProcessor');
// ... waiting idle for queue jobs
```

---

## Component Status

### Frontend
| Component | Status | Issue |
|-----------|--------|-------|
| SetupForm | ✅ | Collects files but converts to base64 |
| GradeMindApp | ❌ | Stores in localStorage, no API call |
| Dashboard | ✅ | Calls `/api/grademind/evaluate` only |
| API client | ❌ | Auth interceptor never set up |

### Backend
| Component | Status | Issue |
|-----------|--------|-------|
| Routes | ✅ | Registered but never called |
| Controller | ✅ | Queues jobs but never invoked |
| Queue | ✅ | Waiting for jobs that never arrive |
| Workers | ✅ | Idle, waiting for queue jobs |
| Gemini | ✅ | Configured but never called |

---

## Root Causes

1. **No Backend Upload Call** - Frontend stores in localStorage, never POSTs
2. **Wrong File Format** - Frontend uses base64, backend expects multipart/form-data
3. **Queue Never Triggered** - No jobs created because no backend call
4. **Worker Sits Idle** - Waits for jobs that never arrive
5. **Gemini API Unused** - processAssignmentPDF() never called

---

## Three Fix Options

### Option A: Connect Frontend to Backend ⭐ RECOMMENDED
- Modify GradeMindApp to POST assignments to `/api/assignments`
- Send files as multipart/form-data (not base64)
- Poll `/api/assignments/{id}/status` for readiness
- Backend already ready, no changes needed

### Option B: Replicate Backend in Frontend
- Call Gemini API directly from frontend
- Process files locally or via Gemini file upload
- Remove all backend API calls except grading
- Delete or disable backend workers

### Option C: Hybrid Approach
- Keep GradeMind frontend for simple cases
- Build separate "advanced" backend-connected UI
- Maintain both systems in parallel

---

## Next Steps

### To Understand the Issue Deeply
1. Read `INVESTIGATION_QUICK_REFERENCE.md` (5 min)
2. Read `INVESTIGATION_SUMMARY.md` (15 min)
3. Review code snippets in summary
4. Read `FLOW_ANALYSIS.md` for details (20 min)

### To See Visual Comparison
1. Open `FLOW_COMPARISON.md`
2. Study ASCII flow diagrams
3. Review component status matrix
4. Compare current vs intended data flow

### To Fix the Issue
1. Choose fix option (A, B, or C)
2. Implement based on chosen architecture
3. Test full pipeline end-to-end
4. Verify Gemini API is called

---

## Quick Stats

- **Files analyzed**: 15+ core files
- **Root causes identified**: 5 main issues
- **Backend components ready**: 100% (6/6)
- **Frontend implementation**: 0% for backend integration
- **Gemini API calls**: 0 for assignment processing, 1 for grading only

---

## Verification

You can verify the findings with these commands:

```bash
# No backend API calls for assignment upload
grep -r "axios.post.*assignment\|fetch.*POST.*assignment" /home/user/edugrade/client/src
# Result: NO MATCHES

# Only one backend POST call exists
grep -r "axios.post" /home/user/edugrade/client/src/grademind/Dashboard.js
# Result: ONE MATCH at line 145 (/api/grademind/evaluate)

# Backend routes exist but are never called
grep -n "router.post" /home/user/edugrade/server/routes/assignments.js
# Result: Routes exist (lines 63-70)

# Workers are initialized
grep -n "require.*processor" /home/user/edugrade/server/server.js
# Result: 7 workers initialized (lines 75-81)
```

---

## Files for Reference

Absolute paths on the system:

```
/home/user/edugrade/INVESTIGATION_QUICK_REFERENCE.md
/home/user/edugrade/INVESTIGATION_SUMMARY.md
/home/user/edugrade/INVESTIGATION_INDEX.md (this file)
/home/user/edugrade/FLOW_ANALYSIS.md
/home/user/edugrade/FLOW_COMPARISON.md
```

---

## Summary

The frontend and backend are two completely separate, never-integrated systems:

- **Frontend** (GradeMind): localStorage-based, Clerk auth, direct Gemini calls, NO backend integration
- **Backend** (EduGrade): API-based, MongoDB, queue + workers, complete Gemini pipeline

**To use Gemini API for assignment processing**: Frontend must start POSTing assignments to backend API. Backend is ready and waiting.

