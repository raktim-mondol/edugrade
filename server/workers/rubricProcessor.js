/**
 * Rubric Document Processor
 * Processes rubric documents using Landing AI for extraction and Gemini API for processing
 */
const { rubricProcessingQueue } = require('../config/queue');
const { processRubricPDF, processRubricContent } = require('../utils/geminiService');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');
const { Assignment } = require('../models/assignment');
const { updateAssignmentEvaluationReadiness, checkAndTriggerOrchestration } = require('../utils/assignmentUtils');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

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

    let processedRubric;
    let extractedRubric = null;

    // Check file extension to determine processing method
    const fileExtension = path.extname(pdfFilePath).toLowerCase();
    const isTextFile = ['.txt', '.text'].includes(fileExtension);

    if (isTextFile) {
      // Handle text files directly
      console.log(`📝 Processing text file for rubric of assignment ${assignmentId}`);
      const textContent = await fs.readFile(pdfFilePath, 'utf-8');
      processedRubric = await processRubricContent(textContent, totalPoints);

      // Update the assignment in the database with the processed rubric
      await Assignment.findByIdAndUpdate(assignmentId, {
        processedRubric,
        rubricProcessingStatus: 'completed',
        rubricProcessingCompletedAt: new Date(),
        rubricExtractionSource: 'separate_file',
        rubricExtractionNotes: 'Processed from text file'
      });
    } else if (isLandingAIConfigured()) {
      // Check if Landing AI is configured for two-stage processing
      console.log(`🔄 Using two-stage processing for rubric of assignment ${assignmentId}`);

      // Stage 1: Extract content via Landing AI
      console.log(`📄 Stage 1: Extracting rubric PDF content via Landing AI...`);
      extractedRubric = await extractWithRetry(pdfFilePath);

      // Stage 2: Process extracted content via Gemini
      console.log(`🤖 Stage 2: Processing rubric content via Gemini...`);
      const formattedContent = formatExtractedContent(extractedRubric);
      processedRubric = await processRubricContent(formattedContent, totalPoints);

      // Update with extracted content
      await Assignment.findByIdAndUpdate(assignmentId, {
        extractedRubric,
        processedRubric,
        rubricProcessingStatus: 'completed',
        rubricProcessingCompletedAt: new Date(),
        rubricExtractionSource: 'separate_file',
        rubricExtractionNotes: 'Processed from separate rubric file using Landing AI extraction'
      });
    } else {
      // Fallback: Direct PDF processing via Gemini
      console.log(`🔄 Using direct PDF processing for rubric (Landing AI not configured)`);
      processedRubric = await processRubricPDF(pdfFilePath, totalPoints);

      // Update the assignment in the database with the processed rubric
      await Assignment.findByIdAndUpdate(assignmentId, {
        processedRubric,
        rubricProcessingStatus: 'completed',
        rubricProcessingCompletedAt: new Date(),
        rubricExtractionSource: 'separate_file',
        rubricExtractionNotes: 'Processed from separate rubric file'
      });
    }
    
    // Check if the assignment is now ready for evaluation
    const readyStatus = await updateAssignmentEvaluationReadiness(assignmentId);
    console.log(`Rubric for assignment ${assignmentId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    // Check if we should trigger orchestration
    await checkAndTriggerOrchestration(assignmentId);
    
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