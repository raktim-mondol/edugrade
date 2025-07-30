const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  course: {
    type: String,
    required: true,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  totalPoints: {
    type: Number,
    required: true,
    default: 100
  },
  projectFile: {
    type: String,
    required: true
  },
  rubricFile: {
    type: String
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
    default: 'pending'
  },
  // Error messages
  processingError: String,
  rubricProcessingError: String,
  // Processed data - after DeepSeek processing
  processedData: Object,
  processedRubric: Object,
  // Timestamps for processing
  processingStartedAt: Date,
  processingCompletedAt: Date,
  rubricProcessingStartedAt: Date,
  rubricProcessingCompletedAt: Date,
  // Evaluation ready status
  evaluationReadyStatus: {
    type: String,
    enum: ['not_ready', 'partial', 'ready'],
    default: 'not_ready'
  },
  // Submission requirements
  codeRequired: {
    type: Boolean,
    default: true
  },
  reportRequired: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);

module.exports = {
  Project,
  projectSchema
};