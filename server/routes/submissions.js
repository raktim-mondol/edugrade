const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const {
  getSubmissions,
  uploadSubmission,
  uploadBatchSubmissions,
  getSubmissionById,
  exportToExcel,
  exportToCsv,
  deleteSubmission,
  getSubmissionPdf,
  getSubmissionFileInfo,
  rerunSubmission
} = require('../controllers/submissionController');

// Configure multer for storing uploaded submissions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create submissions directory if it doesn't exist
    const uploadPath = path.join(__dirname, '..', 'uploads', 'submissions');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp and original name
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// File validation middleware for submissions
const fileFilter = (req, file, cb) => {
  // Allow PDF files and Jupyter notebooks
  const allowedMimeTypes = ['application/pdf'];
  const allowedExtensions = ['.pdf', '.ipynb'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  
  // Check for .ipynb files (they come as application/json or text/plain)
  if (fileExtension === '.ipynb') {
    // Accept .ipynb files regardless of MIME type (browsers may send different MIME types)
    cb(null, true);
  } else if (allowedMimeTypes.includes(mimeType) && allowedExtensions.includes(fileExtension)) {
    // Accept PDF files
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Jupyter Notebook (.ipynb) files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter
});

// Apply authentication middleware to all routes
router.use(requireAuth());

// Specific routes should come before variable routes
// POST /api/submissions/single - Upload single submission
router.post('/single', upload.single('submission'), uploadSubmission);

// POST /api/submissions/batch - Upload batch submissions
router.post('/batch', upload.array('submissions', 100), uploadBatchSubmissions);

// GET /api/submissions/single/:id - Get a single submission by ID
router.get('/single/:id', getSubmissionById);

// GET /api/submissions/single/:id/pdf - Get converted PDF for a submission  
router.get('/single/:id/pdf', getSubmissionPdf);

// GET /api/submissions/single/:id/file-info - Get file information for a submission
router.get('/single/:id/file-info', getSubmissionFileInfo);

// POST /api/submissions/:id/rerun - Re-run processing for a failed submission
router.post('/:id/rerun', rerunSubmission);

// DELETE /api/submissions/:id - Delete a submission
router.delete('/:id', deleteSubmission);

// GET /api/submissions/:assignmentId/export - Export submissions to Excel
router.get('/:assignmentId/export', exportToExcel);

// GET /api/submissions/:assignmentId/export-csv - Export submissions to CSV with detailed feedback
router.get('/:assignmentId/export-csv', exportToCsv);

// GET /api/submissions/:assignmentId - Get all submissions for an assignment
router.get('/:assignmentId', getSubmissions);

module.exports = router;