const { Project } = require('../models/project');
const { ProjectSubmission } = require('../models/projectSubmission');
const { processCodeFile } = require('./codeProcessor');
const { processFileForGemini } = require('./pdfExtractor');
const { evaluationQueue } = require('../config/queue');

/**
 * Update the evaluation readiness status of a project
 * @param {string} projectId - The ID of the project to update
 * @returns {Promise<string>} - The updated status
 */
async function updateProjectEvaluationReadiness(projectId) {
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return 'not_ready';
    }

    // Check if the primary project details are processed
    if (project.processingStatus !== 'completed') {
      project.evaluationReadyStatus = 'not_ready';
      await project.save();
      return 'not_ready';
    }

    // Check if rubric is provided and processed
    if (project.rubricFile) {
      if (project.rubricProcessingStatus !== 'completed') {
        project.evaluationReadyStatus = 'not_ready';
        await project.save();
        return 'not_ready';
      }
    } else {
      // Rubric is not provided but project details are processed
      project.evaluationReadyStatus = 'partial';
      await project.save();
      return 'partial';
    }

    // Everything is ready
    project.evaluationReadyStatus = 'ready';
    await project.save();
    
    // Check if there are any pending submissions that can now be evaluated
    await checkPendingSubmissions(projectId);
    
    return 'ready';
  } catch (error) {
    console.error(`Error updating project evaluation readiness for ${projectId}:`, error);
    return 'not_ready';
  }
}

/**
 * Check for pending submissions that can be evaluated now
 * @param {string} projectId - The ID of the project to check
 */
async function checkPendingSubmissions(projectId) {
  try {
    const pendingSubmissions = await ProjectSubmission.find({ 
      projectId,
      evaluationStatus: 'pending',
      codeProcessingStatus: { $in: ['completed', 'not_applicable'] },
      reportProcessingStatus: { $in: ['completed', 'not_applicable'] }
    });
    
    // Queue these submissions for evaluation
    for (const submission of pendingSubmissions) {
      submission.evaluationStatus = 'processing';
      submission.evaluationStartedAt = new Date();
      await submission.save();
      
      console.log(`Queuing evaluation for project submission ${submission._id}`);
      // Queue for evaluation using the evaluationQueue
      await evaluationQueue.add('evaluateProjectSubmission', { submissionId: submission._id });
    }
  } catch (error) {
    console.error(`Error checking pending submissions for project ${projectId}:`, error);
  }
}

/**
 * Pre-process a project submission with code and report files
 * @param {string} submissionId - The ID of the submission to process
 */
async function processProjectSubmission(submissionId) {
  try {
    const submission = await ProjectSubmission.findById(submissionId);
    if (!submission) {
      console.error(`Submission not found: ${submissionId}`);
      return;
    }
    
    // Process code file if present
    if (submission.codeFile && submission.codeProcessingStatus === 'pending') {
      submission.codeProcessingStatus = 'processing';
      submission.codeProcessingStartedAt = new Date();
      await submission.save();
      
      try {
        // Extract file extension from path
        const filePath = submission.codeFile;
        const fileExtension = filePath.split('.').pop().toLowerCase();
        
        // Process the code file
        const codeResult = await processCodeFile(filePath, fileExtension);
        
        if (codeResult.success) {
          submission.codeText = codeResult.text;
          submission.codeProcessingStatus = 'completed';
        } else {
          submission.codeProcessingStatus = 'failed';
          submission.codeProcessingError = codeResult.error || 'Unknown error processing code file';
        }
        
        submission.codeProcessingCompletedAt = new Date();
        await submission.save();
      } catch (error) {
        console.error(`Error processing code file for submission ${submissionId}:`, error);
        submission.codeProcessingStatus = 'failed';
        submission.codeProcessingError = `Error processing code file: ${error.message}`;
        submission.codeProcessingCompletedAt = new Date();
        await submission.save();
      }
    }
    
    // Process report file if present
    if (submission.reportFile && submission.reportProcessingStatus === 'pending') {
      submission.reportProcessingStatus = 'processing';
      submission.reportProcessingStartedAt = new Date();
      await submission.save();
      
      try {
        // Process report file for direct Gemini processing
        const reportPath = submission.reportFile;
        
        const processResult = await processFileForGemini(reportPath);
        
        if (processResult.success) {
          submission.reportFilePath = processResult.filePath;
          submission.originalReportPath = processResult.originalPath;
          submission.reportFileType = processResult.fileType;
          submission.reportProcessingStatus = 'completed';
        } else {
          submission.reportProcessingStatus = 'failed';
          submission.reportProcessingError = processResult.error;
        }
        
        submission.reportProcessingCompletedAt = new Date();
        await submission.save();
      } catch (error) {
        console.error(`Error processing report file for submission ${submissionId}:`, error);
        submission.reportProcessingStatus = 'failed';
        submission.reportProcessingError = `Error processing report file: ${error.message}`;
        submission.reportProcessingCompletedAt = new Date();
        await submission.save();
      }
    }
    
    // Check if submission is ready for evaluation
    const project = await Project.findById(submission.projectId);
    if (!project) {
      console.error(`Project not found for submission ${submissionId}`);
      return;
    }
    
    const isCodeReady = !project.codeRequired || 
      submission.codeProcessingStatus === 'completed';
    
    const isReportReady = !project.reportRequired ||
      submission.reportProcessingStatus === 'completed';
    
    const isProjectReady = project.evaluationReadyStatus === 'ready' || 
      project.evaluationReadyStatus === 'partial';
    
    if (isCodeReady && isReportReady && isProjectReady) {
      submission.evaluationStatus = 'processing';
      submission.evaluationStartTime = new Date();
      await submission.save();
      
      // Queue for evaluation
      await evaluationQueue.add('evaluateProjectSubmission', { submissionId });
      
      console.log(`Submission ${submissionId} is ready for evaluation`);
    }
  } catch (error) {
    console.error(`Error processing project submission ${submissionId}:`, error);
  }
}

module.exports = {
  updateProjectEvaluationReadiness,
  processProjectSubmission,
  checkPendingSubmissions
};