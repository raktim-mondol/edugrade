/**
 * Utility functions for assignments
 */
const { Assignment } = require('../models/assignment');

/**
 * Check and update the evaluation readiness status of an assignment
 * This determines if an assignment is ready for evaluation based on all required documents being processed
 * 
 * @param {string} assignmentId - The ID of the assignment to check
 * @returns {Promise<string>} - The updated evaluation ready status
 */
async function updateAssignmentEvaluationReadiness(assignmentId) {
  try {
    // Find the assignment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      console.error(`Assignment not found: ${assignmentId}`);
      return 'not_ready';
    }

    // Check if the primary assignment is processed
    if (assignment.processingStatus !== 'completed') {
      assignment.evaluationReadyStatus = 'not_ready';
      await assignment.save();
      return 'not_ready';
    }

    // Check rubric status - required for evaluation
    // Rubric is considered available if:
    // 1. There's a separate rubric file that's been processed, OR
    // 2. A rubric has been extracted from the assignment PDF
    const hasRubricFromFile = assignment.rubricFile && assignment.rubricProcessingStatus === 'completed';
    const hasRubricFromAssignment = assignment.rubricExtractionSource === 'assignment_pdf' && assignment.rubricProcessingStatus === 'completed';
    
    if (!hasRubricFromFile && !hasRubricFromAssignment) {
      assignment.evaluationReadyStatus = 'not_ready';
      await assignment.save();
      return 'not_ready';
    }

    // Check solution status - not strictly required but helpful
    if (assignment.solutionFile && assignment.solutionProcessingStatus !== 'completed') {
      // Set as partial if assignment and rubric are ready but solution is still processing
      assignment.evaluationReadyStatus = 'partial';
      await assignment.save();
      return 'partial';
    }

    // Everything is processed and ready for evaluation
    assignment.evaluationReadyStatus = 'ready';
    await assignment.save();
    console.log(`Assignment ${assignmentId} is now ready for evaluation`);
    return 'ready';
  } catch (error) {
    console.error(`Error updating assignment evaluation readiness for ${assignmentId}:`, error);
    return 'not_ready';
  }
}

module.exports = {
  updateAssignmentEvaluationReadiness
};