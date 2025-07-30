/**
 * Solution Document Processor
 * Processes solution documents using Gemini API
 */
const { solutionProcessingQueue } = require('../config/queue');
const { processSolutionPDF } = require('../utils/geminiService');
const { Assignment } = require('../models/assignment');
const { updateAssignmentEvaluationReadiness } = require('../utils/assignmentUtils');
const mongoose = require('mongoose');

// Process solutions from the queue
solutionProcessingQueue.process(async (job) => {
  console.log(`Processing solution job ${job.id}`);
  
  const { assignmentId, pdfFilePath } = job.data;
  
  if (!assignmentId || !pdfFilePath) {
    throw new Error('Missing required data for solution processing');
  }
  
  try {
    // Update processing status to in-progress
    await Assignment.findByIdAndUpdate(assignmentId, {
      solutionProcessingStatus: 'processing',
      solutionProcessingStartedAt: new Date()
    });

    // Process the solution document PDF using Gemini API
    const processedSolution = await processSolutionPDF(pdfFilePath);
    
    // Update the assignment in the database with the processed solution
    await Assignment.findByIdAndUpdate(assignmentId, {
      processedSolution,
      solutionProcessingStatus: 'completed',
      solutionProcessingCompletedAt: new Date()
    });
    
    // Check if the assignment is now ready for evaluation
    const readyStatus = await updateAssignmentEvaluationReadiness(assignmentId);
    console.log(`Solution for assignment ${assignmentId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    return { success: true, assignmentId, processedSolution, readyStatus };
  } catch (error) {
    console.error(`Error processing solution for assignment ${assignmentId}:`, error);
    
    // Update the assignment status to failed
    await Assignment.findByIdAndUpdate(assignmentId, {
      solutionProcessingStatus: 'failed',
      solutionProcessingError: error.message
    });
    
    // Check if the assignment is ready for evaluation (might still be if solution is optional)
    await updateAssignmentEvaluationReadiness(assignmentId);
    
    throw error;
  }
});

console.log('Solution processor worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Solution processor shutting down');
  await solutionProcessingQueue.close();
  process.exit(0);
});

module.exports = solutionProcessingQueue;