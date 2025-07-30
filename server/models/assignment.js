const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  }
});

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
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
  // Timestamps for processing
  processingStartedAt: Date,
  processingCompletedAt: Date,
  rubricProcessingStartedAt: Date,
  rubricProcessingCompletedAt: Date,
  solutionProcessingStartedAt: Date,
  solutionProcessingCompletedAt: Date,
  // Processed data from Gemini API
  processedData: mongoose.Schema.Types.Mixed,
  processedRubric: mongoose.Schema.Types.Mixed,
  processedSolution: mongoose.Schema.Types.Mixed,
  // Rubric extraction tracking
  rubricExtractionSource: {
    type: String,
    enum: ['separate_file', 'assignment_pdf', 'assignment_pdf_failed', 'not_available'],
    default: 'not_available'
  },
  rubricExtractionNotes: String
});

const Assignment = mongoose.model('Assignment', assignmentSchema);

module.exports = { Assignment, assignmentSchema };