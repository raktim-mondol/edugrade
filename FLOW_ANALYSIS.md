# Assignment Upload Flow Analysis Report

**Date**: 2025-11-21  
**Status**: COMPLETE DISCONNECT IDENTIFIED  
**Severity**: CRITICAL - No backend processing occurs for assignments

---

## Quick Summary

The application has **two completely separate systems**:

1. **Frontend (GradeMind)**: Stores everything in localStorage only
2. **Backend**: Has full API infrastructure, but is never called

**Result**: Gemini API is never invoked for assignment processing. Only the grading endpoint (`/api/grademind/evaluate`) works, which grades submissions directly without extracting assignment structure first.

---

## Key Findings

### BROKEN FLOW
```
SetupForm collects assignment files
         ↓
Files converted to base64
         ↓
Stored in localStorage
         ↓
❌ STOPS - No backend API call made
         ↓
Worker never triggered
         ↓
Gemini assignment processing never happens
```

### WHAT ACTUALLY WORKS
- Frontend can create assignments in localStorage
- Frontend can manually grade submissions via `/api/grademind/evaluate`
- That endpoint calls Gemini directly (without assignment context)

### WHAT'S BROKEN
- Assignment upload to backend
- Queue job creation
- Worker processing
- Gemini API invocation for assignment structure extraction
- Status polling
- Rubric/solution processing
- All structured grading features

---

## Root Cause Analysis

| Problem | Location | Details |
|---------|----------|---------|
| **No Backend Upload Call** | SetupForm.js + GradeMindApp.js | Frontend stores files in localStorage, never sends to backend |
| **Wrong File Format** | SetupForm.js | Files read as base64, backend expects multipart/form-data |
| **Queue Never Triggered** | GradeMindApp.js | No POST to /api/assignments, so no jobs created |
| **Worker Sits Idle** | assignmentProcessor.js | Worker waits for queue jobs that never arrive |
| **Gemini API Unused** | geminiService.js | processAssignmentPDF() never called |
| **Auth Interceptor Unused** | utils/api.js | setupAuthInterceptor() defined but never invoked |

---

## Flow Breakdown by Component

### Frontend Chain (BROKEN)
```
SetupForm (collects & encodes files to base64)
    ↓
handleFileChange (line 20-36: reads as base64)
    ↓
handleNext (line 63-65: calls onComplete)
    ↓
GradeMindApp.handleCreateAssignment (line 110-120: stores in memory)
    ↓
useEffect saves to localStorage (line 47-53: NO API CALL)
    ↓
❌ FLOW STOPS HERE
```

### Backend Chain (READY BUT UNUSED)
```
Backend initialized and waiting:
    ✅ Routes registered (server.js line 62-65)
    ✅ Workers started (server.js line 75-81)
    ✅ Queues ready (config/memoryQueue.js)
    ✅ Controllers implemented (assignmentController.js)
    ✅ Gemini service configured (geminiService.js)

But:
    ❌ POST /api/assignments NEVER CALLED
    ❌ createAssignment NEVER EXECUTED
    ❌ Queue.createJob NEVER INVOKED
    ❌ Worker process NEVER TRIGGERED
    ❌ Gemini API NEVER CONTACTED
```

---

## File-by-File Analysis

### FRONTEND

**`client/src/grademind/SetupForm.js`**
- ✅ Collects assignment details
- ❌ Reads files as base64 (line 26)
- ❌ Never uploads to backend
- Status: Partially works (local only)

**`client/src/grademind/GradeMindApp.js`**
- ✅ Manages assignment state
- ❌ Stores in localStorage only (line 51)
- ❌ No API call to POST assignments
- Status: Works for localStorage, not backend

**`client/src/grademind/Dashboard.js`**
- ✅ Calls `/api/grademind/evaluate` (line 145)
- ❌ Uses plain axios instead of authenticated api client
- Status: Works, but only for grading (not assignment upload)

**`client/src/utils/api.js`**
- ✅ Axios client configured with Clerk auth
- ❌ setupAuthInterceptor() never called
- Status: Configured but never used

### BACKEND

**`server/server.js`**
- ✅ Routes registered (line 62-65)
- ✅ Workers initialized (line 75-81)
- Status: Infrastructure ready

**`server/routes/assignments.js`**
- ✅ POST endpoint configured with multer (line 63-70)
- ❌ Never receives requests from frontend
- Status: Ready but never called

**`server/controllers/assignmentController.js`**
- ✅ Queue jobs created (line 109-153)
- ❌ Function never executed
- Status: Ready but never triggered

**`server/config/memoryQueue.js`**
- ✅ Queue system fully functional
- ❌ No jobs ever created
- Status: Working but empty

**`server/workers/assignmentProcessor.js`**
- ✅ Process handler registered (line 14)
- ❌ Waits for jobs that never arrive
- Status: Idle and waiting

**`server/utils/geminiService.js`**
- ✅ Gemini client initialized (line 26)
- ✅ Rate limiting implemented (line 51-62)
- ✅ Functions exported (line 2795-2818)
- ❌ processAssignmentPDF() never called
- Status: Ready but never invoked

---

## Why This Happened

This codebase appears to have **two development branches merged together**:

1. **Original system**: Backend-first architecture with queues, workers, and Gemini processing
2. **GradeMind rewrite**: Frontend-only localStorage approach with direct Gemini grading

The two were never properly integrated. The frontend was redesigned to use localStorage/Clerk auth, but the backend wasn't updated to match, and the frontend was never connected to the backend API.

---

## Evidence

### Proof Frontend Never Calls Backend for Assignment Upload

```bash
$ grep -r "POST.*assignment\|uploadAssignment\|createAssignment" /home/user/edugrade/client/src --include="*.js"
# Result: NO MATCHES
# (The only POST is to /api/grademind/evaluate in Dashboard.js)
```

### Proof Queue Never Gets Jobs

```bash
# Check logs when running:
# - assignmentProcessingQueue initialized
# - awaiting jobs...
# - [No jobs ever created or processed]
```

### Proof Backend API Is Never Called

- Frontend `GradeMindApp.js` never imports or uses any backend API module
- Only `Dashboard.js` makes a backend call, but it's to `/api/grademind/evaluate`
- SetupForm collects files but never sends them anywhere

---

## Impact

### What Doesn't Work
- Full assignment processing pipeline
- Gemini API extraction of assignment structure
- Rubric extraction from PDFs
- Solution processing
- Queue-based asynchronous processing
- Status polling for assignment readiness
- All features that depend on backend

### What Does Work (Partially)
- Creating assignments in localStorage
- Grading submissions with `/api/grademind/evaluate` (direct Gemini call)
- Basic evaluation flow (but without assignment structure awareness)

### User Experience
Users can:
- Create assignments in the UI
- Add student submissions
- Get grades back (via direct Gemini grading)

But they cannot:
- Use sophisticated grading rubrics
- Extract assignment structure for context-aware grading
- Get detailed feedback based on assignment requirements
- Use most documented features

---

## To Fix This Flow

You would need to:

1. **Option A: Connect frontend to backend**
   - Modify GradeMindApp to POST assignments to `/api/assignments`
   - Send files as multipart/form-data (not base64)
   - Poll `/api/assignments/{id}/status` for readiness
   - Keep backend system as-is (it's ready)

2. **Option B: Replicate backend logic in frontend**
   - Call Gemini API directly from frontend
   - Process files locally or via Gemini file upload
   - Remove backend API calls entirely
   - Disable backend workers

3. **Option C: Hybrid approach**
   - Keep GradeMind frontend for simple use cases
   - Provide a separate "advanced" backend-connected UI
   - Maintain both systems in parallel

---

## Detailed Files

For complete analysis including code snippets, see the sections below:

- Component-by-component analysis with line numbers
- Code flow diagrams
- Queue system status
- API endpoint mapping
- Worker process flow

