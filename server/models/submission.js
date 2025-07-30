const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  studentId: {
    type: String,
    required: true,
    trim: true
  },
  studentName: {
    type: String,
    required: true,
    trim: true
  },
  submissionFile: {
    type: String,
    required: true
  },
  comments: {
    type: String,
    trim: true
  },
  submitDate: {
    type: Date,
    default: Date.now
  },
  // File processing fields for direct Gemini processing
  processedFilePath: {
    type: String,
    // Path to processed file (PDF ready for Gemini)
  },
  originalFilePath: {
    type: String,
    // Original uploaded file path
  },
  fileType: {
    type: String,
    // File extension (.pdf, .ipynb)
  },
  // Processing status fields
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  evaluationStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  // Error messages
  processingError: String,
  evaluationError: String,
  // Timestamps
  processingStartedAt: Date,
  processingCompletedAt: Date,
  evaluationStartedAt: Date,
  evaluationCompletedAt: Date,
  // Processed data from DeepSeek API
  processedData: mongoose.Schema.Types.Mixed,
  // Evaluation results from Gemini API
  evaluationResult: mongoose.Schema.Types.Mixed,
  // Overall grade (raw score)
  overallGrade: Number,
  // Total possible score for this submission (might differ if rubric changes)
  totalPossible: Number,
  // Track if solution data was available during evaluation
  solutionDataAvailable: {
    type: Boolean,
    default: false
  },
  // Track solution processing status at time of evaluation
  solutionStatusAtEvaluation: {
    type: String,
    enum: ['not_applicable', 'pending', 'processing', 'completed', 'failed'],
    default: 'not_applicable'
  }
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = { Submission };