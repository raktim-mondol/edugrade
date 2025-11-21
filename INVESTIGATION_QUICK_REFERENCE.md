# Quick Reference: Upload Flow Investigation

## The Problem in 30 Seconds

Frontend stores assignments in **localStorage only**. Backend API is never called. Gemini API is never invoked.

## Root Cause

```
SetupForm → HandleCreateAssignment → localStorage → STOPS
                                                      ❌ No backend call
                                                      ❌ No queue job
                                                      ❌ No Gemini
```

## Key Files

### Frontend (Problem Here)
- `client/src/grademind/SetupForm.js` - Reads files as base64 (line 20-36)
- `client/src/grademind/GradeMindApp.js` - Stores in localStorage only (line 47-53)
- Missing: `axios.post('/api/assignments', formData)` call

### Backend (Ready but Unused)
- `server/server.js` - Workers initialized (line 75-81)
- `server/routes/assignments.js` - Endpoints ready (line 63-70)
- `server/controllers/assignmentController.js` - Queue jobs ready (line 109-153)
- `server/workers/assignmentProcessor.js` - Waiting for jobs (line 14)
- `server/utils/geminiService.js` - Gemini ready (line 26-41)

## The Disconnect

```
Frontend                        Backend
└─ localStorage ─┐              ┌─ API Routes
                 │              │
             ❌ MISSING LINK ❌  │
                 │              │
                 └── x────────x──┘
                      never calls
```

## What Works

✅ Create assignments in UI
✅ Call `/api/grademind/evaluate` for grading
✅ Basic Gemini grading (without context)

## What's Broken

❌ POST /api/assignments
❌ Assignment processing queue
❌ Gemini API for extraction
❌ Queue workers
❌ Status polling
❌ Rubric extraction
❌ Solution extraction

## Files to Read for Full Details

1. **INVESTIGATION_SUMMARY.md** (8.5 KB) - Executive summary with evidence
2. **FLOW_ANALYSIS.md** (7.6 KB) - Component-by-component breakdown  
3. **FLOW_COMPARISON.md** (23 KB) - Side-by-side current vs intended

## To Fix (Pick One)

### Option A: Connect Frontend to Backend
Add to `GradeMindApp.handleCreateAssignment()`:
```javascript
const formData = new FormData();
formData.append('assignment', assignmentFile);
formData.append('rubric', rubricFile);
formData.append('solution', solutionFile);
const res = await axios.post('/api/assignments', formData);
```

### Option B: Replicate Backend in Frontend
Call Gemini directly from frontend (no backend needed)

### Option C: Hybrid
Keep both, integrate them

## Verification Commands

```bash
# Confirm no backend calls in frontend
grep -r "POST.*assignment" /home/user/edugrade/client/src

# Confirm only this endpoint called
grep -r "axios.post\|fetch.*POST" /home/user/edugrade/client/src

# Confirm backend routes exist
grep -n "router.post\|router.get" /home/user/edugrade/server/routes/assignments.js

# Confirm workers initialized
grep -n "require.*processor" /home/user/edugrade/server/server.js
```

## Summary

The project has **two completely separate systems** that were never integrated:
- **Frontend**: localStorage-based, Clerk auth, direct Gemini calls
- **Backend**: API-based, MongoDB, queue + workers, structured Gemini processing

Frontend never calls backend for assignment creation.

