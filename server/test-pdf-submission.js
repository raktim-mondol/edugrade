/**
 * Test script to verify PDF submission evaluation with Gemini API
 */

const { evaluateSubmission } = require('./utils/geminiService');
const path = require('path');

// Mock assignment data
const mockAssignmentData = {
  title: "Test Assignment",
  description: "This is a test assignment for PDF submission evaluation",
  questionStructure: [
    {
      number: "1",
      question: "Answer the first question",
      points: 50
    },
    {
      number: "2", 
      question: "Answer the second question",
      points: 50
    }
  ],
  totalPoints: 100
};

// Mock rubric data
const mockRubricData = {
  grading_criteria: [
    {
      question_number: "1",
      criterionName: "Question 1 Understanding",
      weight: 50,
      description: "Demonstrates understanding of the first question",
      marking_scale: "Excellent (40-50), Good (30-39), Fair (20-29), Poor (0-19)"
    },
    {
      question_number: "2",
      criterionName: "Question 2 Analysis", 
      weight: 50,
      description: "Shows analytical thinking for the second question",
      marking_scale: "Excellent (40-50), Good (30-39), Fair (20-29), Poor (0-19)"
    }
  ],
  total_points: 100
};

// Mock solution data
const mockSolutionData = {
  questions: [
    {
      number: "1",
      questionSummary: "Sample solution for question 1"
    },
    {
      number: "2", 
      questionSummary: "Sample solution for question 2"
    }
  ]
};

async function testPDFSubmissionEvaluation() {
  try {
    console.log('=== Testing PDF Submission Evaluation ===\n');
    
    // Check if there are any PDF files in the submissions folder
    const fs = require('fs');
    const submissionsFolder = path.join(__dirname, 'uploads', 'submissions');
    
    if (!fs.existsSync(submissionsFolder)) {
      console.log('❌ Submissions folder not found. Creating test note...');
      console.log('To test this functionality:');
      console.log('1. Place a PDF submission in: server/uploads/submissions/');
      console.log('2. Update the pdfFilePath variable below');
      console.log('3. Run this test again');
      return;
    }
    
    const submissionFiles = fs.readdirSync(submissionsFolder).filter(file => 
      path.extname(file).toLowerCase() === '.pdf'
    );
    
    if (submissionFiles.length === 0) {
      console.log('❌ No PDF files found in submissions folder.');
      console.log('Please add a PDF submission file to test with.');
      return;
    }
    
    // Use the first PDF file found
    const pdfFilePath = path.join(submissionsFolder, submissionFiles[0]);
    console.log(`📄 Testing with PDF file: ${pdfFilePath}`);
    console.log(`📊 File size: ${fs.statSync(pdfFilePath).size} bytes\n`);
    
    // Test the evaluation
    console.log('🚀 Starting PDF evaluation with Gemini API...\n');
    
    const startTime = Date.now();
    const result = await evaluateSubmission(
      mockAssignmentData,
      mockRubricData, 
      mockSolutionData,
      pdfFilePath,
      'test-student-001'
    );
    const endTime = Date.now();
    
    console.log('\n=== EVALUATION RESULTS ===');
    console.log(`⏱️  Evaluation completed in ${endTime - startTime}ms`);
    console.log(`📈 Overall Grade: ${result.overallGrade}/${result.totalPossible}`);
    console.log(`📝 Number of criteria grades: ${result.criteriaGrades ? result.criteriaGrades.length : 0}`);
    console.log(`💪 Strengths: ${result.strengths ? result.strengths.length : 0} items`);
    console.log(`📋 Areas for improvement: ${result.areasForImprovement ? result.areasForImprovement.length : 0} items`);
    console.log(`💡 Suggestions: ${result.suggestions ? result.suggestions.length : 0} items`);
    
    if (result.processingError) {
      console.log(`❌ Processing Error: ${result.processingError}`);
    }
    
    console.log('\n=== DETAILED RESULTS ===');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n✅ PDF submission evaluation test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPDFSubmissionEvaluation();
}

module.exports = { testPDFSubmissionEvaluation };
