# Side-by-Side Flow Comparison

## Current (Broken) vs Intended (Working) Flow

### CURRENT FLOW: What Actually Happens

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CREATES ASSIGNMENT IN FRONTEND                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  SetupForm.js                │
        │ (File collector)             │
        ├──────────────────────────────┤
        │ ✅ Accepts assignment title  │
        │ ✅ Accepts total score       │
        │ ✅ Accepts description       │
        │ ✅ Accepts file uploads      │
        │ ❌ Does NOT upload to server │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ handleFileChange()           │
        │ (line 20-36 of SetupForm)    │
        ├──────────────────────────────┤
        │ ✅ Reads files               │
        │ ✅ Converts to base64        │
        │ ❌ Stores ONLY in config obj │
        │ ❌ NO upload or send         │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ handleNext() -> onComplete() │
        │ (line 65 of SetupForm)       │
        ├──────────────────────────────┤
        │ Calls: handleCreateAssignment│
        │        (from GradeMindApp)   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ GradeMindApp.js              │
        │ handleCreateAssignment()     │
        │ (line 110-120)               │
        ├──────────────────────────────┤
        │ ✅ Creates assignment object │
        │ ✅ Adds to state array       │
        │ ❌ Does NOT call backend     │
        │ ❌ Does NOT create job       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ useEffect (line 47-53)       │
        │ (localStorage saver)         │
        ├──────────────────────────────┤
        │ ✅ Saves to localStorage     │
        │ ❌ No backend POST call      │
        │ ❌ No Gemini processing      │
        │ ❌ No queue job creation     │
        └──────────────┬───────────────┘
                       │
                       ▼
    ┌────────────────────────────────────┐
    │ ASSIGNMENT STORED IN BROWSER ONLY │
    │ ❌ BACKEND NEVER CONTACTED        │
    │ ❌ WORKERS STILL WAITING IDLE     │
    │ ❌ NO GEMINI API CALLED           │
    └────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────────┐
            │ USER GRADES SUBMISSIONS  │
            │ (Dashboard.js line 127)  │
            ├──────────────────────────┤
            │ Makes: axios.post(       │
            │  '/api/grademind/        │
            │   evaluate'              │
            │ )                        │
            └──────────────┬───────────┘
                           │
                           ▼
                ┌───────────────────────┐
                │ /api/grademind/      │
                │ evaluate endpoint     │
                ├───────────────────────┤
                │ ✅ Calls Gemini API  │
                │ ✅ Grades submission │
                │ ❌ WITHOUT rubric    │
                │ ❌ WITHOUT solution  │
                │ ❌ WITHOUT structure │
                └───────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ GRADES WORK │
                    │ (BARELY)    │
                    └─────────────┘

═══════════════════════════════════════════════════════════════════
MISSING: All assignment processing via queue/workers/Gemini API
═══════════════════════════════════════════════════════════════════
```

---

### INTENDED FLOW: What Should Happen

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CREATES ASSIGNMENT IN FRONTEND                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ SetupForm.js                 │
        ├──────────────────────────────┤
        │ ✅ Collects all data         │
        │ ✅ Files as multipart/form   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ GradeMindApp.js              │
        │ (Modified to use backend)    │
        ├──────────────────────────────┤
        │ ✅ Should POST to backend    │
        │ ✅ Send files + config       │
        │ ✅ Get assignment ID back    │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────┐
        │ POST /api/assignments               │
        │ (server/routes/assignments.js)      │
        ├──────────────────────────────────────┤
        │ Router configured with:             │
        │ - upload.fields()                   │
        │ - multer middleware                 │
        │ - createAssignment controller       │
        └──────────────┬──────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ assignmentController.js          │
        │ createAssignment() function      │
        │ (line 15-188)                    │
        ├──────────────────────────────────┤
        │ ✅ Validates files received     │
        │ ✅ Saves to database            │
        │ ✅ Creates job for assignment   │
        │ ✅ Creates job for rubric       │
        │ ✅ Creates job for solution     │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴─────────────────┐
        │                                │
        ▼                                ▼
┌────────────────────────┐     ┌────────────────────────┐
│ assignmentProcessing   │     │ rubricProcessing       │
│ Queue                  │     │ Queue                  │
├────────────────────────┤     ├────────────────────────┤
│ Job created            │     │ Job created            │
│ Waiting...             │     │ Waiting...             │
└────────────┬───────────┘     └────────────┬───────────┘
             │                              │
             ▼                              ▼
    ┌────────────────────────┐    ┌────────────────────────┐
    │ assignmentProcessor.js  │    │ rubricProcessor.js     │
    │ (line 14)              │    │ (similar structure)    │
    ├────────────────────────┤    ├────────────────────────┤
    │ Worker picks up job    │    │ Worker picks up job    │
    │ ✅ PROCESSES STARTS    │    │ ✅ PROCESSES STARTS    │
    └────────────┬───────────┘    └────────────┬───────────┘
                 │                              │
                 ▼                              ▼
    ┌────────────────────────────┐   ┌────────────────────────────┐
    │ processAssignmentPDF()     │   │ processRubricPDF()         │
    │ (geminiService.js)         │   │ (geminiService.js)         │
    │                            │   │                            │
    │ Calls Gemini API with PDF  │   │ Calls Gemini API with PDF  │
    │ ✅ GEMINI CALLED           │   │ ✅ GEMINI CALLED           │
    │ ✅ Extracts structure      │   │ ✅ Extracts rubric         │
    │ ✅ Saves to database       │   │ ✅ Saves to database       │
    └────────────┬───────────────┘   └────────────┬───────────────┘
                 │                                 │
                 ▼                                 ▼
    ┌────────────────────────────────────────────────────────────┐
    │ Assignment now has:                                        │
    │ ✅ Extracted structure (from PDF)                         │
    │ ✅ Extracted rubric criteria                              │
    │ ✅ Extracted solution                                     │
    │ ✅ Processing status = 'completed'                        │
    │ ✅ evaluationReadyStatus = 'ready'                        │
    └────────────┬───────────────────────────────────────────────┘
                 │
    ┌────────────┴───────────────────────┐
    │                                    │
    ▼                                    ▼
┌────────────────────────┐     ┌────────────────────────┐
│ Frontend polls status  │     │ Assignment ready for   │
│ (AssignmentProcessing  │     │ evaluation             │
│ Page)                  │     │                        │
│                        │     │ UI shows green         │
│ Polls every 30 sec:    │     │ checkmark: READY       │
│ GET /api/assignments   │     └────────────────────────┘
│ /{id}/status           │
└────────────────────────┘
             │
             ▼
    ┌─────────────────────┐
    │ USER GRADES         │
    │ SUBMISSIONS         │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │ evaluationProcessor         │
    │ (workers/evaluationProc.js) │
    ├─────────────────────────────┤
    │ Uses:                       │
    │ ✅ Assignment structure     │
    │ ✅ Rubric criteria          │
    │ ✅ Solution for reference   │
    │ ✅ Student submission       │
    │                             │
    │ Calls Gemini with CONTEXT   │
    │ ✅ ACCURATE GRADING         │
    │ ✅ RELEVANT FEEDBACK        │
    └─────────────────────────────┘
             │
             ▼
    ┌─────────────────────────┐
    │ ✅ HIGH QUALITY GRADES  │
    │ ✅ DETAILED FEEDBACK    │
    │ ✅ STRUCTURE-AWARE      │
    └─────────────────────────┘
```

---

## Component Status Matrix

```
┌───────────────────────────────┬──────────┬───────────┬──────────────┐
│ Component                     │ CURRENT  │ INTENDED  │ Current Use  │
├───────────────────────────────┼──────────┼───────────┼──────────────┤
│ Frontend SetupForm            │ ✅       │ ✅        │ Collects     │
│ Frontend localStorage storage │ ✅       │ Removed   │ Backup only  │
│ Frontend -> Backend API       │ ❌       │ ✅        │ MISSING      │
│                               │          │           │              │
│ Backend /api/assignments      │ ❌       │ ✅        │ UNUSED       │
│ assignmentController          │ ❌       │ ✅        │ UNUSED       │
│ assignmentProcessingQueue     │ ❌       │ ✅        │ EMPTY        │
│ assignmentProcessor worker    │ ❌       │ ✅        │ IDLE         │
│ Gemini (assignment extract)   │ ❌       │ ✅        │ NEVER CALLED │
│                               │          │           │              │
│ rubricProcessingQueue         │ ❌       │ ✅        │ EMPTY        │
│ rubricProcessor worker        │ ❌       │ ✅        │ IDLE         │
│ Gemini (rubric extract)       │ ❌       │ ✅        │ NEVER CALLED │
│                               │          │           │              │
│ solutionProcessingQueue       │ ❌       │ ✅        │ EMPTY        │
│ solutionProcessor worker      │ ❌       │ ✅        │ IDLE         │
│ Gemini (solution extract)     │ ❌       │ ✅        │ NEVER CALLED │
│                               │          │           │              │
│ evaluationQueue               │ ❌       │ ✅        │ EMPTY        │
│ evaluationProcessor worker    │ ❌       │ ✅        │ IDLE         │
│ Gemini (smart grading)        │ ❌       │ ✅        │ NEVER CALLED │
│                               │          │           │              │
│ /api/grademind/evaluate       │ ✅       │ ✅        │ Direct grade │
│ Gemini (basic grading)        │ ✅       │ ✅        │ Works OK     │
│                               │          │           │              │
│ Frontend Status Polling       │ ❌       │ ✅        │ NOT NEEDED   │
└───────────────────────────────┴──────────┴───────────┴──────────────┘
```

---

## Data Flow Comparison

### CURRENT DATA FLOW
```
User Input (Title, Files)
    ↓
JavaScript in Browser
    ↓
localStorage
    ↓
React Component State
    ↓
Dead End (No Backend)
```

### INTENDED DATA FLOW
```
User Input (Title, Files)
    ↓
JavaScript in Browser
    ↓
HTTP POST to Backend
    ↓
MongoDB Database
    ↓
Queue System
    ↓
Worker Processes
    ↓
Gemini API Calls
    ↓
Results back to Database
    ↓
Frontend polls for status
    ↓
Shows "Ready for Evaluation"
```

---

## API Endpoints Map

### BACKEND ENDPOINTS (All Ready But Mostly Unused)

```
POST   /api/assignments              ❌ Frontend never calls
GET    /api/assignments              ❌ Frontend never calls
GET    /api/assignments/:id          ❌ Frontend never calls
GET    /api/assignments/:id/status   ❌ Frontend never calls
PUT    /api/assignments/:id          ❌ Frontend never calls
DELETE /api/assignments/:id          ❌ Frontend never calls

POST   /api/submissions/single       ❌ Frontend never calls
GET    /api/submissions/:assignmentId ❌ Frontend never calls
GET    /api/submissions/:assignmentId/export ❌ Frontend never calls

POST   /api/grademind/evaluate       ✅ ONLY endpoint frontend calls
```

### FRONTEND API CALLS

```
Dashboard.js line 145:
axios.post('/api/grademind/evaluate', {
  config: assignment.config,
  studentContent: studentsToGrade[i].content
})

This is the ONLY backend communication that happens.
```

---

## Queue Job Flow (Should Happen But Doesn't)

```
                                  CURRENT
                           ┌─────────────────┐
                           │ Job created in: │
                           │ ❌ Never        │
                           └─────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────────┐  ┌──────────────┐  ┌──────────────┐
            │ Assignment    │  │ Rubric       │  │ Solution     │
            │ Processing    │  │ Processing   │  │ Processing   │
            │ Queue         │  │ Queue        │  │ Queue        │
            ├───────────────┤  ├──────────────┤  ├──────────────┤
            │ ❌ EMPTY      │  │ ❌ EMPTY     │  │ ❌ EMPTY     │
            │ Waiting...    │  │ Waiting...   │  │ Waiting...   │
            │ (Forever)     │  │ (Forever)    │  │ (Forever)    │
            └─────────────┬─┘  └────────┬─────┘  └────────┬─────┘
                          │             │                 │
                          └─────────────┴─────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ Workers waiting: │
                              │ - assignmentProc │
                              │ - rubricProc     │
                              │ - solutionProc   │
                              │                  │
                              │ ❌ NEVER START   │
                              │                  │
                              │ Gemini API:      │
                              │ ❌ NOT CALLED    │
                              └──────────────────┘
```

---

## Summary: The Disconnect

| Aspect | Frontend | Backend |
|--------|----------|---------|
| **Architecture** | localStorage-based | API + Queue-based |
| **File handling** | base64 in memory | multipart files on disk |
| **Async processing** | None | Queue + Workers |
| **Gemini integration** | Direct call for grading | Called by workers |
| **Status tracking** | N/A | Detailed status fields |
| **Database** | N/A | MongoDB |
| **Authentication** | Clerk JWT | Clerk JWT (configured) |

These are **two completely different systems** never integrated together.

