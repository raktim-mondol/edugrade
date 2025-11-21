const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getProcessingStatus,
  rerunOrchestration
} = require('../controllers/assignmentController');

// Configure multer for storing uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload folder based on file type
    let uploadPath = '';
    if (file.fieldname === 'assignment') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'assignments');
    } else if (file.fieldname === 'solution') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'solutions');
    } else if (file.fieldname === 'rubric') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'rubrics');
    } else if (file.fieldname === 'questions') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'questions');
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Apply authentication middleware to all routes
router.use(requireAuth());

// Define routes for assignments
// GET /api/assignments - Get all assignments
router.get('/', getAssignments);

// GET /api/assignments/:id - Get assignment by id
router.get('/:id', getAssignmentById);

// GET /api/assignments/:id/status - Get assignment processing status
router.get('/:id/status', getProcessingStatus);

// POST /api/assignments/:id/rerun-orchestration - Re-run orchestration for an assignment
router.post('/:id/rerun-orchestration', rerunOrchestration);

// POST /api/assignments - Create new assignment
// Multiple file uploads for assignment, solution, and rubric
router.post('/',
  upload.fields([
    { name: 'assignment', maxCount: 1 },
    { name: 'questions', maxCount: 1 },
    { name: 'solution', maxCount: 1 },
    { name: 'rubric', maxCount: 1 }
  ]),
  createAssignment
);

// PUT /api/assignments/:id - Update assignment
router.put('/:id',
  upload.fields([
    { name: 'assignment', maxCount: 1 },
    { name: 'questions', maxCount: 1 },
    { name: 'solution', maxCount: 1 },
    { name: 'rubric', maxCount: 1 }
  ]),
  updateAssignment
);

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', deleteAssignment);

module.exports = router;