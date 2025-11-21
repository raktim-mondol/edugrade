const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false,
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  // AI grading configuration
  selectedModels: {
    type: [String],
    default: ['gemini-2.5-pro']
  },
  useAverageGrading: {
    type: Boolean,
    default: false
  }
});

const assignmentSchema = new mongoose.Schema({
  // User/Creator information
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false,
    default: ''
  },
  course: {
    type: String,
    required: false,
    trim: true,
    default: 'General'
  },
  dueDate: {
    type: Date,
    required: false,
    default: () => new Date(+new Date() + 7*24*60*60*1000)
  },
  assignmentFile: {
    type: String,
    required: true
  },
  rubricFile: {
    type: String
  },
  solutionFile: {
    type: String
  },
  questionsFile: {
    type: String
  },
  // Question structure information
  totalPoints: {
    type: Number,
    default: 100
  },
  questionStructure: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  // Add sections field
  sections: {
    type: [sectionSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Processing status fields
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not_applicable'],
    default: 'pending'
  },
  rubricProcessingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not_applicable'],
    default: 'not_applicable'
  },
  solutionProcessingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not_applicable'],
    default: 'not_applicable'
  },
  questionsProcessingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not_applicable'],
    default: 'not_applicable'
  },
  // Overall evaluation readiness status
  evaluationReadyStatus: {
    type: String,
    enum: ['not_ready', 'ready', 'partial'],
    default: 'not_ready'
  },
  // Error messages
  processingError: String,
  rubricProcessingError: String,
  solutionProcessingError: String,
  questionsProcessingError: String,
  // Timestamps for processing
  processingStartedAt: Date,
  processingCompletedAt: Date,
  rubricProcessingStartedAt: Date,
  rubricProcessingCompletedAt: Date,
  solutionProcessingStartedAt: Date,
  solutionProcessingCompletedAt: Date,
  questionsProcessingStartedAt: Date,
  questionsProcessingCompletedAt: Date,
  // Extracted content from Landing AI
  extractedContent: mongoose.Schema.Types.Mixed,
  extractedRubric: mongoose.Schema.Types.Mixed,
  extractedSolution: mongoose.Schema.Types.Mixed,
  extractedQuestions: mongoose.Schema.Types.Mixed,
  // Processed data from Gemini API
  processedData: mongoose.Schema.Types.Mixed,
  processedRubric: mongoose.Schema.Types.Mixed,
  processedSolution: mongoose.Schema.Types.Mixed,
  processedQuestions: mongoose.Schema.Types.Mixed,
  // Rubric extraction tracking
  rubricExtractionSource: {
    type: String,
    enum: ['separate_file', 'assignment_pdf', 'assignment_pdf_failed', 'not_available'],
    default: 'not_available'
  },
  rubricExtractionNotes: String,
  // Orchestration tracking - integrates assignment, rubric, and solution
  orchestrationStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'not_needed'],
    default: 'not_needed'  // Changed from 'pending' - orchestration disabled by default
  },
  orchestrationStartedAt: Date,
  orchestrationCompletedAt: Date,
  orchestrationError: String,
  // Integrated data after orchestration validation
  orchestratedData: mongoose.Schema.Types.Mixed,
  // Validation results from orchestration
  validationResults: {
    hasIssues: { type: Boolean, default: false },
    missingRubricForQuestions: [String],
    extraRubricCriteria: [String],
    missingSolutionForQuestions: [String],
    inconsistentQuestionNumbers: [String],
    warnings: [String],
    suggestions: [String]
  }
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

module.exports = { Assignment, assignmentSchema };