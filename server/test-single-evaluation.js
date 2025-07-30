/**
 * Simple script to test evaluation of a single student submission
 * Shows exactly what Gemini API receives and responds with
 */

require('dotenv').config();
const { Assignment } = require('./models/assignment');
const { evaluateSubmission } = require('./utils/geminiService');
const mongoose = require('mongoose');

async function testSingleEvaluation() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/edugrade');
    console.log('Connected to database');

    // Find the most recent assignment
    const assignment = await Assignment.findOne({}).sort({ createdAt: -1 });
    
    if (!assignment) {
      console.log('No assignments found in database');
      return;
    }

    console.log('\n=== TESTING EVALUATION FOR ASSIGNMENT ===');
    console.log(`Assignment: ${assignment.title}`);
    console.log(`Assignment ID: ${assignment._id}`);
    console.log(`Processing Status: ${assignment.processingStatus}`);
    console.log(`Rubric Status: ${assignment.rubricProcessingStatus}`);
    console.log(`Solution Status: ${assignment.solutionProcessingStatus}`);

    // Check if assignment is ready for evaluation
    if (assignment.processingStatus !== 'completed') {
      console.log('\nAssignment is not fully processed yet. Status:', assignment.processingStatus);
      return;
    }

    // Show processed data
    console.log('\n--- ASSIGNMENT PROCESSED DATA ---');
    if (assignment.processedData) {
      console.log('Assignment data available:', Object.keys(assignment.processedData));
      console.log('Title:', assignment.processedData.title);
      console.log('Questions count:', assignment.processedData.questions ? assignment.processedData.questions.length : 0);
    }

    console.log('\n--- RUBRIC PROCESSED DATA ---');
    if (assignment.processedRubric) {
      console.log('Rubric data available:', Object.keys(assignment.processedRubric));
      console.log('Criteria count:', assignment.processedRubric.grading_criteria ? assignment.processedRubric.grading_criteria.length : 0);
      console.log('Total points:', assignment.processedRubric.total_points);
    }

    console.log('\n--- SOLUTION PROCESSED DATA ---');
    if (assignment.processedSolution) {
      console.log('Solution data available:', Object.keys(assignment.processedSolution));
      console.log('Solution questions count:', assignment.processedSolution.questions ? assignment.processedSolution.questions.length : 0);
    }

    // Test with a sample submission file (you can change this path)
    const testSubmissionPath = './uploads/submissions/1743180125908-hw1.pdf';
    const fs = require('fs');
    
    if (!fs.existsSync(testSubmissionPath)) {
      console.log(`\nTest submission file not found: ${testSubmissionPath}`);
      console.log('Available submission files:');
      if (fs.existsSync('./uploads/submissions')) {
        const files = fs.readdirSync('./uploads/submissions');
        files.forEach(file => console.log(`  ${file}`));
        if (files.length > 0) {
          const firstFile = './uploads/submissions/' + files[0];
          console.log(`\nUsing first available file: ${firstFile}`);
          await performEvaluation(assignment, firstFile);
        }
      }
    } else {
      await performEvaluation(assignment, testSubmissionPath);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

async function performEvaluation(assignment, submissionPath) {
  console.log(`\n=== EVALUATING SUBMISSION: ${submissionPath} ===`);
  
  try {
    const evaluationResult = await evaluateSubmission(
      assignment.processedData,
      assignment.processedRubric,
      assignment.processedSolution,
      submissionPath,
      'test-student-debug'
    );

    console.log('\n=== EVALUATION COMPLETED ===');
    console.log('Overall Grade:', evaluationResult.overallGrade);
    console.log('Total Possible:', evaluationResult.totalPossible);
    console.log('Criteria Grades Count:', evaluationResult.criteriaGrades ? evaluationResult.criteriaGrades.length : 0);
    console.log('Strengths Count:', evaluationResult.strengths ? evaluationResult.strengths.length : 0);
    console.log('Areas for Improvement Count:', evaluationResult.areasForImprovement ? evaluationResult.areasForImprovement.length : 0);

    // Show detailed results
    console.log('\n--- DETAILED EVALUATION RESULTS ---');
    console.log(JSON.stringify(evaluationResult, null, 2));

  } catch (error) {
    console.error('Evaluation failed:', error);
  }
}

// Show instructions
console.log('=== GEMINI EVALUATION DEBUGGING SCRIPT ===');
console.log('This script will:');
console.log('1. Find the latest assignment in your database');
console.log('2. Show all the processed data that will be sent to Gemini');
console.log('3. Evaluate a test submission and show the complete workflow');
console.log('4. Display all debug information including prompts and responses');
console.log('\nMake sure you have:');
console.log('- GEMINI_API_KEY in your .env file');
console.log('- MongoDB running and accessible');
console.log('- At least one processed assignment in the database');
console.log('=====================================================\n');

testSingleEvaluation();
