/**
 * Rubric Document Processor
 * Processes rubric documents using Gemini API
 */
const { rubricProcessingQueue } = require('../config/queue');
const { processRubricPDF } = require('../utils/geminiService');
const { Assignment } = require('../models/assignment');
const { updateAssignmentEvaluationReadiness } = require('../utils/assignmentUtils');
const mongoose = require('mongoose');

// Process rubrics from the queue
rubricProcessingQueue.process(async (job) => {
  console.log(`Processing rubric job ${job.id}`);
  
  const { assignmentId, pdfFilePath, totalPoints } = job.data;
  
  if (!assignmentId || !pdfFilePath) {
    throw new Error('Missing required data for rubric processing');
  }
  
  try {
    // Update processing status to in-progress
    await Assignment.findByIdAndUpdate(assignmentId, {
      rubricProcessingStatus: 'processing',
      rubricProcessingStartedAt: new Date()
    });

    // Get the assignment to access its question structure if available
    const assignment = await Assignment.findById(assignmentId);
    const questionStructure = assignment?.questionStructure || null;
    
    console.log(`Retrieved question structure for assignment ${assignmentId}: ${questionStructure ? 'Found' : 'Not found'}`);

    // Process the rubric document PDF using Gemini API
    const processedRubric = await processRubricPDF(pdfFilePath, totalPoints);
    
    // Update the assignment in the database with the processed rubric
    await Assignment.findByIdAndUpdate(assignmentId, {
      processedRubric,
      rubricProcessingStatus: 'completed',
      rubricProcessingCompletedAt: new Date(),
      rubricExtractionSource: 'separate_file',
      rubricExtractionNotes: 'Processed from separate rubric file'
    });
    
    // Check if the assignment is now ready for evaluation
    const readyStatus = await updateAssignmentEvaluationReadiness(assignmentId);
    console.log(`Rubric for assignment ${assignmentId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    return { success: true, assignmentId, processedRubric, readyStatus };
  } catch (error) {
    console.error(`Error processing rubric for assignment ${assignmentId}:`, error);
    
    // Update the assignment status to failed
    await Assignment.findByIdAndUpdate(assignmentId, {
      rubricProcessingStatus: 'failed',
      rubricProcessingError: error.message
    });
    
    // Check if the assignment is ready for evaluation (it won't be if the rubric failed)
    await updateAssignmentEvaluationReadiness(assignmentId);
    
    throw error;
  }
});

console.log('Rubric processor worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Rubric processor shutting down');
  await rubricProcessingQueue.close();
  process.exit(0);
});

module.exports = rubricProcessingQueue;