const { Assignment } = require('../models/assignment');
const fs = require('fs').promises;
const path = require('path');
const { extractTextFromPDF } = require('../utils/pdfExtractor');
const {
  assignmentProcessingQueue,
  rubricProcessingQueue,
  solutionProcessingQueue,
  orchestrationQueue
} = require('../config/queue');
const { isConnected } = require('../config/db');
const { getUserId, isAuthenticated, verifyOwnership } = require('../utils/authHelper');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');
const { getCache, setCache, deleteCache, cacheKeys, isRedisConnected } = require('../config/redis');

// Create a new assignment
exports.createAssignment = async (req, res) => {
  console.log('📥 [API] POST /api/assignments - Creating new assignment');
  console.log(`   Request body keys: ${Object.keys(req.body).join(', ')}`);
  console.log(`   Files uploaded: ${req.files ? Object.keys(req.files).join(', ') : 'none'}`);

  // Wrap the entire function body in a try...catch block for better top-level error handling
  try {
    // Check database connection first
    if (!isConnected()) {
      console.error('Database is not connected');
      return res.status(500).json({ 
        error: 'Database connection error. Please ensure MongoDB is running and try again.' 
      });
    }
    
    const { title, description, dueDate, course, totalPoints, questionStructure, sections, assignmentText } = req.body;

    // Get file paths
    const assignmentFilePath = req.files?.assignment?.[0]?.path;
    const rubricFilePath = req.files?.rubric?.[0]?.path;
    const solutionFilePath = req.files?.solution?.[0]?.path;

    // Either assignment file or assignment text is required
    if (!assignmentFilePath && !assignmentText) {
      console.error('Validation Error: Assignment file or text is required');
      return res.status(400).json({ error: 'Assignment file or text is required' });
    }

    // Parse question structure if provided
    let parsedQuestionStructure = [];
    try {
      if (questionStructure) {
        parsedQuestionStructure = JSON.parse(questionStructure);
      }
    } catch (error) {
      console.warn('Failed to parse question structure JSON:', questionStructure, error);
    }

    // Parse sections if provided
    let parsedSections = [];
    try {
      if (sections) {
        if (typeof sections === 'string') {
          parsedSections = JSON.parse(sections);
          if (!Array.isArray(parsedSections)) {
             console.warn('Parsed sections is not an array:', parsedSections);
             parsedSections = [];
          }
        } else {
           console.warn('Sections data received is not a string:', sections);
        }
      }
    } catch (error) {
      console.warn('Failed to parse sections JSON:', sections, error);
    }

    // Get userId from authenticated request
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const userId = getUserId(req);

    // Create new assignment document
    const assignment = new Assignment({
      userId,
      title,
      description,
      dueDate,
      course,
      totalPoints: totalPoints || 100,
      questionStructure: parsedQuestionStructure,
      sections: parsedSections,
      assignmentFile: assignmentFilePath,
      assignmentText: assignmentText || '',
      rubricFile: rubricFilePath,
      solutionFile: solutionFilePath,
      processingStatus: 'pending',
      rubricProcessingStatus: rubricFilePath ? 'pending' : 'pending', // Will extract from assignment if no separate file
      solutionProcessingStatus: solutionFilePath ? 'pending' : 'not_applicable',
      rubricExtractionSource: rubricFilePath ? 'separate_file' : 'not_available' // Will be updated during processing
    });

    // Save assignment to database
    try {
       await assignment.save();
       console.log('Assignment saved successfully:', assignment._id);
    } catch (dbError) {
       console.error('Error saving assignment to database:', dbError);
       return res.status(500).json({ error: 'Failed to save assignment data.' });
    }

    // Process assignment (PDF or text) with Gemini and queue jobs
    try {
      // Queue assignment for processing
      console.log('📋 Queueing assignment for processing...');
      const job = await assignmentProcessingQueue.createJob({
        assignmentId: assignment._id,
        pdfFilePath: assignmentFilePath || null,
        assignmentText: assignmentText || null,
        questionStructure: parsedQuestionStructure,
        totalPoints: assignment.totalPoints
      }).save();

      console.log(`✅ Assignment queued for ${assignmentFilePath ? 'PDF' : 'text'} processing:`, assignment._id);
      console.log(`   Job ID: ${job?.id || 'unknown'}`);

      // Process rubric if available
      if (rubricFilePath) {
        try {
          await rubricProcessingQueue.createJob({
            assignmentId: assignment._id,
            pdfFilePath: rubricFilePath,
            questionStructure: parsedQuestionStructure,
            totalPoints: assignment.totalPoints
          }).save();
          console.log('Rubric queued for PDF processing:', assignment._id);
                 } catch (rubricError) {
           console.error(`Error queueing rubric PDF ${rubricFilePath}:`, rubricError);
           assignment.rubricProcessingStatus = 'failed';
           assignment.rubricProcessingError = 'Error queueing rubric for processing.';
           await assignment.save();
        }
      }

      // Process solution if available
      if (solutionFilePath) {
         try {
            await solutionProcessingQueue.createJob({
              assignmentId: assignment._id,
              pdfFilePath: solutionFilePath,
              questionStructure: parsedQuestionStructure,
              totalPoints: assignment.totalPoints
            }).save();
            console.log('Solution queued for PDF processing:', assignment._id);
         } catch (solutionError) {
            console.error(`Error queueing solution PDF ${solutionFilePath}:`, solutionError);
            assignment.solutionProcessingStatus = 'failed';
            assignment.solutionProcessingError = 'Error queueing solution for processing.';
            await assignment.save();
         }
      }

    } catch (processingError) {
      console.error('Error during PDF processing job queueing:', processingError);

      assignment.processingStatus = 'failed';
      assignment.processingError = 'Error queueing assignment PDF for processing.';

      if (rubricFilePath && assignment.rubricProcessingStatus === 'pending') {
        assignment.rubricProcessingStatus = 'failed';
        assignment.rubricProcessingError = 'Dependent assignment processing failed.';
      }
      if (solutionFilePath && assignment.solutionProcessingStatus === 'pending') {
        assignment.solutionProcessingStatus = 'failed';
        assignment.solutionProcessingError = 'Dependent assignment processing failed.';
      }

      try {
         await assignment.save();
      } catch (saveError) {
         console.error('Additionally failed to save error status after processing error:', saveError);
      }

      return res.status(500).json({ error: 'Failed to process uploaded files.' });
    }

    res.status(201).json({
      message: 'Assignment created successfully and queued for processing',
      assignment
    });

  } catch (error) {
    console.error('Unhandled error in createAssignment:', error);
    res.status(500).json({ error: 'An unexpected internal server error occurred.' });
  }
};

// Get all assignments
exports.getAssignments = async (req, res) => {
  try {
    // Get userId from authenticated request
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const userId = getUserId(req);

    // Filter assignments by userId
    const assignments = await Assignment.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ assignments });
  } catch (error) {
    console.error('Error retrieving assignments:', error);
    res.status(500).json({ error: 'An error occurred while retrieving assignments' });
  }
};

// Get a single assignment by ID
exports.getAssignmentById = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Verify ownership
    if (!verifyOwnership(assignment.userId, req)) {
      return res.status(403).json({ error: 'Access denied. You do not own this assignment.' });
    }

    res.status(200).json({ assignment });
  } catch (error) {
    console.error('Error retrieving assignment:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the assignment' });
  }
};

// Update an assignment
exports.updateAssignment = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { title, description, dueDate, course, totalPoints, questionStructure } = req.body;

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Verify ownership
    if (!verifyOwnership(assignment.userId, req)) {
      return res.status(403).json({ error: 'Access denied. You do not own this assignment.' });
    }
    
    // Parse question structure if provided
    let parsedQuestionStructure = assignment.questionStructure || [];
    try {
      if (questionStructure) {
        parsedQuestionStructure = JSON.parse(questionStructure);
      }
    } catch (error) {
      console.warn('Failed to parse question structure:', error);
    }
    
    // Update fields
    assignment.title = title || assignment.title;
    assignment.description = description || assignment.description;
    assignment.dueDate = dueDate || assignment.dueDate;
    assignment.course = course || assignment.course;
    assignment.totalPoints = totalPoints || assignment.totalPoints || 100;
    assignment.questionStructure = parsedQuestionStructure;
    
    // Handle file updates if provided
    if (req.files?.assignment?.[0]?.path) {
      // Delete old file if it exists
      if (assignment.assignmentFile) {
        try {
          await fs.unlink(assignment.assignmentFile);
        } catch (err) {
          console.error('Error deleting old assignment file:', err);
        }
      }
      
      // Set new file path
      const assignmentFilePath = req.files.assignment[0].path;
      assignment.assignmentFile = assignmentFilePath;
      assignment.processingStatus = 'pending';
      
      // Queue PDF for processing
      try {
        await assignmentProcessingQueue.createJob({
          assignmentId: assignment._id,
          pdfFilePath: assignmentFilePath,
          questionStructure: parsedQuestionStructure,
          totalPoints: totalPoints || assignment.totalPoints || 100
        }).save();
        
        console.log('Updated assignment queued for PDF processing:', assignment._id);
      } catch (error) {
        console.error('Error queueing updated assignment PDF:', error);
        assignment.processingStatus = 'failed';
        assignment.processingError = 'Error queueing updated assignment PDF for processing';
      }
    }
    
    // Similar handling for rubric file
    if (req.files?.rubric?.[0]?.path) {
      if (assignment.rubricFile) {
        try {
          await fs.unlink(assignment.rubricFile);
        } catch (err) {
          console.error('Error deleting old rubric file:', err);
        }
      }
      
      const rubricFilePath = req.files.rubric[0].path;
      assignment.rubricFile = rubricFilePath;
      assignment.rubricProcessingStatus = 'pending';
      
      try {
        await rubricProcessingQueue.createJob({
          assignmentId: assignment._id,
          pdfFilePath: rubricFilePath,
          questionStructure: parsedQuestionStructure,
          totalPoints: totalPoints || assignment.totalPoints || 100
        }).save();
        
        console.log('Updated rubric queued for PDF processing:', assignment._id);
      } catch (error) {
        console.error('Error queueing updated rubric PDF:', error);
        assignment.rubricProcessingStatus = 'failed';
        assignment.rubricProcessingError = 'Error queueing updated rubric PDF for processing';
      }
    }
    
    // Similar handling for solution file
    if (req.files?.solution?.[0]?.path) {
      if (assignment.solutionFile) {
        try {
          await fs.unlink(assignment.solutionFile);
        } catch (err) {
          console.error('Error deleting old solution file:', err);
        }
      }
      
      const solutionFilePath = req.files.solution[0].path;
      assignment.solutionFile = solutionFilePath;
      assignment.solutionProcessingStatus = 'pending';
      
      try {
        await solutionProcessingQueue.createJob({
          assignmentId: assignment._id,
          pdfFilePath: solutionFilePath,
          questionStructure: parsedQuestionStructure,
          totalPoints: totalPoints || assignment.totalPoints || 100
        }).save();
        
        console.log('Updated solution queued for PDF processing:', assignment._id);
      } catch (error) {
        console.error('Error queueing updated solution PDF:', error);
        assignment.solutionProcessingStatus = 'failed';
        assignment.solutionProcessingError = 'Error queueing updated solution PDF for processing';
      }
    }
    
    // Save the updated assignment
    await assignment.save();
    
    res.status(200).json({
      message: 'Assignment updated successfully',
      assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'An error occurred while updating the assignment' });
  }
};

// Delete an assignment
exports.deleteAssignment = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Verify ownership
    if (!verifyOwnership(assignment.userId, req)) {
      return res.status(403).json({ error: 'Access denied. You do not own this assignment.' });
    }
    
    // Delete associated files
    const filesToDelete = [
      assignment.assignmentFile,
      assignment.rubricFile,
      assignment.solutionFile
    ].filter(Boolean);
    
    for (const filePath of filesToDelete) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error(`Error deleting file ${filePath}:`, err);
      }
    }
    
    // Delete the assignment document
    await Assignment.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'An error occurred while deleting the assignment' });
  }
};

// Get the processing status of an assignment
exports.getProcessingStatus = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const assignmentId = req.params.id;
    const cacheKey = cacheKeys.assignmentStatus(assignmentId);

    // Try to get from cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      // Verify ownership from cached data
      if (!verifyOwnership(cachedData.userId, req)) {
        return res.status(403).json({ error: 'Access denied. You do not own this assignment.' });
      }
      // Return cached response (without userId)
      const { userId, ...responseData } = cachedData;
      return res.status(200).json(responseData);
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Verify ownership
    if (!verifyOwnership(assignment.userId, req)) {
      return res.status(403).json({ error: 'Access denied. You do not own this assignment.' });
    }

    // Build response data
    const responseData = {
      assignmentId: assignment._id,
      assignmentProcessingStatus: assignment.processingStatus,
      rubricProcessingStatus: assignment.rubricProcessingStatus,
      solutionProcessingStatus: assignment.solutionProcessingStatus,
      orchestrationStatus: assignment.orchestrationStatus || 'not_needed',
      processingError: assignment.processingError,
      rubricProcessingError: assignment.rubricProcessingError,
      solutionProcessingError: assignment.solutionProcessingError,
      orchestrationError: assignment.orchestrationError,
      evaluationReadyStatus: getEvaluationReadiness(assignment),
      processedData: assignment.processedData || null,
      processedRubric: assignment.processedRubric || null,
      processedSolution: assignment.processedSolution || null,
      orchestrationData: assignment.orchestratedData ? {
        completenessScore: assignment.orchestratedData.validation?.completenessScore || 0,
        isValid: assignment.orchestratedData.validation?.isValid || false,
        hasWarnings: assignment.orchestratedData.validation?.hasWarnings || false,
        issuesCount: assignment.orchestratedData.validation?.issues?.length || 0,
        recommendationsCount: assignment.orchestratedData.recommendations?.length || 0
      } : null,
      validationResults: assignment.validationResults || null,
      lastUpdated: assignment.updatedAt
    };

    // Cache the response (include userId for ownership verification)
    // Use shorter TTL (10s) if still processing, longer (60s) if complete
    const isProcessing = assignment.processingStatus === 'processing' ||
                         assignment.rubricProcessingStatus === 'processing' ||
                         assignment.solutionProcessingStatus === 'processing';
    const ttl = isProcessing ? 10 : 60;

    await setCache(cacheKey, { ...responseData, userId: assignment.userId }, ttl);

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error retrieving assignment processing status:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the assignment processing status' });
  }
};

// Helper to invalidate assignment cache (call after updates)
exports.invalidateAssignmentCache = async (assignmentId) => {
  await deleteCache(cacheKeys.assignmentStatus(assignmentId));
};

// Helper function to determine evaluation readiness
function getEvaluationReadiness(assignment) {
  if (assignment.processingStatus === 'failed') {
    return 'not_ready';
  }
  
  if (assignment.processingStatus === 'completed') {
    const rubricReady = assignment.rubricProcessingStatus === 'completed' || assignment.rubricProcessingStatus === 'not_applicable';
    const solutionReady = assignment.solutionProcessingStatus === 'completed' || assignment.solutionProcessingStatus === 'not_applicable';
    
    if (rubricReady && solutionReady) {
      // If orchestration is being used and completed, return ready
      // If orchestration failed, still return ready (it's optional for evaluation)
      // If orchestration is processing, return partial
      if (assignment.orchestrationStatus === 'processing') {
        return 'partial';
      }
      return 'ready';
    }
    return 'partial';
  }
  
  return 'not_ready';
}

// Re-run orchestration for an assignment
exports.rerunOrchestration = async (req, res) => {
  try {
    if (!isAuthenticated(req)) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const assignmentId = req.params.id;
    const { forceReread } = req.body; // Optional: force re-reading of files

    console.log(`Re-running orchestration for assignment ${assignmentId}`);
    console.log(`Force re-read files: ${forceReread || false}`);

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Verify ownership
    if (!verifyOwnership(assignment.userId, req)) {
      return res.status(403).json({ error: 'Access denied. You do not own this assignment.' });
    }
    
    // Check if all required processing is complete
    if (assignment.processingStatus !== 'completed') {
      return res.status(400).json({ 
        error: 'Assignment must be fully processed before re-running orchestration',
        currentStatus: assignment.processingStatus
      });
    }
    
    // Reset orchestration status and enable it
    await Assignment.findByIdAndUpdate(assignmentId, {
      orchestrationStatus: 'pending',  // Enable and reset to pending
      orchestrationError: null,
      orchestrationStartedAt: null,
      orchestrationCompletedAt: null
    });
    
    console.log(`Orchestration status set to pending (enabled) for assignment ${assignmentId}`);
    
    // Queue orchestration job with force re-read option
    await orchestrationQueue.createJob({
      assignmentId: assignmentId,
      forceReread: forceReread || false  // Pass flag to orchestration processor
    }).save();
    
    console.log(`Orchestration job queued for assignment ${assignmentId}`);
    
    res.status(200).json({ 
      message: 'Orchestration re-run initiated successfully',
      assignmentId: assignmentId,
      forceReread: forceReread || false
    });
    
  } catch (error) {
    console.error('Error re-running orchestration:', error);
    res.status(500).json({ 
      error: 'An error occurred while re-running orchestration',
      details: error.message 
    });
  }
};