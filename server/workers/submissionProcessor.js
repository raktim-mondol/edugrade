/**
 * Submission Document Processor
 * Processes student submissions (now bypasses DeepSeek)
 */
const { submissionProcessingQueue, evaluationQueue } = require('../config/queue');
const { Submission } = require('../models/submission');
const { Assignment } = require('../models/assignment');
const mongoose = require('mongoose');

// Process student submissions from the queue
submissionProcessingQueue.process(async (job) => {
  console.log(`Processing student submission job ${job.id}`);
  
  const { submissionId, filePath, originalPath, fileType, studentId } = job.data;
  
  if (!submissionId || !filePath) {
    throw new Error('Missing required data for submission processing');
  }
  
  try {
    // Get the submission to find its associated assignment
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    
    // Store the file paths for direct Gemini processing
    await Submission.findByIdAndUpdate(submissionId, {
      processedFilePath: filePath,
      originalFilePath: originalPath,
      fileType: fileType,
      processingStatus: 'completed',
      processingCompletedAt: new Date()
    });
    
    console.log(`Submission ${submissionId} processed successfully (bypassing DeepSeek)`);
    
    // Check if the associated assignment has been fully processed
    const assignment = await Assignment.findById(submission.assignmentId);
    if (!assignment) {
      throw new Error(`Associated assignment ${submission.assignmentId} not found`);
    }
    
    // Check if the assignment is ready for evaluation
    if (assignment.evaluationReadyStatus === 'ready') {
      const jobPayload = {
        submissionId,
        assignmentId: submission.assignmentId,
        assignmentData: assignment.processedData,
        assignmentTitle: assignment.title || '',
        assignmentDescription: assignment.description || '',
        rubricData: assignment.processedRubric,
        solutionData: assignment.processedSolution || {}, // Ensure {} if solution is missing/undefined
        submissionFilePath: filePath,
        submissionOriginalPath: originalPath,
        submissionFileType: fileType,
        studentId: studentId
      };
      // *** ADDED LOGGING ***
      console.log(`[SubmissionProcessor] Creating 'ready' evaluation job. assignment.processedSolution:`, assignment.processedSolution);
      console.log(`[SubmissionProcessor] Creating 'ready' evaluation job. Payload solutionData:`, jobPayload.solutionData);
      // *** END ADDED LOGGING ***
      await evaluationQueue.createJob(jobPayload).save();
      
      console.log(`Evaluation job created for submission ${submissionId}`);
    } 
    else if (assignment.evaluationReadyStatus === 'partial' &&
             assignment.processedData) {
      // We have at least the assignment data - proceed with evaluation
      // Rubric and solution are optional
      console.log(`Assignment ${submission.assignmentId} has partial readiness. Proceeding with evaluation.`);
      console.log(`  - Assignment data: ${assignment.processedData ? 'Available' : 'Missing'}`);
      console.log(`  - Rubric data: ${assignment.processedRubric ? 'Available (will be used)' : 'Not available (will derive from assignment)'}`);
      console.log(`  - Solution data: ${assignment.processedSolution ? 'Available (will be used)' : 'Not available (optional)'}`);
      
      const jobPayload = {
        submissionId,
        assignmentId: submission.assignmentId,
        assignmentData: assignment.processedData,
        assignmentTitle: assignment.title || '',
        assignmentDescription: assignment.description || '',
        rubricData: assignment.processedRubric || null, // Can be null - will derive from assignment if needed
        solutionData: assignment.processedSolution || null, // Can be null - solution is optional
        submissionFilePath: filePath,
        submissionOriginalPath: originalPath,
        submissionFileType: fileType,
        studentId: studentId
      };
      // *** ADDED LOGGING ***
      console.log(`[SubmissionProcessor] Creating 'partial' evaluation job. assignment.processedSolution:`, assignment.processedSolution);
      console.log(`[SubmissionProcessor] Creating 'partial' evaluation job. Payload solutionData:`, jobPayload.solutionData);
      console.log(`[SubmissionProcessor] Creating 'partial' evaluation job. Payload rubricData:`, jobPayload.rubricData ? 'Present' : 'Null (will derive from assignment)');
      // *** END ADDED LOGGING ***
      await evaluationQueue.createJob(jobPayload).save();
      
      console.log(`Evaluation job created for submission ${submissionId} with available data`);
    } 
    else {
      // Assignment is not ready yet
      console.log(`Waiting for assignment processing to complete before evaluation for submission ${submissionId}`);
      console.log(`Assignment evaluation ready status: ${assignment.evaluationReadyStatus || 'not_ready'}`);
      console.log(`Assignment processing status:
        - Assignment data: ${assignment.processedData ? 'Complete' : 'Missing'}
        - Rubric data: ${assignment.processedRubric ? 'Complete' : 'Missing'}
        - Solution data: ${assignment.processedSolution ? 'Complete' : 'Missing'}`);
      
      // Update submission to pending evaluation
      await Submission.findByIdAndUpdate(submissionId, {
        evaluationStatus: 'pending',
        evaluationMessage: 'Waiting for assignment processing to complete'
      });
    }
    
    return { success: true, submissionId };
  } catch (error) {
    console.error(`Error processing submission ${submissionId}:`, error);
    
    // Update the submission status to failed
    await Submission.findByIdAndUpdate(submissionId, {
      processingStatus: 'failed',
      processingError: error.message
    }).catch(updateErr => {
      console.error(`Failed to update submission status for ${submissionId}:`, updateErr);
    });
    
    throw error;
  }
});

console.log('Submission processor worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Submission processor shutting down');
  await submissionProcessingQueue.close();
  process.exit(0);
});

module.exports = submissionProcessingQueue;