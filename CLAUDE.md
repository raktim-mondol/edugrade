# CLAUDE.md - AI Assistant Guide for EduGrade

**Last Updated**: 2025-11-19
**Project**: EduGrade - AI-Powered Automated Grading System
**Purpose**: Comprehensive guide for AI assistants working with this codebase

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Codebase Structure](#codebase-structure)
4. [Development Workflows](#development-workflows)
5. [Key Conventions](#key-conventions)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [Critical Knowledge](#critical-knowledge)

---

## Project Overview

EduGrade is a full-stack web application that automates grading of student submissions using Large Language Models (LLMs). Instructors upload assignments, rubrics, and solutions; students submit their work; and the system uses Google Gemini API to evaluate submissions and provide detailed feedback.

### Core Features

- **Assignment Management**: Upload assignment specs (PDF), rubrics, and model solutions
- **Multi-Format Submission Support**: PDF and .ipynb (Jupyter notebooks) with automatic conversion
- **AI-Powered Evaluation**: Gemini API analyzes submissions against rubrics and solutions
- **Background Processing**: Custom in-memory queue system for async task handling (no Redis)
- **Project Support**: Evaluate code files and reports for coding projects
- **Excel Export**: Comprehensive results export with color-coded grading
- **Orchestration & Validation**: Optional consistency checking across documents

### Tech Stack

**Frontend (Client)**
- React 18.2 with React Router 6.20
- Bootstrap 5.3 + React Bootstrap 2.9
- Axios for API calls
- React Dropzone, Formik, Chart.js
- Development server proxy: `http://localhost:5000`

**Backend (Server)**
- Node.js with Express 4.21
- MongoDB with Mongoose 8.13
- Multer for file uploads
- Custom in-memory queue (alternative to BullMQ/Redis)
- Puppeteer for PDF generation
- ExcelJS for results export

**External Services**
- Google Gemini API (@google/generative-ai)
- DeepSeek API via OpenAI SDK (currently bypassed)

---

## Architecture & Tech Stack

### System Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   React Client  │────────▶│  Express Server  │
│  (Port 3000)    │◀────────│   (Port 5000)    │
└─────────────────┘         └──────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐   ┌──────────────┐
              │ MongoDB  │    │  Queue   │   │ Gemini API   │
              │ Database │    │  System  │   │  (Google)    │
              └──────────┘    └──────────┘   └──────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              [Workers: Assignment, Rubric, Solution,
               Submission, Evaluation, Orchestration]
```

### Pattern: Queue-Based Asynchronous Processing

All heavy operations (PDF processing, AI evaluation) are handled asynchronously:

```
Upload File → Queue Job → Worker Process → Update DB →
Check Readiness → Queue Next Stage → Final Status
```

**Critical**: This is NOT real-time. All status must be polled via API endpoints.

---

## Codebase Structure

```
/home/user/edugrade/
├── client/                          # React Frontend
│   ├── public/
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── FileDropzone.js      # Drag-and-drop file upload
│   │   │   ├── Header.js            # Navigation bar
│   │   │   ├── SubmissionsList.js   # Submissions table
│   │   │   └── SubmissionTableComponent.js
│   │   ├── pages/                   # Route-level components
│   │   │   ├── AssignmentForm.js    # Create/edit assignments
│   │   │   ├── AssignmentList.js    # Grid view of assignments
│   │   │   ├── AssignmentProcessingPage.js  # Real-time status
│   │   │   ├── Home.js              # Landing page
│   │   │   ├── ProjectForm.js       # Create projects
│   │   │   ├── ProjectList.js       # List projects
│   │   │   ├── ProjectSubmissionForm.js
│   │   │   ├── ResultsPage.js       # Grading results + Excel export
│   │   │   ├── SubmissionForm.js    # Upload submissions
│   │   │   └── SubmissionList.js    # List submissions
│   │   ├── App.js                   # Main routing
│   │   ├── index.js                 # React entry point
│   │   └── index.css
│   └── package.json
│
├── server/                          # Node.js Backend
│   ├── config/
│   │   ├── db.js                    # MongoDB connection
│   │   ├── memoryQueue.js          # In-memory queue (no Redis)
│   │   └── queue.js                # Queue initialization
│   │
│   ├── controllers/                 # Request handlers
│   │   ├── assignmentController.js  # Assignment CRUD + processing
│   │   ├── projectController.js     # Project CRUD
│   │   ├── projectSubmissionController.js
│   │   └── submissionController.js  # Submission handling + evaluation
│   │
│   ├── models/                      # Mongoose schemas
│   │   ├── assignment.js            # Assignment + processing status
│   │   ├── project.js
│   │   ├── projectSubmission.js
│   │   ├── submission.js            # Student submission + results
│   │   └── user.js
│   │
│   ├── routes/                      # API route definitions
│   │   ├── assignments.js           # /api/assignments
│   │   ├── projects.js              # /api/projects
│   │   └── submissions.js           # /api/submissions
│   │
│   ├── utils/                       # Business logic & integrations
│   │   ├── assignmentUtils.js       # Readiness checks
│   │   ├── codeProcessor.js         # Extract code from files
│   │   ├── deepseekService.js       # DeepSeek API (bypassed)
│   │   ├── geminiService.js         # Google Gemini integration
│   │   ├── pdfExtractor.js          # .ipynb → PDF conversion
│   │   └── projectUtils.js
│   │
│   ├── workers/                     # Background job processors
│   │   ├── assignmentProcessor.js   # Process assignment PDFs
│   │   ├── evaluationProcessor.js   # Grade submissions
│   │   ├── orchestrationProcessor.js # Validate consistency
│   │   ├── projectProcessor.js      # Process project files
│   │   ├── rubricProcessor.js       # Extract rubric
│   │   ├── solutionProcessor.js     # Process model solution
│   │   └── submissionProcessor.js   # Convert + prepare submissions
│   │
│   ├── uploads/                     # File storage (gitignored)
│   │   ├── assignments/
│   │   ├── rubrics/
│   │   ├── solutions/
│   │   ├── submissions/
│   │   └── project-submissions/
│   │
│   ├── server.js                    # Main entry point
│   └── package.json
│
├── Documentation Files
│   ├── README.md                    # Project overview
│   ├── rule.md                      # Original project requirements
│   ├── CLAUDE.md                    # This file
│   ├── EXCEL_EXPORT_FIX.md
│   ├── EXCEL_FIX_COMPLETE.md
│   ├── ORCHESTRATION_UI_IMPLEMENTATION.md
│   ├── ORCHESTRATION_STATUS_BUG_FIX.md
│   ├── RERUN_ORCHESTRATION_GUIDE.md
│   └── TESTING_EXCEL_FIX.md
│
├── Startup Scripts
│   ├── start.sh / start.bat         # Start both client & server
│   ├── start-client.sh / .bat
│   └── start-server.sh / .bat
│
└── Configuration
    └── .gitignore                   # Excludes: node_modules, .env, uploads, *.pdf, *.ipynb
```

---

## Development Workflows

### Setup & Installation

```bash
# Clone repository
git clone https://github.com/raktim-mondol/edugrade.git
cd edugrade

# Install backend dependencies
cd server
npm install

# Create .env file
cat > .env << EOF
MONGO_URI=mongodb://localhost:27017/edugrade
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
GEMINI_MODEL=gemini-2.5-pro
PORT=5000
EOF

# Install frontend dependencies
cd ../client
npm install
```

### Running the Application

**Option 1: Separate Terminals**
```bash
# Terminal 1 - Backend
cd server
npm start  # Runs on http://localhost:5000

# Terminal 2 - Frontend
cd client
npm start  # Runs on http://localhost:3000
```

**Option 2: Startup Scripts**
```bash
# Linux/Mac
./start.sh

# Windows
start.bat
```

### Development Flow

1. **Start MongoDB** (local or cloud)
2. **Start backend server** (initializes workers)
3. **Start frontend** (proxies API calls to backend)
4. **Access UI** at `http://localhost:3000`

### Processing Pipeline

```
┌──────────────────────────────────────────────────────────┐
│ 1. ASSIGNMENT UPLOAD                                     │
│    └─▶ assignmentProcessor.js (Gemini extracts structure)│
│                                                           │
│ 2. RUBRIC PROCESSING (if separate file provided)        │
│    └─▶ rubricProcessor.js (Gemini extracts criteria)    │
│                                                           │
│ 3. SOLUTION PROCESSING (if provided)                    │
│    └─▶ solutionProcessor.js (Gemini extracts solution)  │
│                                                           │
│ 4. ORCHESTRATION (OPTIONAL - manual trigger only)       │
│    └─▶ orchestrationProcessor.js (validates consistency)│
│                                                           │
│ 5. EVALUATION READY                                      │
│    └─▶ Ready for student submissions                     │
│                                                           │
│ 6. SUBMISSION UPLOAD                                     │
│    └─▶ submissionProcessor.js (convert .ipynb to PDF)   │
│                                                           │
│ 7. EVALUATION                                            │
│    └─▶ evaluationProcessor.js (Gemini grades submission)│
│                                                           │
│ 8. RESULTS AVAILABLE                                     │
│    └─▶ View in UI, export to Excel                       │
└──────────────────────────────────────────────────────────┘
```

### API Endpoints Reference

#### Assignments (`/api/assignments`)

| Method | Endpoint | Purpose | File Uploads |
|--------|----------|---------|-------------|
| GET | `/` | List all assignments | - |
| GET | `/:id` | Get assignment details | - |
| GET | `/:id/status` | Get processing status | - |
| POST | `/` | Create assignment | `assignment`, `solution`, `rubric` (PDFs) |
| POST | `/:id/rerun-orchestration` | Trigger orchestration | - |
| PUT | `/:id` | Update assignment | Same as POST |
| DELETE | `/:id` | Delete assignment | - |

#### Submissions (`/api/submissions`)

| Method | Endpoint | Purpose | File Uploads |
|--------|----------|---------|-------------|
| GET | `/:assignmentId` | List submissions | - |
| GET | `/single/:id` | Get submission details | - |
| GET | `/single/:id/pdf` | Download converted PDF | - |
| GET | `/single/:id/file-info` | File metadata | - |
| GET | `/:assignmentId/export` | Export to Excel | - |
| POST | `/single` | Upload single submission | `submission` (PDF/.ipynb) |
| POST | `/batch` | Upload multiple submissions | `submissions[]` |
| POST | `/:id/rerun` | Re-run failed evaluation | - |
| DELETE | `/:id` | Delete submission | - |

#### Projects (`/api/projects`)

| Method | Endpoint | Purpose | File Uploads |
|--------|----------|---------|-------------|
| GET | `/` | List all projects | - |
| GET | `/:id` | Get project details | - |
| GET | `/:id/status` | Get processing status | - |
| GET | `/:projectId/submissions` | List submissions | - |
| POST | `/` | Create project | `projectDetails`, `rubric` |
| POST | `/project-submissions` | Submit project work | `codeFile`, `reportFile` |
| PUT | `/:id` | Update project | Same as POST |
| DELETE | `/:id` | Delete project | - |

---

## Key Conventions

### File Naming

- **Models**: Singular PascalCase (e.g., `Assignment`, `Submission`)
- **Controllers**: camelCase with `Controller` suffix
- **Workers**: `[entity]Processor.js` (e.g., `evaluationProcessor.js`)
- **Utils**: `[purpose]Service.js` or `[purpose]Utils.js`
- **Components**: PascalCase (e.g., `FileDropzone.js`)
- **Pages**: PascalCase with purpose (e.g., `AssignmentList.js`)

### Code Organization

**Backend Pattern**: MVC + Workers + Queue
```
Request → Route → Controller → Queue Job → Worker → Update DB → Response
```

**Frontend Pattern**: Component-Based SPA
```
Route → Page Component → Fetch Data → Render → Update State → Re-render
```

### Status Management

**Critical**: This system uses multiple status fields to track pipeline stages.

#### Assignment Status Fields

```javascript
{
  // Processing statuses
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed',
  rubricProcessingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'not_applicable',
  solutionProcessingStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'not_applicable',

  // Orchestration (optional)
  orchestrationStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'not_needed',

  // Evaluation readiness
  evaluationReadyStatus: 'not_ready' | 'partial' | 'ready'
}
```

**Evaluation Readiness Logic**:
- `ready`: Assignment + Rubric + Solution all processed
- `partial`: Assignment processed (can evaluate without rubric/solution)
- `not_ready`: Assignment not processed yet

#### Submission Status Fields

```javascript
{
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed',
  evaluationStatus: 'pending' | 'processing' | 'completed' | 'failed'
}
```

### Polling Pattern (Frontend)

**All processing is asynchronous**. The UI must poll for status updates:

```javascript
// Example from AssignmentProcessingPage.js
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await axios.get(`/api/assignments/${id}/status`);

    // Check if all processing is complete
    const documentsReady = (
      response.data.assignmentProcessingStatus === 'completed' &&
      (response.data.rubricProcessingStatus === 'completed' ||
       response.data.rubricProcessingStatus === 'not_applicable') &&
      (response.data.solutionProcessingStatus === 'completed' ||
       response.data.solutionProcessingStatus === 'not_applicable')
    );

    const orchestrationReady = (
      !response.data.orchestrationStatus ||
      response.data.orchestrationStatus === 'pending' ||
      response.data.orchestrationStatus === 'completed' ||
      response.data.orchestrationStatus === 'failed'
    );

    if (documentsReady && orchestrationReady) {
      clearInterval(interval);
    }
  }, 30000); // Poll every 30 seconds

  return () => clearInterval(interval);
}, [id]);
```

### Error Handling

**Backend Pattern**:
```javascript
try {
  // Operation
  await doSomething();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('❌ Error:', error);
  res.status(500).json({ error: error.message });
}
```

**Frontend Pattern**:
```javascript
try {
  const response = await axios.post('/api/endpoint', data);
  // Handle success
} catch (error) {
  console.error('Error:', error);
  alert(error.response?.data?.error || 'An error occurred');
}
```

### Logging Conventions

- Use emojis for visual clarity: ✅ (success), ❌ (error), 🔄 (processing), 📄 (file)
- Log important state transitions
- Include entity IDs for traceability

```javascript
console.log('✅ Assignment processed successfully:', assignmentId);
console.log('🔄 Starting rubric processing...');
console.log('❌ Evaluation failed:', error.message);
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create/Update Model** (if needed):
   ```javascript
   // server/models/myEntity.js
   const mongoose = require('mongoose');

   const myEntitySchema = new mongoose.Schema({
     name: String,
     // ... fields
   }, { timestamps: true });

   module.exports = mongoose.model('MyEntity', myEntitySchema);
   ```

2. **Create Controller**:
   ```javascript
   // server/controllers/myEntityController.js
   const MyEntity = require('../models/myEntity');

   exports.getMyEntities = async (req, res) => {
     try {
       const entities = await MyEntity.find();
       res.json({ entities });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   };
   ```

3. **Create Route**:
   ```javascript
   // server/routes/myEntities.js
   const express = require('express');
   const router = express.Router();
   const controller = require('../controllers/myEntityController');

   router.get('/', controller.getMyEntities);

   module.exports = router;
   ```

4. **Register Route in server.js**:
   ```javascript
   const myEntitiesRoutes = require('./routes/myEntities');
   app.use('/api/my-entities', myEntitiesRoutes);
   ```

### Adding a New Worker

1. **Create Worker File**:
   ```javascript
   // server/workers/myProcessor.js
   const MyEntity = require('../models/myEntity');

   async function processMyEntity(job) {
     const { entityId } = job.data;

     try {
       const entity = await MyEntity.findById(entityId);

       // Update status
       entity.processingStatus = 'processing';
       await entity.save();

       // Do processing
       const result = await doSomething(entity);

       // Save result
       entity.processedData = result;
       entity.processingStatus = 'completed';
       await entity.save();

       console.log('✅ Processing completed for:', entityId);
     } catch (error) {
       console.error('❌ Processing failed:', error);
       entity.processingStatus = 'failed';
       entity.error = error.message;
       await entity.save();
     }
   }

   module.exports = processMyEntity;
   ```

2. **Register Worker in server.js**:
   ```javascript
   const { myQueue } = require('./config/queue');
   const processMyEntity = require('./workers/myProcessor');

   // Initialize worker
   myQueue.process(processMyEntity);

   console.log('🔄 My Entity worker initialized');
   ```

3. **Queue Jobs from Controller**:
   ```javascript
   const { myQueue } = require('../config/queue');

   exports.createMyEntity = async (req, res) => {
     try {
       const entity = await MyEntity.create(req.body);

       // Queue processing job
       await myQueue.add({ entityId: entity._id });

       res.json({ success: true, entity });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   };
   ```

### Adding a New React Page

1. **Create Page Component**:
   ```javascript
   // client/src/pages/MyPage.js
   import React, { useState, useEffect } from 'react';
   import axios from 'axios';

   function MyPage() {
     const [data, setData] = useState([]);

     useEffect(() => {
       fetchData();
     }, []);

     const fetchData = async () => {
       try {
         const response = await axios.get('/api/my-entities');
         setData(response.data.entities);
       } catch (error) {
         console.error('Error fetching data:', error);
       }
     };

     return (
       <div className="container mt-4">
         <h2>My Page</h2>
         {/* Content */}
       </div>
     );
   }

   export default MyPage;
   ```

2. **Add Route in App.js**:
   ```javascript
   import MyPage from './pages/MyPage';

   <Route path="/my-page" element={<MyPage />} />
   ```

3. **Add Navigation Link** (if needed):
   ```javascript
   // client/src/components/Header.js
   <Nav.Link as={Link} to="/my-page">My Page</Nav.Link>
   ```

### Modifying Gemini API Calls

All Gemini interactions are in `server/utils/geminiService.js`:

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.5-pro'
});

// Rate limiting (5 RPM)
const RATE_LIMIT_DELAY = 12000; // 12 seconds
let lastCallTime = 0;

async function callGeminiAPI(prompt, pdfPath) {
  // Wait for rate limit
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    await new Promise(resolve =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastCall)
    );
  }

  lastCallTime = Date.now();

  // Prepare file for Gemini
  const filePart = await prepareFileForGemini(pdfPath);

  // Call API
  const result = await model.generateContent([
    { text: prompt },
    filePart
  ]);

  return result.response.text();
}
```

**Important**: Gemini processes PDFs directly (no text extraction needed).

---

## Troubleshooting

### Common Issues

#### 1. Orchestration Status Stuck in "Processing"

**Symptom**: UI shows infinite spinner for "Validating Documents"

**Root Cause**: Polling stopped before orchestration completed

**Solution**: Ensure polling waits for `orchestrationStatus` to be `completed`, `failed`, or `pending`

**Reference**: See `ORCHESTRATION_STATUS_BUG_FIX.md`

#### 2. Excel Export Shows Old Data Format

**Symptom**: Exported Excel doesn't match current rubric structure

**Root Cause**: Backward compatibility with old data format

**Solution**: Excel export automatically transforms old format to new

**Reference**: See `EXCEL_FIX_COMPLETE.md`

#### 3. .ipynb Conversion Fails

**Symptom**: Submission processing fails for Jupyter notebooks

**Possible Causes**:
- Notebook too large (>10MB)
- Puppeteer not installed
- nbconvert not available

**Solution**:
```bash
cd server
npm install puppeteer
```

Check `pdfExtractor.js` for conversion logic.

#### 4. Gemini API Rate Limit Exceeded

**Symptom**: Processing fails with "429 Too Many Requests"

**Root Cause**: More than 5 requests per minute

**Solution**: Rate limiting is built-in (12-second delay). For batch processing, queue jobs properly.

#### 5. Polling Never Stops

**Symptom**: Frontend keeps polling indefinitely

**Debug Steps**:
1. Check browser console for status updates
2. Verify all status fields in API response
3. Ensure polling stop conditions match database enum values

**Common Fix**: Update polling conditions to handle all status values:
```javascript
const allComplete = (
  status === 'completed' ||
  status === 'failed' ||
  status === 'not_applicable'
);
```

### Debugging Tools

#### Backend Logging
```javascript
// Add debug logs to workers
console.log('=== Job Data ===');
console.log('Assignment ID:', job.data.assignmentId);
console.log('Current Status:', assignment.processingStatus);
```

#### Frontend Logging
```javascript
// Add status monitoring
useEffect(() => {
  console.log('=== Processing Status ===');
  console.log('Assignment:', processingStatus.assignmentProcessingStatus);
  console.log('Rubric:', processingStatus.rubricProcessingStatus);
  console.log('Solution:', processingStatus.solutionProcessingStatus);
  console.log('Orchestration:', processingStatus.orchestrationStatus);
}, [processingStatus]);
```

#### Database Inspection
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/edugrade

# Check assignment status
db.assignments.findOne({ _id: ObjectId("...") })

# Check submission status
db.submissions.find({ assignmentId: ObjectId("...") })
```

---

## Critical Knowledge

### 1. Queue System Architecture

**Important**: This project uses a **custom in-memory queue**, NOT Redis-based BullMQ.

**Location**: `server/config/memoryQueue.js`

**Queues**:
- `assignmentQueue`: Assignment PDF processing
- `rubricQueue`: Rubric extraction
- `solutionQueue`: Solution processing
- `submissionQueue`: File conversion
- `evaluationQueue`: Grading submissions
- `orchestrationQueue`: Validation (manual trigger only)

**Characteristics**:
- Jobs processed in-order (FIFO)
- No persistence (restarting server clears queue)
- No distributed processing
- Suitable for single-server deployments

**Trade-offs**:
- ✅ No Redis dependency
- ✅ Simpler setup
- ❌ No job persistence
- ❌ No distributed workers

### 2. Gemini API Integration

**Processing Strategy**: Direct PDF processing (no text extraction)

```javascript
// Gemini accepts PDF files directly
const filePart = {
  inlineData: {
    data: fs.readFileSync(pdfPath).toString('base64'),
    mimeType: 'application/pdf'
  }
};

const result = await model.generateContent([
  { text: prompt },
  filePart
]);
```

**Rate Limits**:
- 5 requests per minute (RPM)
- Built-in 12-second delay between calls
- Automatic retry with exponential backoff

**Model**: `gemini-2.5-pro` (configurable via `GEMINI_MODEL` env var)

### 3. Orchestration System

**Status**: Disabled by default, **manual trigger only**

**Purpose**: Validate consistency between assignment, rubric, and solution

**Trigger**: `POST /api/assignments/:id/rerun-orchestration`

**Output**:
```javascript
{
  validationResults: {
    hasIssues: true,
    completenessScore: 75,
    missingRubricForQuestions: ['Q3', 'Q5'],
    extraRubricCriteria: ['participation'],
    missingSolutionForQuestions: ['Q2'],
    warnings: ['Rubric points don't match assignment'],
    suggestions: ['Add solution for Q2']
  }
}
```

**Why Disabled?**:
- Time-consuming (additional Gemini API call)
- Optional for basic grading
- Can be run on-demand when needed

### 4. Evaluation Modes

**Full Mode** (Preferred):
- Assignment + Rubric + Solution
- Most accurate grading
- Detailed feedback

**Partial Mode** (Fallback):
- Assignment only
- Derives grading criteria from assignment
- Less structured feedback

**Project Mode**:
- Code and/or report evaluation
- Separate scoring for each component
- Combined overall score

### 5. File Upload Handling

**Multer Configuration**:
```javascript
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/assignments/'); // or submissions/, etc.
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
```

**Supported Formats**:
- Assignments/Rubrics/Solutions: **PDF only**
- Submissions: **PDF or .ipynb**
- Code: **.py, .js, .java, .c, .cpp, .html, .css, .zip**, etc.

**File Paths**:
- Original: Stored in database as uploaded
- Processed: `.ipynb` → converted PDF path stored separately

### 6. Database Schema Critical Fields

**Assignment Model**:
```javascript
{
  // Files
  assignmentFile: String,        // Path to uploaded PDF
  rubricFile: String,            // Optional separate rubric
  solutionFile: String,          // Optional model solution

  // Processed Data (from Gemini)
  processedData: Mixed,          // Assignment structure
  processedRubric: Mixed,        // Grading criteria
  processedSolution: Mixed,      // Model solution
  orchestratedData: Mixed,       // Validation results

  // Status Tracking
  processingStatus: String,
  rubricProcessingStatus: String,
  solutionProcessingStatus: String,
  orchestrationStatus: String,
  evaluationReadyStatus: String, // 'ready', 'partial', 'not_ready'

  // Metadata
  totalPoints: Number,
  questionStructure: Mixed,
  validationResults: Object
}
```

**Submission Model**:
```javascript
{
  // Association
  assignmentId: ObjectId,

  // Student Info
  studentId: String,
  studentName: String,

  // Files
  submissionFile: String,        // Original upload
  originalFilePath: String,      // Same as above
  processedFilePath: String,     // Converted PDF (if .ipynb)
  fileType: String,              // 'pdf' or 'ipynb'

  // Processed Data (from Gemini)
  processedData: Mixed,          // Extracted content
  evaluationResult: Mixed,       // Grading results

  // Scores
  overallGrade: Number,
  totalPossible: Number,

  // Status
  processingStatus: String,
  evaluationStatus: String,

  // Metadata
  solutionDataAvailable: Boolean,
  solutionStatusAtEvaluation: String
}
```

### 7. Environment Variables

**Required** (server/.env):
```env
MONGO_URI=mongodb://localhost:27017/edugrade
GEMINI_API_KEY=your_gemini_api_key_here
```

**Optional**:
```env
DEEPSEEK_API_KEY=your_deepseek_key  # Currently bypassed
GEMINI_MODEL=gemini-2.5-pro          # Default model
PORT=5000                            # Server port
```

**Security Note**: `.env` files are gitignored. Never commit API keys.

### 8. Excel Export Features

**Library**: ExcelJS

**Features**:
- Dynamic columns based on question structure
- Color-coded cells (green for full points, red for zero)
- Subsection breakdown (if available)
- Assignment metadata header
- Backward compatibility with old data formats

**Export Endpoint**: `GET /api/submissions/:assignmentId/export`

**Usage**:
```javascript
// Frontend (ResultsPage.js)
const response = await axios.get(`/api/submissions/${assignmentId}/export`, {
  responseType: 'blob'
});

const blob = new Blob([response.data], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});

fileDownload(blob, `results-${assignmentId}.xlsx`);
```

### 9. Status Polling Best Practices

**Polling Interval**: 30 seconds (adjustable)

**Stop Conditions**:
```javascript
// All these must be true to stop polling:
const allProcessingComplete = (
  // Documents processed
  assignmentStatus === 'completed' &&
  (rubricStatus === 'completed' || rubricStatus === 'not_applicable') &&
  (solutionStatus === 'completed' || solutionStatus === 'not_applicable') &&

  // Orchestration finished or not started
  (orchestrationStatus === 'pending' ||
   orchestrationStatus === 'completed' ||
   orchestrationStatus === 'failed' ||
   orchestrationStatus === 'not_needed') &&

  // Ready for evaluation
  (evaluationReadyStatus === 'ready' || evaluationReadyStatus === 'partial')
);

if (allProcessingComplete) {
  clearInterval(pollingInterval);
}
```

**Cleanup**: Always clear interval on component unmount:
```javascript
useEffect(() => {
  const interval = setInterval(pollStatus, 30000);
  return () => clearInterval(interval);
}, []);
```

### 10. Recent Bug Fixes & Issues

**Orchestration Status Bug** (FIXED):
- **Issue**: UI stuck showing "Validating Documents" spinner
- **Cause**: Polling stopped before orchestration completed
- **Fix**: Updated polling to wait for all async processes
- **Reference**: `ORCHESTRATION_STATUS_BUG_FIX.md`

**Excel Export Compatibility** (FIXED):
- **Issue**: Old data format not displaying correctly
- **Cause**: Schema changes over time
- **Fix**: Backward compatibility layer in export function
- **Reference**: `EXCEL_FIX_COMPLETE.md`

**Rerun Orchestration Feature** (IMPLEMENTED):
- **Feature**: Manual trigger for orchestration validation
- **Endpoint**: `POST /api/assignments/:id/rerun-orchestration`
- **Reference**: `RERUN_ORCHESTRATION_GUIDE.md`

---

## Best Practices for AI Assistants

### When Working with This Codebase

1. **Always Check Status Fields**: Multiple status fields track different stages. Check all relevant fields before making changes.

2. **Respect Async Nature**: All processing is asynchronous. Never assume immediate completion.

3. **Follow Queue Pattern**: Heavy operations MUST go through queue system. Don't bypass workers.

4. **Maintain Backward Compatibility**: When modifying schemas, ensure old data still works.

5. **Test Polling Logic**: Any changes to status fields require testing polling conditions.

6. **Document New Features**: Add to this file when implementing major changes.

7. **Log Important Events**: Use console logs with emojis for clarity.

8. **Handle Errors Gracefully**: Always wrap async operations in try-catch blocks.

9. **Validate File Uploads**: Check file types and sizes before processing.

10. **Rate Limit External APIs**: Respect Gemini API limits (5 RPM).

### Making Changes Safely

**Before Modifying**:
- Read relevant documentation files (especially recent bug fix docs)
- Check if similar functionality already exists
- Understand the full processing pipeline
- Identify all affected status fields

**When Modifying**:
- Update both backend and frontend
- Maintain status field consistency
- Add logging for new processes
- Test polling behavior

**After Modifying**:
- Update this CLAUDE.md file
- Test full pipeline end-to-end
- Verify Excel export still works
- Check backward compatibility

---

## Additional Resources

### Documentation Files

- **`README.md`**: User-facing project overview
- **`rule.md`**: Original project requirements and architecture
- **`ORCHESTRATION_STATUS_BUG_FIX.md`**: Detailed bug fix for orchestration polling
- **`EXCEL_FIX_COMPLETE.md`**: Excel export backward compatibility
- **`RERUN_ORCHESTRATION_GUIDE.md`**: Manual orchestration trigger guide
- **`ORCHESTRATION_UI_IMPLEMENTATION.md`**: Orchestration feature implementation
- **`TESTING_EXCEL_FIX.md`**: Testing procedures for Excel export

### External Documentation

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [React Documentation](https://react.dev/)
- [React Router](https://reactrouter.com/)
- [ExcelJS](https://github.com/exceljs/exceljs)
- [Puppeteer](https://pptr.dev/)

### Contact & Support

For questions or issues, refer to:
1. This CLAUDE.md file
2. Specific documentation files in the root directory
3. Code comments in relevant files
4. Git commit history for context

---

**End of CLAUDE.md**

*This document should be updated whenever significant changes are made to the codebase architecture, workflows, or conventions.*
