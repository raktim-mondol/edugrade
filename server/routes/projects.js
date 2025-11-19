const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectStatus
} = require('../controllers/projectController');
const {
  createSubmission,
  getSubmissionsByProject,
  getSubmissionById,
  updateEvaluation,
  deleteSubmission
} = require('../controllers/projectSubmissionController');

// Configure multer for storing uploaded project files
const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload folder based on file type
    let uploadPath = '';
    if (file.fieldname === 'projectDetails') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'projects');
    } else if (file.fieldname === 'rubric') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'rubrics');
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

// Configure multer for storing uploaded submission files
const submissionStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine upload folder based on file type
    let uploadPath = '';
    if (file.fieldname === 'codeFile') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'project-submissions', 'code');
    } else if (file.fieldname === 'reportFile') {
      uploadPath = path.join(__dirname, '..', 'uploads', 'project-submissions', 'reports');
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

// File upload and validation middleware for projects
const uploadProject = multer({
  storage: projectStorage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'projectDetails' || file.fieldname === 'rubric') {
      // Allow only PDF files for project details and rubrics
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed'), false);
      }
    } else {
      cb(null, true);
    }
  }
});

// File upload and validation middleware for submissions
const uploadSubmission = multer({
  storage: submissionStorage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'reportFile') {
      // Allow only PDF files for reports
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files are allowed for reports'), false);
      }
    } else if (file.fieldname === 'codeFile') {
      // Allow specific extensions for code files
      const allowedExtensions = ['.py', '.ipynb', '.java', '.js', '.html', '.css', '.zip'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedExtensions.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported file type for code submission'), false);
      }
    } else {
      cb(null, true);
    }
  }
});

// Apply authentication middleware to all routes
router.use(requireAuth());

// Project routes - using multer middleware for file uploads
router.post('/', uploadProject.fields([
  { name: 'projectDetails', maxCount: 1 },
  { name: 'rubric', maxCount: 1 }
]), createProject);

router.get('/', getProjects);
router.get('/:id', getProjectById);

router.put('/:id', uploadProject.fields([
  { name: 'projectDetails', maxCount: 1 },
  { name: 'rubric', maxCount: 1 }
]), updateProject);

router.delete('/:id', deleteProject);
router.get('/:id/status', getProjectStatus);

// Project submission routes - using multer for file uploads
router.post('/project-submissions', uploadSubmission.fields([
  { name: 'codeFile', maxCount: 1 },
  { name: 'reportFile', maxCount: 1 }
]), createSubmission);

router.get('/project-submissions/:submissionId', getSubmissionById);
router.put('/project-submissions/:submissionId/evaluation', updateEvaluation);
router.delete('/project-submissions/:submissionId', deleteSubmission);

// Filter submissions by project
router.get('/:projectId/submissions', getSubmissionsByProject);

module.exports = router;