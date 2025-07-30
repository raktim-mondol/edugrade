/**
 * Script to check DeepSeek processing results for assignments, rubrics, and solutions
 * Run with: node check-deepseek.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

// Use the centralized database connection
const { connectDB } = require('./config/db');

// Import the Assignment model
const Assignment = mongoose.model('Assignment', require('./models/assignment').assignmentSchema);

async function checkGeminiProcessing() {
  try {
    // Connect to the database
    await connectDB();
    
    // Find the most recent assignment
    const assignment = await Assignment.findOne().sort({ createdAt: -1 });
    
    if (!assignment) {
      console.log('No assignments found in database');
      return;
    }
    
    console.log('==== ASSIGNMENT INFO ====');
    console.log('Title:', assignment.title);
    console.log('Description:', assignment.description);
    console.log('Created At:', assignment.createdAt);
    console.log('ID:', assignment._id);
    
    // Check processing status for all three PDFs
    console.log('\n==== PROCESSING STATUS ====');
    console.log('Assignment:', assignment.processingStatus);
    console.log('Rubric:', assignment.rubricProcessingStatus);
    console.log('Solution:', assignment.solutionProcessingStatus);
    
    // Check if there were any processing errors
    console.log('\n==== PROCESSING ERRORS (if any) ====');
    if (assignment.processingError) console.log('Assignment Processing Error:', assignment.processingError);
    if (assignment.rubricProcessingError) console.log('Rubric Processing Error:', assignment.rubricProcessingError);
    if (assignment.solutionProcessingError) console.log('Solution Processing Error:', assignment.solutionProcessingError);
    
    // Show assignment important fields
    console.log('\n==== ASSIGNMENT CORE FIELDS ====');
    console.log('Total Points:', assignment.totalPoints);
    console.log('Question Structure:', JSON.stringify(assignment.questionStructure, null, 2));
    
    // Show assignment processed data
    console.log('\n==== ASSIGNMENT PROCESSED DATA ====');
    if (assignment.processedData) {
      console.log(JSON.stringify(assignment.processedData, null, 2));
    } else {
      console.log('No processed assignment data available');
    }
    
    // Show rubric processed data
    console.log('\n==== RUBRIC PROCESSED DATA ====');
    if (assignment.processedRubric) {
      console.log(JSON.stringify(assignment.processedRubric, null, 2));
      
      // Specifically highlight total points in the rubric
      if (assignment.processedRubric.total_points) {
        console.log('\n==== RUBRIC TOTAL POINTS ====');
        console.log('Rubric total_points:', assignment.processedRubric.total_points);
      }
    } else {
      console.log('No processed rubric data available');
    }
    
    // Show solution processed data
    console.log('\n==== SOLUTION PROCESSED DATA ====');
    if (assignment.processedSolution) {
      console.log(JSON.stringify(assignment.processedSolution, null, 2));
    } else {
      console.log('No processed solution data available');
    }
    
  } catch (error) {
    console.error('Error checking DeepSeek processing:', error);
  } finally {
    // Close the database connection
    try {
      await mongoose.connection.close();
      console.log('\nDatabase connection closed');
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Run the function
checkGeminiProcessing();