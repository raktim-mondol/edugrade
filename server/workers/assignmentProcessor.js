/**
 * Assignment Document Processor
 * Processes assignment documents using Gemini API
 * Also extracts rubric information when no separate rubric is provided
 */
const { assignmentProcessingQueue, rubricProcessingQueue } = require('../config/queue');
const { processAssignmentPDF, extractRubricFromAssignmentPDF } = require('../utils/geminiService');
const { Assignment } = require('../models/assignment');
const { updateAssignmentEvaluationReadiness } = require('../utils/assignmentUtils');
const mongoose = require('mongoose');

// Process assignments from the queue
assignmentProcessingQueue.process(async (job) => {
  console.log(`Processing assignment job ${job.id}`);
  
  const { assignmentId, pdfFilePath } = job.data;
  
  if (!assignmentId || !pdfFilePath) {
    throw new Error('Missing required data for assignment processing');
  }
  
  try {
    // Update processing status to in-progress
    await Assignment.findByIdAndUpdate(assignmentId, {
      processingStatus: 'processing',
      processingStartedAt: new Date()
    });
    
    // Process the assignment document PDF using Gemini API
    const processedData = await processAssignmentPDF(pdfFilePath);
    
    // Update the assignment in the database with the processed data
    await Assignment.findByIdAndUpdate(assignmentId, {
      processedData,
      processingStatus: 'completed',
      processingCompletedAt: new Date()
    });
    
    // Check if the assignment has a separate rubric file
    const assignment = await Assignment.findById(assignmentId);
    
    // If no separate rubric file is provided, extract rubric from assignment PDF
    if (!assignment.rubricFile) {
      console.log(`No separate rubric file found for assignment ${assignmentId}. Extracting rubric from assignment PDF...`);
      
      try {
        // Update rubric processing status to indicate we're extracting from assignment
        await Assignment.findByIdAndUpdate(assignmentId, {
          rubricProcessingStatus: 'processing',
          rubricProcessingStartedAt: new Date()
        });
        
        // Extract rubric from assignment PDF
        const extractedRubric = await extractRubricFromAssignmentPDF(pdfFilePath, assignment.totalPoints);
        
        // Update assignment with extracted rubric
        await Assignment.findByIdAndUpdate(assignmentId, {
          processedRubric: extractedRubric,
          rubricProcessingStatus: 'completed',
          rubricProcessingCompletedAt: new Date(),
          rubricExtractionSource: 'assignment_pdf',
          rubricExtractionNotes: extractedRubric.extraction_notes || 'Rubric extracted from assignment PDF'
        });
        
        console.log(`Successfully extracted rubric from assignment PDF for assignment ${assignmentId}`);
        console.log(`Found ${extractedRubric.grading_criteria?.length || 0} grading criteria`);
        
      } catch (rubricError) {
        console.error(`Error extracting rubric from assignment PDF for assignment ${assignmentId}:`, rubricError);
        
        // Update rubric status to failed but don't fail the entire assignment
        await Assignment.findByIdAndUpdate(assignmentId, {
          rubricProcessingStatus: 'failed',
          rubricProcessingError: `Failed to extract rubric from assignment PDF: ${rubricError.message}`,
          rubricExtractionSource: 'assignment_pdf_failed'
        });
      }
    }
    
    // Check if the assignment is now ready for evaluation
    const readyStatus = await updateAssignmentEvaluationReadiness(assignmentId);
    console.log(`Assignment ${assignmentId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    return { success: true, assignmentId, processedData, readyStatus };
  } catch (error) {
    console.error(`Error processing assignment ${assignmentId}:`, error);
    
    // Update the assignment status to failed
    await Assignment.findByIdAndUpdate(assignmentId, {
      processingStatus: 'failed',
      processingError: error.message
    });
    
    // Check if the assignment is ready for evaluation (it won't be if this component failed)
    await updateAssignmentEvaluationReadiness(assignmentId);
    
    throw error;
  }
});

console.log('Assignment processor worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Assignment processor shutting down');
  await assignmentProcessingQueue.close();
  process.exit(0);
});

module.exports = assignmentProcessingQueue;