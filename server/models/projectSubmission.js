const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSubmissionSchema = new Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submissionDate: {
    type: Date,
    default: Date.now
  },
  // Code submission
  codeFile: {
    type: String, // Path to the uploaded code file
    required: function() {
      return this.projectType === 'code' || this.projectType === 'both';
    }
  },
  codeFileName: {
    type: String
  },
  codeText: {
    type: String // Extracted text content from code files
  },
  // Report submission
  reportFile: {
    type: String, // Path to the uploaded report file
    required: function() {
      return this.projectType === 'report' || this.projectType === 'both';
    }
  },
  reportFileName: {
    type: String
  },
  reportText: {
    type: String // Extracted text content from report
  },
  // Status tracking
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: {
    type: String
  },
  // Evaluation
  evaluationStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  evaluationStartTime: {
    type: Date
  },
  evaluationEndTime: {
    type: Date
  },
  evaluationError: {
    type: String
  },
  evaluationResult: {
    codeEvaluation: {
      score: Number,
      feedback: String,
      strengths: [String],
      improvements: [String],
      detailedFeedback: {
        codeQuality: String,
        functionality: String,
        efficiency: String,
        documentation: String
      }
    },
    reportEvaluation: {
      score: Number,
      feedback: String,
      strengths: [String],
      improvements: [String],
      detailedFeedback: {
        content: String,
        structure: String,
        research: String,
        writingStyle: String
      }
    },
    overallScore: Number,
    overallFeedback: String
  },
  // Metadata
  fileType: {
    type: String // ZIP, PDF, IPYNB, etc.
  },
  projectType: {
    type: String,
    enum: ['code', 'report', 'both'],
    required: true
  },
  comments: {
    type: String
  }
}, {
  timestamps: true
});

// Pre-save hook to set projectType based on file submissions
ProjectSubmissionSchema.pre('save', function(next) {
  if (this.isNew) {
    if (this.codeFile && this.reportFile) {
      this.projectType = 'both';
    } else if (this.codeFile) {
      this.projectType = 'code';
    } else if (this.reportFile) {
      this.projectType = 'report';
    }
  }
  next();
});

module.exports = mongoose.model('ProjectSubmission', ProjectSubmissionSchema);