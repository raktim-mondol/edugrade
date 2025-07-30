/**
 * Test script for rubric extraction from assignment PDFs
 * This script tests the new functionality to extract marking criteria from assignment documents
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { extractRubricFromAssignmentPDF } = require('./utils/geminiService');

// Load environment variables
dotenv.config();

async function testRubricExtraction() {
  console.log('=== Testing Rubric Extraction from Assignment PDF ===\n');
  
  // Find assignment PDFs in the uploads directory
  const assignmentsDir = path.join(__dirname, 'uploads', 'assignments');
  
  try {
    const files = fs.readdirSync(assignmentsDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No assignment PDF files found for testing.');
      return;
    }
    
    console.log(`Found ${pdfFiles.length} assignment PDF files:`);
    pdfFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    // Test with the first PDF file
    const testFile = pdfFiles[0];
    const testFilePath = path.join(assignmentsDir, testFile);
    
    console.log(`\nTesting rubric extraction with: ${testFile}`);
    console.log(`File path: ${testFilePath}`);
    console.log(`File exists: ${fs.existsSync(testFilePath)}`);
    
    if (!fs.existsSync(testFilePath)) {
      console.error('Test file does not exist!');
      return;
    }
    
    // Test extraction with different total points
    const testCases = [
      { totalPoints: null, description: 'Auto-detect total points' },
      { totalPoints: 100, description: 'Using 100 total points' },
      { totalPoints: 50, description: 'Using 50 total points' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n--- Test Case: ${testCase.description} ---`);
      
      try {
        const startTime = Date.now();
        const result = await extractRubricFromAssignmentPDF(testFilePath, testCase.totalPoints);
        const endTime = Date.now();
        
        console.log(`Extraction completed in ${endTime - startTime}ms`);
        console.log('\nExtraction Results:');
        console.log(`Has embedded rubric: ${result.has_embedded_rubric}`);
        console.log(`Total points (extracted): ${result.extracted_total_points}`);
        console.log(`Total points (final): ${result.total_points}`);
        console.log(`Number of criteria: ${result.grading_criteria?.length || 0}`);
        
        if (result.extraction_notes) {
          console.log(`Extraction notes: ${result.extraction_notes}`);
        }
        
        if (result.grading_criteria && result.grading_criteria.length > 0) {
          console.log('\nGrading Criteria:');
          result.grading_criteria.forEach((criterion, index) => {
            console.log(`  ${index + 1}. ${criterion.criterionName}`);
            console.log(`     Weight: ${criterion.weight}`);
            console.log(`     Description: ${criterion.description}`);
            if (criterion.question_number) {
              console.log(`     Question: ${criterion.question_number}`);
            }
            if (criterion.marking_scale && criterion.marking_scale !== 'N/A') {
              console.log(`     Marking Scale: ${criterion.marking_scale}`);
            }
            console.log('');
          });
        }
        
        if (result.processing_error) {
          console.log(`Processing Error: ${result.processing_error}`);
        }
        
      } catch (error) {
        console.error(`Error during extraction: ${error.message}`);
        console.error(error.stack);
      }
      
      console.log('---'.repeat(20));
    }
    
  } catch (error) {
    console.error('Error reading assignments directory:', error);
  }
}

// Run the test
if (require.main === module) {
  testRubricExtraction()
    .then(() => {
      console.log('\n=== Test completed ===');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testRubricExtraction };
