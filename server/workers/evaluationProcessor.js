/**
 * Evaluation Processor
 * Evaluates student submissions using Landing AI for extraction and Google Gemini API for evaluation
 */
const { evaluationQueue } = require('../config/queue');
const { evaluateSubmission, evaluateProjectSubmission, evaluateWithExtractedContent } = require('../utils/geminiService');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');
const { Submission } = require('../models/submission');
const { ProjectSubmission } = require('../models/projectSubmission');
const mongoose = require('mongoose');

// Define job types
const JOB_TYPES = {
  ASSIGNMENT_EVALUATION: 'assignmentEvaluation',
  PROJECT_EVALUATION: 'evaluateProjectSubmission',
  PROCESS_PROJECT: 'processProjectSubmission'
};

// Process project submission preprocessing
evaluationQueue.process(JOB_TYPES.PROCESS_PROJECT, async (job) => {
  console.log(`Processing project submission job ${job.id}`);
  
  const { submissionId } = job.data;
  
  if (!submissionId) {
    throw new Error('Missing submissionId for project submission processing');
  }
  
  try {
    // Import processProjectSubmission dynamically to avoid circular dependency
    const { processProjectSubmission } = require('../utils/projectUtils');
    
    // Process the project submission
    await processProjectSubmission(submissionId);
    
    return { success: true, submissionId };
  } catch (error) {
    console.error(`Error processing project submission ${submissionId}:`, error);
    throw error;
  }
});

// Process project evaluation using Gemini API
evaluationQueue.process(JOB_TYPES.PROJECT_EVALUATION, async (job) => {
  console.log(`Processing project evaluation job ${job.id}`);
  console.log(`Job data: ${JSON.stringify(job.data, null, 2)}`);
  
  const { submissionId, projectData, rubricData } = job.data;
  
  if (!submissionId) {
    throw new Error('Missing submissionId for project evaluation');
  }
  
  try {
    // Find the submission
    const submission = await ProjectSubmission.findById(submissionId);
    if (!submission) {
      throw new Error(`Project submission ${submissionId} not found`);
    }
    
    console.log(`Evaluating project submission ${submissionId} with ${projectData ? 'provided' : 'no'} project data`);
    console.log(`Evaluating project submission ${submissionId} with ${rubricData ? 'provided' : 'no'} rubric data`);
    
    // Call the evaluation function with processed project and rubric data
    const evaluatedSubmission = await evaluateProjectSubmission(
      submission,
      projectData, // Gemini processed project data
      rubricData   // Gemini processed rubric data
    );
    
    console.log(`Project evaluation completed for submission ${submissionId}`);
    
    return { 
      success: true, 
      submissionId,
      overallScore: evaluatedSubmission.evaluationResult.overallScore
    };
  } catch (error) {
    console.error(`Error evaluating project submission ${submissionId}:`, error);
    
    try {
      // Update submission status to failed
      await ProjectSubmission.findByIdAndUpdate(submissionId, {
        evaluationStatus: 'failed',
        evaluationError: error.message,
        evaluationEndTime: new Date()
      });
    } catch (updateError) {
      console.error(`Error updating project submission status: ${updateError.message}`);
    }
    
    throw error;
  }
});

// Process assignment evaluation (original functionality)
evaluationQueue.process(async (job) => {
  // *** ADDED LOGGING ***
  console.log(`[EvaluationProcessor] Received job ${job.id}. Full job data:`, JSON.stringify(job.data, null, 2)); 
  // *** END ADDED LOGGING ***
  console.log(`Processing evaluation job ${job.id}`);
  
  const {
    submissionId,
    assignmentId,
    assignmentData,
    assignmentTitle,
    assignmentDescription,
    rubricData,
    solutionData,
    submissionFilePath,
    submissionOriginalPath,
    submissionFileType,
    studentId
  } = job.data;
  
  // More specific check for missing data
  let missingFields = [];
  if (!submissionId) missingFields.push('submissionId');
  if (!assignmentData) missingFields.push('assignmentData');
  // Note: rubricData is optional since assignment files can contain grading criteria

  if (missingFields.length > 0) {
    throw new Error(`Missing required data for evaluation: ${missingFields.join(', ')}`);
  }
  
  try {
    // Fetch the submission document to get the file path
    const submission = await Submission.findById(submissionId);
    if (!submission || !submission.submissionFile) {
        throw new Error(`Submission ${submissionId} not found or missing file path.`);
    }
    // Use the processed file path for evaluation
    const filePathForEvaluation = submissionFilePath || submission.submissionFile;
    
    console.log(`Evaluating submission ${submissionId} using file: ${filePathForEvaluation}`);
    
    // Fetch orchestrated data from the assignment if available
    let orchestratedData = null;
    if (assignmentId) {
      try {
        const Assignment = require('../models/assignment').Assignment;
        const assignment = await Assignment.findById(assignmentId);
        if (assignment && assignment.orchestratedData) {
          orchestratedData = assignment.orchestratedData;
          console.log(`Using orchestrated data for evaluation:`);
          console.log(`  - Validation status: ${orchestratedData.validation?.isValid ? 'VALID' : 'HAS ISSUES'}`);
          console.log(`  - Completeness: ${orchestratedData.validation?.completenessScore || 0}%`);
          console.log(`  - Integrated questions: ${orchestratedData.integratedStructure?.questions?.length || 0}`);
        } else {
          console.log(`No orchestrated data available for assignment ${assignmentId}`);
        }
      } catch (orchError) {
        console.warn(`Could not fetch orchestrated data:`, orchError.message);
      }
    }
    
    let evaluationResult;
    let extractedSubmission = null;

    // Check if Landing AI is configured for two-stage processing
    if (isLandingAIConfigured()) {
      console.log(`🔄 Using two-stage processing for submission ${submissionId}`);

      // Stage 1: Extract submission content via Landing AI
      console.log(`📄 Stage 1: Extracting submission PDF content via Landing AI...`);
      extractedSubmission = await extractWithRetry(filePathForEvaluation);

      // Save extracted content to submission
      await Submission.findByIdAndUpdate(submissionId, {
        extractedContent: extractedSubmission
      });

      // Stage 2: Evaluate using extracted content via Gemini
      console.log(`🤖 Stage 2: Evaluating submission via Gemini...`);
      const formattedSubmission = formatExtractedContent(extractedSubmission);
      evaluationResult = await evaluateWithExtractedContent(
        assignmentData,
        rubricData,
        solutionData,
        formattedSubmission,
        studentId
      );
    } else {
      // Fallback: Direct PDF evaluation via Gemini
      console.log(`🔄 Using direct PDF evaluation for submission ${submissionId} (Landing AI not configured)`);
      const { evaluateSubmission } = require('../utils/geminiService');
      evaluationResult = await evaluateSubmission(
        assignmentData,
        rubricData,
        solutionData,
        filePathForEvaluation,
        studentId,
        orchestratedData,  // Pass orchestrated data to evaluation
        assignmentTitle,
        assignmentDescription
      );
    }
    
    // Make sure we have the raw score and total possible score
    const rawScore = evaluationResult.overallGrade || 0;
    const totalPossible = evaluationResult.totalPossible || 0;
    
    console.log(`Raw score: ${rawScore}, Total possible: ${totalPossible}`);
    
    // Check if solution data was available and valid
    const solutionAvailable = solutionData && 
      Object.keys(solutionData).length > 0 && 
      !solutionData.processing_error;
    
    // Get assignment to check solution processing status
    const assignment = await require('../models/assignment').Assignment.findById(assignmentId);
    const solutionStatus = assignment ? assignment.solutionProcessingStatus : 'not_applicable';
    
    // Update the submission with evaluation results
    await Submission.findByIdAndUpdate(submissionId, {
      evaluationResult,
      evaluationStatus: 'completed',
      evaluationCompletedAt: new Date(),
      overallGrade: rawScore,
      totalPossible: totalPossible,
      solutionDataAvailable: solutionAvailable,
      solutionStatusAtEvaluation: solutionStatus
    });
    
    console.log(`Evaluation completed for submission ${submissionId} with raw score: ${rawScore} / ${totalPossible}`);
    return { success: true, submissionId, evaluationResult };
  } catch (error) {
    console.error(`Error evaluating submission ${submissionId}:`, error);
    
    // Update the submission evaluation status to failed
    await Submission.findByIdAndUpdate(submissionId, {
      evaluationStatus: 'failed',
      evaluationError: error.message
    });
    
    throw error;
  }
});

console.log('Evaluation processor worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Evaluation processor shutting down');
  await evaluationQueue.close();
  process.exit(0);
});

module.exports = evaluationQueue;