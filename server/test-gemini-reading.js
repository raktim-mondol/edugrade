/**
 * Test script to verify Gemini API is reading PDF and HTML files correctly
 * This script will show detailed debug output of what Gemini sees
 */

require('dotenv').config();
const { 
  processAssignmentPDF, 
  processRubricPDF, 
  processSolutionPDF,
  evaluateSubmission 
} = require('./utils/geminiService');
const { processFileForGemini } = require('./utils/pdfExtractor');
const fs = require('fs');
const path = require('path');

async function testGeminiReading() {
  console.log('========================================');
  console.log('TESTING GEMINI API FILE READING');
  console.log('========================================\n');

  // Define test file paths - you can modify these to point to your actual files
  const testFiles = {
    assignmentPDF: './uploads/assignments/1753036014493-assignment_qa.pdf', // Latest assignment
    rubricPDF: './uploads/rubrics/1746587202110-comp3411_ass2_marking_guide.pdf', // Latest rubric
    solutionPDF: './uploads/solutions/1743340057729-solution.pdf', // Solution file
    studentSubmission: './uploads/submissions/1743180125908-hw1.pdf' // Student submission
  };

  try {
    console.log('=== STEP 1: TESTING ASSIGNMENT PDF PROCESSING ===\n');
    
    if (fs.existsSync(testFiles.assignmentPDF)) {
      console.log(`Processing assignment PDF: ${testFiles.assignmentPDF}`);
      const assignmentData = await processAssignmentPDF(testFiles.assignmentPDF);
      console.log('\n--- PROCESSED ASSIGNMENT DATA ---');
      console.log(JSON.stringify(assignmentData, null, 2));
    } else {
      console.log(`Assignment PDF not found: ${testFiles.assignmentPDF}`);
    }

    console.log('\n=== STEP 2: TESTING RUBRIC PDF PROCESSING ===\n');
    
    if (fs.existsSync(testFiles.rubricPDF)) {
      console.log(`Processing rubric PDF: ${testFiles.rubricPDF}`);
      const rubricData = await processRubricPDF(testFiles.rubricPDF, 100); // Assuming 100 total points
      console.log('\n--- PROCESSED RUBRIC DATA ---');
      console.log(JSON.stringify(rubricData, null, 2));
    } else {
      console.log(`Rubric PDF not found: ${testFiles.rubricPDF}`);
    }

    console.log('\n=== STEP 3: TESTING SOLUTION PDF PROCESSING ===\n');
    
    if (fs.existsSync(testFiles.solutionPDF)) {
      console.log(`Processing solution PDF: ${testFiles.solutionPDF}`);
      const solutionData = await processSolutionPDF(testFiles.solutionPDF);
      console.log('\n--- PROCESSED SOLUTION DATA ---');
      console.log(JSON.stringify(solutionData, null, 2));
    } else {
      console.log(`Solution PDF not found: ${testFiles.solutionPDF}`);
    }

    console.log('\n=== STEP 4: TESTING STUDENT SUBMISSION PROCESSING ===\n');
    
    if (fs.existsSync(testFiles.studentSubmission)) {
      console.log(`Processing student submission: ${testFiles.studentSubmission}`);
      const submissionResult = await processFileForGemini(testFiles.studentSubmission);
      console.log('\n--- SUBMISSION PROCESSING RESULT ---');
      console.log(JSON.stringify(submissionResult, null, 2));
    } else {
      console.log(`Student submission not found: ${testFiles.studentSubmission}`);
    }

    console.log('\n=== STEP 5: TESTING FULL EVALUATION WORKFLOW ===\n');
    
    // Test a complete evaluation if all files exist
    if (fs.existsSync(testFiles.assignmentPDF) && 
        fs.existsSync(testFiles.studentSubmission)) {
      
      console.log('Running complete evaluation workflow...');
      
      // Process all required files
      const assignmentData = await processAssignmentPDF(testFiles.assignmentPDF);
      
      let rubricData = null;
      if (fs.existsSync(testFiles.rubricPDF)) {
        rubricData = await processRubricPDF(testFiles.rubricPDF, 100);
      }
      
      let solutionData = null;
      if (fs.existsSync(testFiles.solutionPDF)) {
        solutionData = await processSolutionPDF(testFiles.solutionPDF);
      }
      
      // Evaluate the submission
      console.log('\nStarting evaluation with Gemini...');
      const evaluationResult = await evaluateSubmission(
        assignmentData, 
        rubricData, 
        solutionData, 
        testFiles.studentSubmission, 
        'test-student-001'
      );
      
      console.log('\n--- FINAL EVALUATION RESULT ---');
      console.log(JSON.stringify(evaluationResult, null, 2));
    } else {
      console.log('Cannot run full evaluation - missing required files');
    }

  } catch (error) {
    console.error('\nERROR during testing:', error);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n========================================');
  console.log('GEMINI API READING TEST COMPLETED');
  console.log('========================================');
}

// Function to list available test files
function listAvailableFiles() {
  console.log('\n=== AVAILABLE TEST FILES ===');
  
  const directories = [
    './uploads/assignments',
    './uploads/rubrics', 
    './uploads/solutions',
    './uploads/submissions'
  ];
  
  directories.forEach(dir => {
    console.log(`\n${dir}:`);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        console.log(`  ${file} (${stats.size} bytes)`);
      });
    } else {
      console.log('  Directory not found');
    }
  });
}

// Show usage instructions
function showUsage() {
  console.log('\n=== USAGE INSTRUCTIONS ===');
  console.log('1. Make sure your .env file has GEMINI_API_KEY set');
  console.log('2. Modify the testFiles object in this script to point to your actual files');
  console.log('3. Run: node test-gemini-reading.js');
  console.log('4. Check the detailed debug output to see what Gemini is reading');
  console.log('\nThe script will show:');
  console.log('- Exact prompts sent to Gemini');
  console.log('- File processing details');
  console.log('- Complete API responses from Gemini');
  console.log('- Data structures used for evaluation');
}

// Main execution
if (require.main === module) {
  showUsage();
  listAvailableFiles();
  testGeminiReading();
}

module.exports = { testGeminiReading, listAvailableFiles };
