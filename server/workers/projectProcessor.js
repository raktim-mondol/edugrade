/**
 * Project Document Processor
 * Processes project documents using Gemini API
 */
const { Project } = require('../models/project');
const { processRubricPDF } = require('../utils/geminiService');
const { processFileForGemini } = require('../utils/pdfExtractor');
const { updateProjectEvaluationReadiness } = require('../utils/projectUtils');
const mongoose = require('mongoose');

// Import the correct queue objects from the configuration
const { 
  assignmentProcessingQueue: projectProcessingQueue, 
  rubricProcessingQueue 
} = require('../config/queue');

// Define job types
const JOB_TYPES = {
  PROCESS_PROJECT_FILE: 'processProjectFile',
  PROCESS_RUBRIC_FILE: 'processRubricFile'
};

// Process project files from the queue
projectProcessingQueue.process(JOB_TYPES.PROCESS_PROJECT_FILE, async (job) => {
  console.log(`Processing project file job ${job.id}`);
  
  const { projectId, filePath, originalPath, fileType } = job.data;
  
  // Validate projectId is a non-empty string
  if (!projectId || typeof projectId !== 'string' || projectId === 'undefined') {
    throw new Error('Invalid or missing projectId for project file processing');
  }
  
  // Validate filePath
  if (!filePath) {
    throw new Error('Missing file path for project file processing');
  }
  
  try {
    // Update processing status to in-progress
    await Project.findByIdAndUpdate(projectId, {
      processingStatus: 'processing',
      processingStartedAt: new Date()
    });
    
    // Store the file paths for direct Gemini processing
    // For projects, we store the file information for later Gemini processing
    const processedData = {
      title: job.data.title || 'Project',
      description: job.data.description || 'Project description',
      filePath: filePath,
      originalPath: originalPath,
      fileType: fileType
    };
    
    // Update the project in the database with the processed data
    await Project.findByIdAndUpdate(projectId, {
      processedData,
      processingStatus: 'completed',
      processingCompletedAt: new Date()
    });
    
    // Check if the project is now ready for evaluation
    const readyStatus = await updateProjectEvaluationReadiness(projectId);
    console.log(`Project ${projectId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    return { success: true, projectId, processedData, readyStatus };
  } catch (error) {
    console.error(`Error processing project ${projectId}:`, error);
    
    // Update the project status to failed
    await Project.findByIdAndUpdate(projectId, {
      processingStatus: 'failed',
      processingError: error.message
    });
    
    throw error;
  }
});

// Process rubric files from the queue
rubricProcessingQueue.process(JOB_TYPES.PROCESS_RUBRIC_FILE, async (job) => {
  console.log(`Processing rubric job ${job.id}`);
  
  const { projectId, pdfFilePath, totalPoints } = job.data;
  
  // Validate projectId is a non-empty string
  if (!projectId || typeof projectId !== 'string' || projectId === 'undefined') {
    throw new Error('Invalid or missing projectId for rubric processing');
  }
  
  // Validate other required data
  if (!pdfFilePath) {
    throw new Error('Missing PDF file path for rubric processing');
  }
  
  try {
    // Update processing status to in-progress
    await Project.findByIdAndUpdate(projectId, {
      rubricProcessingStatus: 'processing',
      rubricProcessingStartedAt: new Date()
    });

    // Process the rubric document PDF using Gemini API
    const processedRubric = await processRubricPDF(pdfFilePath, totalPoints);
    
    // Update the project in the database with the processed rubric
    await Project.findByIdAndUpdate(projectId, {
      processedRubric,
      rubricProcessingStatus: 'completed',
      rubricProcessingCompletedAt: new Date()
    });
    
    // Check if the project is now ready for evaluation
    const readyStatus = await updateProjectEvaluationReadiness(projectId);
    console.log(`Rubric for project ${projectId} processed successfully. Evaluation ready status: ${readyStatus}`);
    
    return { success: true, projectId, processedRubric, readyStatus };
  } catch (error) {
    console.error(`Error processing rubric for project ${projectId}:`, error);
    
    // Update the project status to failed
    await Project.findByIdAndUpdate(projectId, {
      rubricProcessingStatus: 'failed',
      rubricProcessingError: error.message
    });
    
    throw error;
  }
});

console.log('Project processor worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Project processor shutting down');
  await projectProcessingQueue.close();
  await rubricProcessingQueue.close();
  process.exit(0);
});

module.exports = {
  projectProcessingQueue,
  rubricProcessingQueue,
  JOB_TYPES
};