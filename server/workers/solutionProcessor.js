/**
 * Solution Document Processor
 * Processes solution documents using Landing AI for extraction and Gemini API for processing
 */
const { solutionProcessingQueue } = require('../config/queue');
const { processSolutionPDF, processSolutionContent } = require('../utils/geminiService');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');
const { Assignment } = require('../models/assignment');
const { updateAssignmentEvaluationReadiness, checkAndTriggerOrchestration } = require('../utils/assignmentUtils');
const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

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

    let processedSolution;
    let extractedSolution = null;

    // Check file extension to determine processing method
    const fileExtension = path.extname(pdfFilePath).toLowerCase();
    const isTextFile = ['.txt', '.text'].includes(fileExtension);

    if (isTextFile) {
      // Handle text files directly
      console.log(`📝 Processing text file for solution of assignment ${assignmentId}`);
      const textContent = await fs.readFile(pdfFilePath, 'utf-8');
      processedSolution = await processSolutionContent(textContent);

      // Update the assignment in the database with the processed solution
      await Assignment.findByIdAndUpdate(assignmentId, {
        processedSolution,
        solutionProcessingStatus: 'completed',
        solutionProcessingCompletedAt: new Date()
      });
    } else if (isLandingAIConfigured()) {
      // Check if Landing AI is configured for two-stage processing
      console.log(`🔄 Using two-stage processing for solution of assignment ${assignmentId}`);

      // Stage 1: Extract content via Landing AI
      console.log(`📄 Stage 1: Extracting solution PDF content via Landing AI...`);
      extractedSolution = await extractWithRetry(pdfFilePath);

      // Stage 2: Process extracted content via Gemini
      console.log(`🤖 Stage 2: Processing solution content via Gemini...`);
      const formattedContent = formatExtractedContent(extractedSolution);
      processedSolution = await processSolutionContent(formattedContent);

      // Update with extracted content
      await Assignment.findByIdAndUpdate(assignmentId, {
        extractedSolution,
        processedSolution,
        solutionProcessingStatus: 'completed',
        solutionProcessingCompletedAt: new Date()
      });
    } else {
      // Fallback: Direct PDF processing via Gemini
      console.log(`🔄 Using direct PDF processing for solution (Landing AI not configured)`);
      processedSolution = await processSolutionPDF(pdfFilePath);

      // Update the assignment in the database with the processed solution
      await Assignment.findByIdAndUpdate(assignmentId, {
        processedSolution,
        solutionProcessingStatus: 'completed',
        solutionProcessingCompletedAt: new Date()
      });
    }
    
    // Check if the assignment is now ready for evaluation
    const readyStatus = await updateAssignmentEvaluationReadiness(assignmentId);
    console.log(`Solution for assignment ${assignmentId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    // Check if we should trigger orchestration
    await checkAndTriggerOrchestration(assignmentId);
    
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