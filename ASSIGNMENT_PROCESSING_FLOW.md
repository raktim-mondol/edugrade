# EduGrade Assignment Processing Flow - Complete Analysis

## Overview
The assignment creation and processing flow in EduGrade is entirely **asynchronous** and **queue-based**. When an instructor creates an assignment with PDFs, jobs are immediately queued for processing without blocking the API response.

---

## Quick Summary: How Many Gemini API Calls?

```
Assignment Only              → 1-2 calls (1 for assignment + 1 for auto-extracted rubric)
Assignment + Rubric          → 2 calls   (1 for assignment + 1 for rubric PDF)
Assignment + Solution        → 2-3 calls (1 for assignment + 1 for auto-rubric + 1 for solution)
All Three Files              → 3 calls   (1 each for assignment, rubric, solution)
With Orchestration           → +1 call   (validation of consistency)
```

---

## Part 1: ASSIGNMENT CREATION

### Entry Point
**File**: `/home/user/edugrade/server/routes/assignments.js`
**Endpoint**: `POST /api/assignments`
**Controller**: `/home/user/edugrade/server/controllers/assignmentController.js` → `createAssignment()`

### Upload Process
1. **Multer Middleware** handles file uploads:
   - Assignment PDF → `/uploads/assignments/`
   - Rubric PDF → `/uploads/rubrics/` (optional)
   - Solution PDF → `/uploads/solutions/` (optional)

2. **Request Validation**:
   - Assignment file is **required**
   - Rubric and solution are **optional**
   - Metadata parsed: title, description, dueDate, course, totalPoints, questionStructure

3. **Database Record Creation**:
   - New Assignment document created with initial status values
   - Stored in MongoDB (schema: `/home/user/edugrade/server/models/assignment.js`)

### Status Fields at Creation
```
processingStatus: 'pending'           - Assignment PDF processing
rubricProcessingStatus: 'pending'     - Rubric processing (or 'pending' if no file)
solutionProcessingStatus: 'pending'   - Solution processing (or 'not_applicable' if no file)
evaluationReadyStatus: 'not_ready'    - Will be updated as processing completes
orchestrationStatus: 'not_needed'     - Must be manually triggered via API
```

### Queue Jobs Created
Upon creation, up to **3 jobs are queued immediately** (based on provided files):

1. **assignmentProcessingQueue** - Always created
2. **rubricProcessingQueue** - Created only if rubric file provided
3. **solutionProcessingQueue** - Created only if solution file provided

**Implementation**: `/home/user/edugrade/server/config/memoryQueue.js`
- Uses in-memory queue (no Redis required)
- Processes jobs sequentially (FIFO)
- Jobs processed with ~10ms delay between jobs

---

## Part 2: GEMINI API CALL #1 - ASSIGNMENT PDF PROCESSING

### Worker
**File**: `/home/user/edugrade/server/workers/assignmentProcessor.js`
**Queue Handler**: Processes `assignmentProcessingQueue` jobs

### Processing Method (Three Tiers)
The system attempts processing in this order:
1. **Text File Processing** (.txt, .text) - Direct text read
2. **Two-Stage Processing** (Landing AI + Gemini) - If Landing AI is configured
3. **Direct PDF Processing** (Fallback) - Direct Gemini API call (most common)

### Gemini API Call for Assignment
**Function**: `processAssignmentPDF()` in `/home/user/edugrade/server/utils/geminiService.js` (line 1536)

**Inputs to Gemini**:
- PDF file (Base64 encoded)
- Prompt asking for:
  1. Assignment title
  2. Assignment description
  3. Questions array (number, text, requirements, constraints, expected_output)
  4. has_marking_criteria (boolean)
  5. total_points (number)

**Gemini Response**:
```json
{
  "title": "String",
  "description": "String",
  "questions": [
    {
      "number": "1",
      "question": "Question text",
      "requirements": ["Requirement 1", "Requirement 2"],
      "constraints": ["Constraint 1"],
      "expected_output": "What should be delivered"
    }
  ],
  "has_marking_criteria": boolean,
  "total_points": number
}
```

**Stored In Database**:
```
assignment.processedData = <parsed JSON response>
assignment.processingStatus = 'completed'
assignment.processingCompletedAt = <timestamp>
```

### Automatic Rubric Extraction (If No Separate Rubric Provided)
**Condition**: `!assignment.rubricFile` (no separate rubric file uploaded)

**Function**: `extractRubricFromAssignmentPDF()` in geminiService.js (line 1373)

**Gemini API Call #2** (within same job):
- **Input**: Same assignment PDF
- **Prompt**: "Extract grading criteria from this assignment document"
- **Output**: 
```json
{
  "grading_criteria": [
    {
      "question_number": "1",
      "criterionName": "Criterion name",
      "weight": 10,
      "description": "What to look for",
      "marking_scale": "How to grade"
    }
  ],
  "total_points": 100,
  "extraction_notes": "Notes about extraction"
}
```

**Stored In Database**:
```
assignment.processedRubric = <parsed response>
assignment.rubricProcessingStatus = 'completed'
assignment.rubricExtractionSource = 'assignment_pdf'
```

---

## Part 3: GEMINI API CALL #2 or #3 - RUBRIC PROCESSING

### Worker
**File**: `/home/user/edugrade/server/workers/rubricProcessor.js`
**Queue Handler**: Processes `rubricProcessingQueue` jobs
**Only runs if** separate rubric file was provided

### Gemini API Call
**Function**: `processRubricPDF()` in geminiService.js (line 1716)

**Inputs**:
- Rubric PDF file (Base64 encoded)
- totalPoints (to normalize criteria weights)
- Prompt asking for grading criteria extraction

**Gemini Response**:
```json
{
  "grading_criteria": [
    {
      "question_number": "1",
      "criterionName": "Criterion name",
      "weight": 10,
      "description": "Description of what to evaluate",
      "marking_scale": "Rubric scale details"
    }
  ],
  "extracted_total_points": 100,
  "total_points": 100
}
```

**Stored In Database**:
```
assignment.processedRubric = <parsed response>
assignment.rubricProcessingStatus = 'completed'
assignment.rubricExtractionSource = 'separate_file'
```

---

## Part 4: GEMINI API CALL #3 or #4 - SOLUTION PROCESSING

### Worker
**File**: `/home/user/edugrade/server/workers/solutionProcessor.js`
**Queue Handler**: Processes `solutionProcessingQueue` jobs
**Only runs if** solution file was provided

### Gemini API Call
**Function**: `processSolutionPDF()` in geminiService.js (line 1998)

**Inputs**:
- Solution PDF file (Base64 encoded)
- Prompt asking for solution extraction

**Gemini Response**:
```json
{
  "questions": [
    {
      "questionNumber": "1",
      "questionSummary": "Brief description",
      "solution": "Complete model solution",
      "expectedOutput": "Expected results",
      "keySteps": ["Step 1", "Step 2"],
      "dependencies": ["Library 1", "Library 2"]
    }
  ]
}
```

**Stored In Database**:
```
assignment.processedSolution = <parsed response>
assignment.solutionProcessingStatus = 'completed'
assignment.solutionProcessingCompletedAt = <timestamp>
```

---

## Part 5: EVALUATION READINESS CHECK

### Function
**File**: `/home/user/edugrade/server/utils/assignmentUtils.js`
**Function**: `updateAssignmentEvaluationReadiness()`

Called after each processor completes (assignment, rubric, solution)

### Logic
Determines `evaluationReadyStatus`:

```
NOT_READY:
  - If assignment processing failed
  
PARTIAL:
  - Assignment processed successfully
  - Optional rubric/solution may be missing or still processing
  
READY:
  - Assignment processed
  - If rubric file was provided: must be completed or extracted from assignment
  - If solution file was provided: must be completed
```

**Status Values**:
- `not_ready`: Cannot evaluate
- `partial`: Can evaluate with assignment only (rubric will be derived)
- `ready`: Fully prepared with all available components

---

## Part 6: ORCHESTRATION (OPTIONAL - MANUAL ONLY)

### Status
**DISABLED BY DEFAULT** - Must be manually triggered via API

**Endpoint**: `POST /api/assignments/:id/rerun-orchestration`

### Purpose
Validates consistency between assignment, rubric, and solution documents

### Worker
**File**: `/home/user/edugrade/server/workers/orchestrationProcessor.js`

### Gemini API Call (Only if Orchestration Triggered)
**Function**: `orchestrateAssignmentData()` in geminiService.js (line 2232)

**Inputs**:
- Assignment data
- Rubric data
- Solution data
- Optional: forceReread flag to re-read from disk

**Gemini Validation Output**:
```json
{
  "validation": {
    "isValid": boolean,
    "completenessScore": number (0-100),
    "issues": [
      {
        "severity": "error|warning",
        "message": "Description",
        "category": "rubric|solution|numbering",
        "affectedQuestions": ["1", "2"]
      }
    ]
  },
  "statistics": {
    "totalQuestions": number,
    "questionsWithRubric": number,
    "questionsWithSolution": number
  },
  "integratedStructure": {
    "questions": [
      {
        "number": "1",
        "text": "Question text",
        "points": 10,
        "rubricCriteria": [...],
        "solution": {...}
      }
    ]
  },
  "recommendations": [
    {
      "priority": "HIGH|MEDIUM|LOW",
      "recommendation": "Suggestion"
    }
  ]
}
```

**Stored In Database**:
```
assignment.orchestrationStatus = 'completed'
assignment.orchestratedData = <full validation response>
assignment.validationResults = <parsed issues and suggestions>
assignment.orchestrationCompletedAt = <timestamp>
```

---

## Data Flow Diagram

```
POST /api/assignments
    |
    v
Validate + Create MongoDB document
    |
    v
Queue Jobs (Parallel Processing via separate queues)
    |
    +---> assignmentProcessingQueue
    |      |
    |      v
    |     Gemini: processAssignmentPDF()
    |      |
    |      +---> Store: processedData
    |      |
    |      v (If no separate rubric file)
    |     Gemini: extractRubricFromAssignmentPDF()
    |      |
    |      +---> Store: processedRubric
    |
    +---> rubricProcessingQueue (if rubric file provided)
    |      |
    |      v
    |     Gemini: processRubricPDF()
    |      |
    |      +---> Store: processedRubric
    |
    +---> solutionProcessingQueue (if solution file provided)
           |
           v
          Gemini: processSolutionPDF()
           |
           +---> Store: processedSolution

After each job completion:
    |
    v
updateAssignmentEvaluationReadiness()
    |
    v
Update: evaluationReadyStatus ('not_ready' | 'partial' | 'ready')

Manual Trigger (Optional):
POST /api/assignments/:id/rerun-orchestration
    |
    v
orchestrationQueue
    |
    v
Gemini: orchestrateAssignmentData()
    |
    +---> Store: orchestratedData + validationResults
```

---

## Database Fields Summary

### Key Stored Fields

**Processed Data**:
- `processedData`: Extracted assignment structure from Gemini
- `processedRubric`: Extracted rubric criteria from Gemini
- `processedSolution`: Extracted solution from Gemini
- `orchestratedData`: Validation results from orchestration

**Status Fields**:
- `processingStatus`: 'pending' | 'processing' | 'completed' | 'failed'
- `rubricProcessingStatus`: Same enum
- `solutionProcessingStatus`: Same enum
- `orchestrationStatus`: 'pending' | 'processing' | 'completed' | 'failed' | 'not_needed'
- `evaluationReadyStatus`: 'not_ready' | 'partial' | 'ready'

**Extraction Tracking**:
- `rubricExtractionSource`: 'separate_file' | 'assignment_pdf' | 'assignment_pdf_failed' | 'not_available'
- `rubricExtractionNotes`: Notes about how rubric was extracted

**Error Tracking**:
- `processingError`: Error message if processing failed
- `rubricProcessingError`: Error message for rubric processing
- `solutionProcessingError`: Error message for solution processing
- `orchestrationError`: Error message for orchestration

---

## Rate Limiting

**File**: `/home/user/edugrade/server/utils/geminiService.js` (lines 44-96)

- **Rate Limit**: 5 requests per minute (RPM)
- **Enforcement**: 12-second delay between requests
- **Implementation**: Queue system with `enforceRateLimit()` function
- **Retry Logic**: Exponential backoff with max 3 retries

---

## Key Files Reference

File                                          | Purpose
----------------------------------------------|-----------------------------------------------------
/controllers/assignmentController.js          | Request handler for assignment CRUD
/routes/assignments.js                        | API endpoint definitions
/models/assignment.js                         | MongoDB schema definition
/workers/assignmentProcessor.js               | Assignment PDF processing worker
/workers/rubricProcessor.js                   | Rubric PDF processing worker
/workers/solutionProcessor.js                 | Solution PDF processing worker
/workers/orchestrationProcessor.js            | Orchestration/validation worker
/utils/geminiService.js                       | All Gemini API integration functions
/utils/assignmentUtils.js                     | Helper functions for status tracking
/config/memoryQueue.js                        | Queue implementation (in-memory, no Redis)
/config/queue.js                              | Queue initialization and exports

---

## Important Notes

1. **All Processing is Asynchronous**: API returns immediately after queuing jobs
2. **Sequential Queue Processing**: Jobs process one at a time per queue (not parallel)
3. **No Redis Dependency**: Uses in-memory queue suitable for single-server deployments
4. **Rate Limited**: Gemini API calls respect 5 RPM limit with 12-second delays
5. **Fallback Processing**: System tries Landing AI → then Gemini PDF → gracefully handles errors
6. **Rubric Extraction**: If no separate rubric provided, system attempts to extract from assignment
7. **Orchestration Optional**: Disabled by default, manually triggered when needed
8. **Polling Required**: Frontend must poll `/api/assignments/:id/status` to track progress
