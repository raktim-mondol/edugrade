/**
 * Assignment Document Processor
 * Processes assignment documents using Landing AI for extraction and Gemini API for processing
 * Also extracts rubric information when no separate rubric is provided
 */
const { assignmentProcessingQueue, rubricProcessingQueue } = require('../config/queue');
const { processAssignmentPDF, extractRubricFromAssignmentPDF, processAssignmentContent, extractRubricFromContent } = require('../utils/geminiService');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');
const { Assignment } = require('../models/assignment');
const { updateAssignmentEvaluationReadiness, checkAndTriggerOrchestration } = require('../utils/assignmentUtils');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

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

    let processedData;
    let extractedContent = null;

    // Check file extension to determine processing method
    const fileExtension = path.extname(pdfFilePath).toLowerCase();
    const isTextFile = ['.txt', '.text'].includes(fileExtension);

    if (isTextFile) {
      // Handle text files directly
      console.log(`📝 Processing text file for assignment ${assignmentId}`);
      const textContent = await fs.readFile(pdfFilePath, 'utf-8');
      processedData = await processAssignmentContent(textContent);

      // Update the assignment in the database with the processed data
      await Assignment.findByIdAndUpdate(assignmentId, {
        processedData,
        processingStatus: 'completed',
        processingCompletedAt: new Date()
      });
    } else if (isLandingAIConfigured()) {
      // Check if Landing AI is configured for two-stage processing
      console.log(`🔄 Using two-stage processing for assignment ${assignmentId}`);

      // Stage 1: Extract content via Landing AI
      console.log(`📄 Stage 1: Extracting PDF content via Landing AI...`);
      extractedContent = await extractWithRetry(pdfFilePath);

      // Stage 2: Process extracted content via Gemini
      console.log(`🤖 Stage 2: Processing content via Gemini...`);
      const formattedContent = formatExtractedContent(extractedContent);
      processedData = await processAssignmentContent(formattedContent);

      // Update with extracted content
      await Assignment.findByIdAndUpdate(assignmentId, {
        extractedContent,
        processedData,
        processingStatus: 'completed',
        processingCompletedAt: new Date()
      });
    } else {
      // Fallback: Direct PDF processing via Gemini
      console.log(`🔄 Using direct PDF processing for assignment ${assignmentId} (Landing AI not configured)`);
      processedData = await processAssignmentPDF(pdfFilePath);

      // Update the assignment in the database with the processed data
      await Assignment.findByIdAndUpdate(assignmentId, {
        processedData,
        processingStatus: 'completed',
        processingCompletedAt: new Date()
      });
    }
    
    // Check if the assignment has a separate rubric file
    const assignment = await Assignment.findById(assignmentId);
    
    // If no separate rubric file is provided, try to extract rubric from assignment PDF
    // Note: This is optional - if extraction fails, evaluation can still proceed
    if (!assignment.rubricFile) {
      console.log(`No separate rubric file found for assignment ${assignmentId}. Attempting to extract rubric from assignment PDF...`);
      
      try {
        // Update rubric processing status to indicate we're extracting from assignment
        await Assignment.findByIdAndUpdate(assignmentId, {
          rubricProcessingStatus: 'processing',
          rubricProcessingStartedAt: new Date()
        });

        let extractedRubric;

        // Use extracted content if available (two-stage processing) or if it's a text file
        if (isTextFile) {
          console.log(`📝 Extracting rubric from text file content...`);
          const textContent = await fs.readFile(pdfFilePath, 'utf-8');
          extractedRubric = await extractRubricFromContent(textContent, assignment.totalPoints);
        } else if (extractedContent && isLandingAIConfigured()) {
          console.log(`🔄 Extracting rubric from already-extracted assignment content...`);
          const formattedContent = formatExtractedContent(extractedContent);
          extractedRubric = await extractRubricFromContent(formattedContent, assignment.totalPoints);
        } else {
          // Fallback: Extract rubric from assignment PDF directly
          extractedRubric = await extractRubricFromAssignmentPDF(pdfFilePath, assignment.totalPoints);
        }

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
        console.log(`Rubric extraction failed, but evaluation can still proceed using assignment instructions for grading criteria.`);
        
        // Update rubric status to failed but don't fail the entire assignment
        // Evaluation can still proceed without explicit rubric
        await Assignment.findByIdAndUpdate(assignmentId, {
          rubricProcessingStatus: 'skipped',
          rubricProcessingError: `Failed to extract rubric from assignment PDF: ${rubricError.message}`,
          rubricExtractionSource: 'assignment_pdf_failed',
          rubricExtractionNotes: 'Rubric extraction failed - grading criteria will be derived from assignment instructions during evaluation'
        });
      }
    }
    
    // Check if the assignment is now ready for evaluation
    const readyStatus = await updateAssignmentEvaluationReadiness(assignmentId);
    console.log(`Assignment ${assignmentId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    // Check if we should trigger orchestration
    await checkAndTriggerOrchestration(assignmentId);
    
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