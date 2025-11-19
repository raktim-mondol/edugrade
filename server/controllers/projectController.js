const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose'); // Added mongoose for MongoDB connection check
const { Project } = require('../models/project');
// Fix: Import ProjectSubmission model properly
const ProjectSubmission = require('../models/projectSubmission');
const { processFileForGemini } = require('../utils/pdfExtractor');
const { processRubricPDF } = require('../utils/geminiService');
const { projectProcessingQueue, rubricProcessingQueue, JOB_TYPES } = require('../workers/projectProcessor');
const { isConnected } = require('../config/db');

// Helper function to update the evaluation readiness status of a project
async function updateProjectEvaluationReadiness(projectId) {
  try {
    const project = await Project.findById(projectId);
    if (!project) {
      console.error(`Project not found: ${projectId}`);
      return 'not_ready';
    }

    // Check if the primary project is processed
    if (project.processingStatus !== 'completed') {
      project.evaluationReadyStatus = 'not_ready';
      await project.save();
      return 'not_ready';
    }

    // Check rubric status - required for evaluation
    if (project.rubricFile && project.rubricProcessingStatus !== 'completed') {
      project.evaluationReadyStatus = 'not_ready';
      await project.save();
      return 'not_ready';
    }

    // Check if rubric is not provided but required
    if (!project.rubricFile) {
      // Set as partial since no rubric is provided
      project.evaluationReadyStatus = 'partial';
      await project.save();
      return 'partial';
    }

    // Everything is processed and ready for evaluation
    project.evaluationReadyStatus = 'ready';
    await project.save();
    console.log(`Project ${projectId} is now ready for evaluation`);
    return 'ready';
  } catch (error) {
    console.error(`Error updating project evaluation readiness for ${projectId}:`, error);
    return 'not_ready';
  }
}

// Create a new project
exports.createProject = async (req, res) => {
  console.log('[projectController] Entering createProject'); // Log entry
  try {
    console.log('[projectController] Request Body:', req.body); // Log body
    console.log('[projectController] Request Files:', req.files); // Log files

    // Check for MongoDB connection
    if (!isConnected()) {
      console.error('[projectController] MongoDB is not connected. readyState:', mongoose.connection?.readyState);
      return res.status(500).json({ 
        error: 'Database connection error. Please ensure MongoDB is running and try again.' 
      });
    }

    const {
      title, description, course, dueDate, totalPoints,
      isGroupProject, maxGroupSize, requiredFiles, evaluationSections,
      codeRequired, reportRequired
    } = req.body;

    // Validate required fields
    if (!title || !description || !course) {
      console.error('[projectController] Validation Error: Required fields missing');
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Check if files are uploaded using Multer middleware
    const projectDetailsFile = req.files?.projectDetails?.[0]; // Adjusted for Multer
    const rubricFile = req.files?.rubric?.[0]; // Adjusted for Multer

    if (!projectDetailsFile) {
      console.error('[projectController] Validation Error: Project details document is required');
      return res.status(400).json({ error: 'Project details document is required' });
    }
    console.log('[projectController] Project Details File Info:', projectDetailsFile);
    if (rubricFile) {
      console.log('[projectController] Rubric File Info:', rubricFile);
    } else {
      console.log('[projectController] No Rubric File provided.');
    }

    // File paths are already handled by Multer's storage configuration.
    // We just need the paths stored by Multer.
    const projectFilePath = projectDetailsFile.path;
    let rubricFilePath = rubricFile ? rubricFile.path : null;

    console.log('[projectController] Project Details Path:', projectFilePath);
    if (rubricFilePath) {
      console.log('[projectController] Rubric Path:', rubricFilePath);
    }

    // Get userId from authenticated request
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Make sure directory exists for project files
    try {
      const dirPath = path.dirname(projectFilePath);
      await fs.mkdir(dirPath, { recursive: true });
    } catch (dirError) {
      console.error('[projectController] Error ensuring directory exists:', dirError);
      // Continue if directory already exists
    }

    // Create new Project instance
    const project = new Project({
      userId,
      title,
      description,
      course,
      dueDate,
      totalPoints: totalPoints || 100, // Default if not provided
      isGroupProject: isGroupProject === 'true',
      maxGroupSize: maxGroupSize || 1,
      // Assuming requiredFiles and evaluationSections are sent as JSON strings
      requiredFiles: requiredFiles ? JSON.parse(requiredFiles) : [],
      evaluationSections: evaluationSections ? JSON.parse(evaluationSections) : [],
      codeRequired: codeRequired === 'true',
      reportRequired: reportRequired === 'true',
      projectFile: projectFilePath,
      rubricFile: rubricFilePath,
      // Initial processing statuses
      processingStatus: 'pending',
      rubricProcessingStatus: rubricFilePath ? 'pending' : 'not_applicable',
      evaluationReadyStatus: 'not_ready' // Initial status
    });

    console.log('[projectController] Project object created:', project);

    // Save project to database
    try {
      await project.save();
      console.log('[projectController] Project saved successfully:', project._id);
    } catch (dbError) {
      console.error('[projectController] Error saving project to database:', dbError);
      // Consider cleaning up uploaded files if DB save fails
      // await fs.unlink(projectFilePath).catch(e => console.error("Error cleaning up project file:", e));
      // if (rubricFilePath) await fs.unlink(rubricFilePath).catch(e => console.error("Error cleaning up rubric file:", e));
      return res.status(500).json({ error: 'Failed to save project data.', details: dbError.message });
    }

    // Call readiness update (might be better to do this after potential rubric processing starts)
    try {
      await updateProjectEvaluationReadiness(project._id);
      console.log('[projectController] Project evaluation readiness updated for:', project._id);
    } catch (readinessError) {
      console.error('[projectController] Error updating project readiness:', readinessError);
      // Continue, but log the error
    }

    // Process the project file with direct Gemini processing
    try {
      const processResult = await processFileForGemini(projectFilePath);
      if (processResult.success) {
        await projectProcessingQueue.add(JOB_TYPES.PROCESS_PROJECT_FILE, {
          projectId: project._id,
          filePath: processResult.filePath,
          originalPath: processResult.originalPath,
          fileType: processResult.fileType,
          title: project.title,
          description: project.description
        });
        console.log('[projectController] Project details queued for processing:', project._id);
      } else {
        throw new Error(`File processing failed: ${processResult.error}`);
      }
    } catch (projectError) {
      console.error(`[projectController] Error extracting text from project PDF ${projectFilePath}:`, projectError);
      project.processingStatus = 'failed';
      project.processingError = 'Error extracting text or queueing project.';
      await project.save();
    }

    // Process rubric if available
    if (rubricFilePath) {
      try {
        await rubricProcessingQueue.add(JOB_TYPES.PROCESS_RUBRIC_FILE, {
          projectId: project._id,
          pdfFilePath: rubricFilePath,
          totalPoints: project.totalPoints
        });
        console.log('[projectController] Rubric queued for PDF processing:', project._id);
              } catch (rubricError) {
          console.error(`[projectController] Error queueing rubric PDF ${rubricFilePath}:`, rubricError);
          project.rubricProcessingStatus = 'failed';
          project.rubricProcessingError = 'Error queueing rubric for processing.';
          await project.save();
        }
    }

    console.log('[projectController] Sending success response');
    res.status(201).json({
      message: 'Project created successfully and queued for processing',
      project
    });

  } catch (error) {
    console.error('[projectController] Unhandled error in createProject:', error); // Log the full error
    // Ensure response is sent even if unexpected error occurs
    if (!res.headersSent) {
       res.status(500).json({ error: 'An unexpected internal server error occurred.', details: error.message });
    }
  }
};

// Get all projects
exports.getProjects = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const projects = await Project.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ projects });
  } catch (error) {
    console.error('Error retrieving projects:', error);
    res.status(500).json({ error: 'An error occurred while retrieving projects' });
  }
};

// Get project by ID
exports.getProjectById = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }

    res.status(200).json({ project });
  } catch (error) {
    console.error('Error retrieving project:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the project' });
  }
};

// Update project
exports.updateProject = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { id } = req.params;
    const {
      title, description, course, dueDate, totalPoints,
      isGroupProject, maxGroupSize, requiredFiles, evaluationSections,
      codeRequired, reportRequired
    } = req.body;

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }

    // Parse evaluation sections if provided as string
    let parsedEvaluationSections = project.evaluationSections;
    try {
      if (evaluationSections) {
        parsedEvaluationSections = typeof evaluationSections === 'string' 
          ? JSON.parse(evaluationSections) 
          : evaluationSections;
      }
    } catch (error) {
      console.warn('Failed to parse evaluation sections:', error);
    }

    // Parse required files if provided as string
    let parsedRequiredFiles = project.requiredFiles;
    try {
      if (requiredFiles) {
        const fileReqs = typeof requiredFiles === 'string' 
          ? JSON.parse(requiredFiles) 
          : requiredFiles;
        
        parsedRequiredFiles = {
          ...parsedRequiredFiles,
          ...fileReqs
        };
      }
    } catch (error) {
      console.warn('Failed to parse required files:', error);
    }

    // Update fields
    project.title = title || project.title;
    project.description = description || project.description;
    project.course = course || project.course;
    project.dueDate = dueDate || project.dueDate;
    project.isGroupProject = isGroupProject !== undefined ? 
      isGroupProject === 'true' || isGroupProject === true : 
      project.isGroupProject;
    project.maxGroupSize = maxGroupSize || project.maxGroupSize;
    project.totalPoints = totalPoints || project.totalPoints;
    project.evaluationSections = parsedEvaluationSections;
    project.requiredFiles = parsedRequiredFiles;
    project.codeRequired = codeRequired !== undefined ? 
      codeRequired === 'true' || codeRequired === true : 
      project.codeRequired;
    project.reportRequired = reportRequired !== undefined ? 
      reportRequired === 'true' || reportRequired === true : 
      project.reportRequired;

    // Handle file updates if provided with multer
    if (req.files && req.files.projectDetails && req.files.projectDetails.length > 0) {
      // With multer, file is already saved to disk. We just need the path.
      const projectDetailsFile = req.files.projectDetails[0];
      const projectDetailsFilePath = projectDetailsFile.path;
      
      // Delete old file if it exists
      if (project.projectFile) {
        try {
          await fs.unlink(project.projectFile);
          console.log('Deleted old project file:', project.projectFile);
        } catch (err) {
          console.error('Error deleting old project details file:', err);
        }
      }
      
      // Update project with new file path
      project.projectFile = projectDetailsFilePath;
      project.processingStatus = 'pending';
      
      // Queue project processing (using direct file processing for Gemini)
      try {
        const processResult = await processFileForGemini(projectDetailsFilePath);
        if (processResult.success) {
          await projectProcessingQueue.add(JOB_TYPES.PROCESS_PROJECT_FILE, {
            projectId: project._id,
            filePath: processResult.filePath,
            originalPath: processResult.originalPath,
            fileType: processResult.fileType,
            title: project.title,
            description: project.description
          });
          console.log('Updated project details queued for processing:', project._id);
        } else {
          throw new Error(`File processing failed: ${processResult.error}`);
        }
      } catch (error) {
        console.error('Error queueing updated project details for processing:', error);
        project.processingStatus = 'failed';
        project.processingError = 'Error queueing updated project details for processing';
      }
    }

    // Handle rubric file update if provided
    if (req.files && req.files.rubric && req.files.rubric.length > 0) {
      // With multer, file is already saved to disk. We just need the path.
      const rubricFile = req.files.rubric[0];
      const rubricFilePath = rubricFile.path;
      
      // Delete old file if it exists
      if (project.rubricFile) {
        try {
          await fs.unlink(project.rubricFile);
          console.log('Deleted old rubric file:', project.rubricFile);
        } catch (err) {
          console.error('Error deleting old rubric file:', err);
        }
      }
      
      // Update project with new file path
      project.rubricFile = rubricFilePath;
      project.rubricProcessingStatus = 'pending';
      
      // Queue rubric processing
      try {
        const processResult = await processFileForGemini(rubricFilePath);
        if (processResult.success) {
          await rubricProcessingQueue.add(JOB_TYPES.PROCESS_RUBRIC_FILE, {
            projectId: project._id,
            pdfFilePath: processResult.filePath,
            originalPath: processResult.originalPath,
            fileType: processResult.fileType,
            totalPoints: project.totalPoints
          });
          console.log('Updated rubric queued for processing:', project._id);
        } else {
          throw new Error(`File processing failed: ${processResult.error}`);
        }
      } catch (error) {
        console.error('Error queueing updated rubric for processing:', error);
        project.rubricProcessingStatus = 'failed';
        project.rubricProcessingError = 'Error queueing updated rubric for processing';
      }
    }

    // Save the updated project
    await project.save();
    
    // Update evaluation readiness status
    await updateProjectEvaluationReadiness(project._id);

    res.status(200).json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'An error occurred while updating the project: ' + error.message });
  }
};

// Delete project
exports.deleteProject = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { id } = req.params;

    // Validate that id is present and not "undefined"
    if (!id || id === "undefined") {
      console.error('Invalid project ID provided for deletion:', id);
      return res.status(400).json({ error: 'Invalid project ID provided' });
    }

    // Validate that id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.error('Invalid MongoDB ObjectId format for deletion:', id);
      return res.status(400).json({ error: 'Invalid project ID format' });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }
    
    console.log(`Deleting project: ${project._id} - ${project.title}`);
    
    // Delete associated files
    if (project.projectFile) {
      try {
        await fs.unlink(project.projectFile);
        console.log(`Deleted project details file: ${project.projectFile}`);
      } catch (fileError) {
        console.error(`Error deleting project details file: ${fileError}`);
        // Continue with deletion even if file removal fails
      }
    }
    
    if (project.rubricFile) {
      try {
        await fs.unlink(project.rubricFile);
        console.log(`Deleted rubric file: ${project.rubricFile}`);
      } catch (fileError) {
        console.error(`Error deleting rubric file: ${fileError}`);
        // Continue with deletion even if file removal fails
      }
    }
    
    // Try to delete project submissions using multiple approaches for robust error handling
    try {
      console.log(`Attempting to find and delete submissions for project: ${id}`);
      
      // Get a reference to the ProjectSubmission model using the imported model or through mongoose
      let submissionModel;
      
      // First try with the imported model
      if (ProjectSubmission) {
        console.log('Using imported ProjectSubmission model');
        submissionModel = ProjectSubmission;
      } 
      // Then try with mongoose models registry
      else {
        try {
          console.log('Trying to get ProjectSubmission model from mongoose registry');
          submissionModel = mongoose.model('ProjectSubmission');
        } catch (modelError) {
          console.error('Failed to get ProjectSubmission model from registry:', modelError);
          // We'll continue without the model, just deleting the project
        }
      }
      
      // Only proceed with submission deletion if we have a valid model
      if (submissionModel) {
        // Delete submissions directly from MongoDB if model is available
        const deleteResult = await submissionModel.deleteMany({ projectId: id });
        console.log(`Deleted ${deleteResult.deletedCount} submissions for project ${id}`);
      } else {
        console.warn('Skipping submission deletion - ProjectSubmission model not available');
      }
    } catch (submissionError) {
      console.error(`Error handling submissions for project ${id}:`, submissionError);
      // Continue with project deletion even if submission deletion fails
    }
    
    // Delete the project
    await Project.findByIdAndDelete(id);
    console.log(`Deleted project record: ${id}`);
    
    res.status(200).json({
      success: true,
      message: 'Project and all associated submissions deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: `An error occurred while deleting the project: ${error.message}` });
  }
};

// Get project processing status
exports.getProjectStatus = async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const { id } = req.params;

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Verify ownership
    if (project.userId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not own this project.' });
    }
    
    // Get status information
    const status = {
      projectId: project._id,
      processingStatus: project.processingStatus,
      rubricProcessingStatus: project.rubricProcessingStatus,
      evaluationReadyStatus: project.evaluationReadyStatus,
      processingError: project.processingError,
      rubricProcessingError: project.rubricProcessingError,
      processingStartedAt: project.processingStartedAt,
      processingCompletedAt: project.processingCompletedAt,
      rubricProcessingStartedAt: project.rubricProcessingStartedAt,
      rubricProcessingCompletedAt: project.rubricProcessingCompletedAt
    };
    
    res.status(200).json(status);
  } catch (error) {
    console.error('Error retrieving project status:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the project status' });
  }
};