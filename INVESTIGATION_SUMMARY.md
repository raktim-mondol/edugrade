# Investigation Summary: Why Assignment Upload Doesn't Use Gemini API

**Investigation Date**: 2025-11-21  
**Project**: EduGrade  
**Status**: ROOT CAUSE IDENTIFIED

---

## THE PROBLEM

When a user uploads an assignment in the frontend, **the backend is never contacted**. Therefore:
- Queue jobs are never created
- Workers are never triggered  
- Gemini API is never called
- Assignment structure is never extracted

---

## ROOT CAUSE IN ONE SENTENCE

**The frontend stores assignments in localStorage only and never POSTs them to the backend API.**

---

## DETAILED ROOT CAUSE

### Frontend Architecture (What Happens)
```
SetupForm collects files → base64 encoding → localStorage save → STOPS
```

### Backend Architecture (What's Waiting)
```
POST /api/assignments → Controller queues jobs → Workers invoke Gemini → Status updated
```

**THE DISCONNECT**: These two systems are completely separate. The frontend never calls the backend for assignment creation.

---

## KEY EVIDENCE

### 1. No Backend API Call in Frontend

**File**: `client/src/grademind/GradeMindApp.js` (Lines 110-120)

```javascript
const handleCreateAssignment = (config) => {
  const newAssignment = {
    id: crypto.randomUUID(),
    config,
    sections: [],
    createdAt: Date.now()
  };
  setAssignments(prev => [...prev, newAssignment]);  // ← Adds to local array
  setActiveAssignmentId(newAssignment.id);
  setView(AppView.DASHBOARD);
};
```

**Missing**: No `axios.post('/api/assignments', ...)`

### 2. Files Stored as Base64 in Memory

**File**: `client/src/grademind/SetupForm.js` (Lines 20-36)

```javascript
const handleFileChange = async (field, e) => {
  const file = e.target.files?.[0];
  const reader = new FileReader();
  reader.onloadend = () => {
    const base64String = reader.result.split(',')[1];
    setConfig(prev => ({
      ...prev,
      [field]: {
        mimeType: file.type,
        data: base64String,      // ← ONLY STORED IN MEMORY
        name: file.name
      }
    }));
  };
};
```

**Problem**: Files never sent to backend; they remain as base64 strings in the `config` object

### 3. Only localStorage Save (No Network Call)

**File**: `client/src/grademind/GradeMindApp.js` (Lines 47-53)

```javascript
useEffect(() => {
  if (isSignedIn && user) {
    const storageKey = `grademind-assignments-${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(assignments));  // ← LOCAL ONLY
  }
}, [assignments, isSignedIn, user]);
```

**Problem**: Saves to browser's localStorage; never sends to server

### 4. Backend Completely Unused for Assignment Upload

**Files**:
- `server/routes/assignments.js` - Routes registered but never called
- `server/controllers/assignmentController.js` - Controller ready but never invoked
- `server/workers/assignmentProcessor.js` - Worker waiting for jobs that never arrive
- `server/utils/geminiService.js` - processAssignmentPDF() never called

**Evidence**: Queue jobs are never created, so workers never run, so Gemini is never invoked

### 5. Only One Backend Endpoint Called

**File**: `client/src/grademind/Dashboard.js` (Line 145)

```javascript
const response = await axios.post('/api/grademind/evaluate', {
  config: assignment.config,
  studentContent: studentsToGrade[i].content
});
```

**This is the ONLY backend call** and it's for grading submissions, not uploading assignments.

---

## WHAT'S BROKEN vs WHAT WORKS

### ❌ Broken (Never Called)
- `POST /api/assignments` - Create assignment
- `GET /api/assignments/:id/status` - Check processing status
- `assignmentProcessingQueue` - Queue system
- `assignmentProcessor` worker - PDF processing
- `Gemini API` for assignment extraction
- Assignment structure extraction
- Rubric extraction from PDFs
- Solution extraction from PDFs
- Status polling

### ✅ Works (But Limited)
- Frontend creates assignments in localStorage
- Frontend calls `/api/grademind/evaluate` for grading
- Gemini API is called for submission grading (but without context)
- Basic evaluation flow works

---

## THE TWO SEPARATE SYSTEMS

### System 1: Frontend (GradeMind App)
- Uses **localStorage** for persistence
- Uses **Clerk** for authentication
- **Direct Gemini calls** for grading
- No backend dependency

### System 2: Backend (Original EduGrade)
- Uses **MongoDB** for persistence
- Expects **multipart file uploads**
- Uses **Queue + Workers** for async processing
- **Full Gemini integration** for structured grading

**These two systems were never integrated together.**

---

## HOW THIS HAPPENED

The codebase appears to have two development branches that were merged without proper integration:

1. **Original backend** (EduGrade system):
   - Designed for full assignment processing pipeline
   - Uses queue/workers/Gemini for extraction
   - Expected multipart file uploads

2. **New frontend** (GradeMind app):
   - Redesigned for simplicity and localStorage
   - Direct Gemini calls for grading
   - Clerk authentication
   - No backend integration

**Result**: Both systems coexist in the repo, but the frontend never calls the backend API for assignment creation. The backend sits idle, waiting for queue jobs that never arrive.

---

## WHAT WOULD BE NEEDED TO FIX

### Option 1: Connect Frontend to Backend (Recommended)

```javascript
// In GradeMindApp.handleCreateAssignment, add:
const formData = new FormData();
formData.append('title', config.title);
formData.append('description', config.description);
formData.append('totalPoints', config.totalScore);
// Convert base64 back to File object
formData.append('assignment', base64ToFile(config.assignment.data));
if (config.rubric?.data) formData.append('rubric', base64ToFile(config.rubric.data));
if (config.solution?.data) formData.append('solution', base64ToFile(config.solution.data));

// Then POST to backend
const response = await axios.post('/api/assignments', formData);
const assignmentId = response.data.assignment._id;

// Store assignment ID instead of full object
setAssignments(prev => [...prev, { id: assignmentId, config }]);
```

### Option 2: Replicate Backend Logic in Frontend

Remove all backend calls and implement Gemini processing in frontend directly.

### Option 3: Hybrid Approach

Keep both systems but make them aware of each other.

---

## FILES AFFECTED

### Frontend (Needs Changes)
- `client/src/grademind/GradeMindApp.js` - Add API POST call
- `client/src/grademind/SetupForm.js` - Send files as multipart, not base64
- `client/src/grademind/Dashboard.js` - Check assignment status before grading
- `client/src/utils/api.js` - Setup auth interceptor

### Backend (Already Ready, No Changes Needed)
- `server/server.js` - ✅ Routes initialized, workers running
- `server/routes/assignments.js` - ✅ POST endpoint ready
- `server/controllers/assignmentController.js` - ✅ Controller ready
- `server/config/memoryQueue.js` - ✅ Queue system ready
- `server/workers/assignmentProcessor.js` - ✅ Worker ready
- `server/utils/geminiService.js` - ✅ Gemini integration ready

---

## VERIFICATION CHECKLIST

- ✅ Frontend never calls POST /api/assignments
- ✅ Backend routes are registered but never called
- ✅ Queue workers are initialized but never triggered
- ✅ Gemini API is configured but processAssignmentPDF() never invoked
- ✅ Assignment status fields never updated by workers
- ✅ Only /api/grademind/evaluate is called from frontend
- ✅ Files stored as base64 in localStorage, not on disk
- ✅ No queue jobs ever created for assignment processing

---

## IMPACT

### Current User Experience
- Can create assignments in UI
- Can add student submissions
- Get grades via direct Gemini call (limited)
- No structured grading with rubrics
- No assignment context for feedback

### What's Missing
- Sophisticated rubric-based grading
- Assignment structure extraction
- Detailed feedback tied to requirements
- Most documented advanced features

---

## CONCLUSION

The frontend and backend are two completely separate systems. The frontend was redesigned to use localStorage and never updated to call the backend API for assignment creation. The backend remains fully functional and waiting for queue jobs that never arrive.

To enable Gemini API integration for assignment processing:
1. Modify frontend to POST assignments to `/api/assignments`
2. OR replicate backend logic in frontend
3. OR build a new integration layer

The backend infrastructure is ready; it just needs the frontend to start sending data to it.

---

## RELATED DOCUMENTATION

- `FLOW_ANALYSIS.md` - Detailed component-by-component breakdown
- `FLOW_COMPARISON.md` - Side-by-side comparison of current vs intended flow

