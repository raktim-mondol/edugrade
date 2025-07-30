const { ProjectSubmission } = require('../models/projectSubmission');
const { Project } = require('../models/project');
const path = require('path');
const fs = require('fs').promises;
const { processFileForGemini } = require('../utils/pdfExtractor');
const { processCodeFile } = require('../utils/codeProcessor');
const { evaluationQueue } = require('../config/queue');

// Define job types
const JOB_TYPES = {
  PROCESS_PROJECT: 'processProjectSubmission',
  PROJECT_EVALUATION: 'evaluateProjectSubmission'
};

// Create a new project submission
exports.createSubmission = async (req, res) => {
  try {
    const { projectId, studentId, studentName } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ message: 'Project ID is required' });
    }
    
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }
    
    // Check if project exists and is processed by DeepSeek
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Make sure the project has been processed with DeepSeek before accepting submissions
    if (project.processingStatus !== 'completed') {
      return res.status(400).json({ 
        message: 'Project details are still being processed. Please try again later.',
        status: project.processingStatus
      });
    }
    
    // Create user ID from student ID for reference
    const userId = studentId;
    
    const newSubmission = new ProjectSubmission({
      projectId,
      userId,
      studentId,
      studentName: studentName || studentId,
      projectType: project.submissionType || 'both',
      // Set initial processing statuses
      codeProcessingStatus: req.files?.codeFile ? 'pending' : 'not_applicable',
      reportProcessingStatus: req.files?.reportFile ? 'pending' : 'not_applicable'
    });
    
    // Handle code file upload - using multer
    if (req.files && req.files.codeFile && req.files.codeFile.length > 0) {
      const codeFile = req.files.codeFile[0]; // With multer, file is an array
      const codeFilePath = codeFile.path; // Path is already set by multer
      
      // Update submission with file details
      newSubmission.codeFile = codeFilePath;
      newSubmission.codeFileName = codeFile.originalname;
      newSubmission.fileType = path.extname(codeFile.originalname);
    } else if (project.codeRequired) {
      return res.status(400).json({ message: 'Code file is required for this project' });
    }
    
    // Handle report file upload - using multer
    if (req.files && req.files.reportFile && req.files.reportFile.length > 0) {
      const reportFile = req.files.reportFile[0]; // With multer, file is an array
      const reportFilePath = reportFile.path; // Path is already set by multer
      
      // Update submission with file details
      newSubmission.reportFile = reportFilePath;
      newSubmission.reportFileName = reportFile.originalname;
    } else if (project.reportRequired) {
      return res.status(400).json({ message: 'Report file is required for this project' });
    }
    
    // Save submission
    await newSubmission.save();
    
    // Queue for processing with the correct job type
    await evaluationQueue.add(JOB_TYPES.PROCESS_PROJECT, { 
      submissionId: newSubmission._id 
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
    
    return res.status(201).json({
      message: 'Project submission uploaded successfully! Your submission is being processed.',
      submissionId: newSubmission._id
    });
    
  } catch (error) {
    console.error('Error creating project submission:', error);
    return res.status(500).json({ message: 'Failed to create submission', error: error.message });
  }
};

// Process project submission files
exports.processSubmission = async (submissionId) => {
  const submission = await ProjectSubmission.findById(submissionId);
  
  if (!submission) {
    throw new Error('Submission not found');
  }
  
  try {
    // Update processing status
    submission.processingStatus = 'processing';
    await submission.save();
    
    // Process code file if exists
    if (submission.codeFile) {
      const fileExtension = path.extname(submission.codeFileName);
      submission.codeText = await processCodeFile(submission.codeFile, fileExtension);
    }
    
    // Process report file if exists
    if (submission.reportFile) {
      const processResult = await processFileForGemini(submission.reportFile);
      if (processResult.success) {
        submission.reportFilePath = processResult.filePath;
        submission.originalReportPath = processResult.originalPath;
        submission.reportFileType = processResult.fileType;
      } else {
        console.warn(`Report file processing failed: ${processResult.error}`);
        submission.processingError = processResult.error;
      }
    }
    
    // Mark as completed
    submission.processingStatus = 'completed';
    await submission.save();
    
    // Get the processed project data from Gemini
    const project = await Project.findById(submission.projectId);
    
    if (!project) {
      throw new Error(`Project ${submission.projectId} not found`);
    }
    
    // Check if project has been processed with Gemini
    const isProjectProcessed = project.processingStatus === 'completed';
    const isRubricProcessed = !project.rubricFile || project.rubricProcessingStatus === 'completed';
    
    // Only queue for evaluation if project and rubric are processed
    if (isProjectProcessed && isRubricProcessed) {
      // Queue for evaluation using the correct job type with the DeepSeek processed data
      await evaluationQueue.add(JOB_TYPES.PROJECT_EVALUATION, { 
        submissionId: submission._id,
        projectData: project.processedData,
        rubricData: project.processedRubric || null
      });
      
      console.log(`Project submission ${submissionId} queued for evaluation with DeepSeek processed data`);
      
      return { 
        success: true, 
        message: 'Submission processed successfully',
        shouldEvaluate: true
      };
    } else {
      console.warn(`Project ${submission.projectId} is not fully processed yet. Evaluation will be delayed.`);
      return {
        success: true,
        message: 'Submission processed successfully, but project is not fully processed yet',
        shouldEvaluate: false
      };
    }
  } catch (error) {
    console.error('Error processing submission:', error);
    
    // Update submission with error
    submission.processingStatus = 'failed';
    submission.processingError = error.message;
    await submission.save();
    
    return { 
      success: false, 
      error: error.message
    };
  }
};

// Get all submissions for a project
exports.getSubmissionsByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const submissions = await ProjectSubmission.find({ projectId })
      .sort({ submissionDate: -1 });
      
    return res.status(200).json(submissions);
  } catch (error) {
    console.error('Error fetching project submissions:', error);
    return res.status(500).json({ message: 'Failed to fetch submissions', error: error.message });
  }
};

// Get submission by ID
exports.getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    const submission = await ProjectSubmission.findById(submissionId)
      .populate('projectId');
      
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    return res.status(200).json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    return res.status(500).json({ message: 'Failed to fetch submission', error: error.message });
  }
};

// Update submission evaluation
exports.updateEvaluation = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { evaluationResult, comments } = req.body;
    
    const submission = await ProjectSubmission.findById(submissionId);
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Update evaluation data
    if (evaluationResult) {
      submission.evaluationResult = evaluationResult;
      submission.evaluationStatus = 'completed';
      submission.evaluationEndTime = Date.now();
    }
    
    if (comments) {
      submission.comments = comments;
    }
    
    await submission.save();
    
    return res.status(200).json({ 
      message: 'Evaluation updated successfully',
      submission
    });
  } catch (error) {
    console.error('Error updating evaluation:', error);
    return res.status(500).json({ message: 'Failed to update evaluation', error: error.message });
  }
};

// Delete a submission
exports.deleteSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    
    const submission = await ProjectSubmission.findById(submissionId);
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Delete associated files
    if (submission.codeFile) {
      try {
        await fs.unlink(submission.codeFile);
      } catch (fileError) {
        console.warn(`Could not delete code file ${submission.codeFile}:`, fileError);
      }
    }
    
    if (submission.reportFile) {
      try {
        await fs.unlink(submission.reportFile);
      } catch (fileError) {
        console.warn(`Could not delete report file ${submission.reportFile}:`, fileError);
      }
    }
    
    // Delete submission from database
    await ProjectSubmission.findByIdAndDelete(submissionId);
    
    return res.status(200).json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return res.status(500).json({ message: 'Failed to delete submission', error: error.message });
  }
};