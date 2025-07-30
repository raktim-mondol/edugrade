/**
 * Test script to verify .ipynb to PDF conversion with the new strategy
 */

const { convertIpynbToPdf, processFileForGemini } = require('./utils/pdfExtractor');
const { evaluateSubmission } = require('./utils/geminiService');
const path = require('path');
const fs = require('fs');

// Mock assignment data
const mockAssignmentData = {
  title: "Jupyter Notebook Assignment",
  description: "This is a test assignment for .ipynb to PDF conversion evaluation",
  questionStructure: [
    {
      number: "1",
      question: "Implement and test the required functions",
      points: 60
    },
    {
      number: "2", 
      question: "Provide analysis and documentation",
      points: 40
    }
  ],
  totalPoints: 100
};

// Mock rubric data
const mockRubricData = {
  grading_criteria: [
    {
      question_number: "1",
      criterionName: "Code Implementation",
      weight: 60,
      description: "Quality of code implementation and correctness",
      marking_scale: "Excellent (50-60), Good (40-49), Fair (25-39), Poor (0-24)"
    },
    {
      question_number: "2",
      criterionName: "Analysis and Documentation", 
      weight: 40,
      description: "Quality of analysis, explanations, and documentation",
      marking_scale: "Excellent (35-40), Good (25-34), Fair (15-24), Poor (0-14)"
    }
  ],
  total_points: 100
};

async function testIpynbToPdfConversion() {
  try {
    console.log('=== Testing .ipynb to PDF Conversion ===\n');
    
    // Check if there are any .ipynb files in the submissions folder
    const submissionsFolder = path.join(__dirname, 'uploads', 'submissions');
    
    if (!fs.existsSync(submissionsFolder)) {
      console.log('❌ Submissions folder not found. Creating test note...');
      console.log('To test this functionality:');
      console.log('1. Place a .ipynb submission in: server/uploads/submissions/');
      console.log('2. Make sure you have jupyter and puppeteer installed:');
      console.log('   npm install puppeteer');
      console.log('   pip install jupyter nbconvert');
      console.log('3. Run this test again');
      return;
    }
    
    const ipynbFiles = fs.readdirSync(submissionsFolder).filter(file => 
      path.extname(file).toLowerCase() === '.ipynb'
    );
    
    if (ipynbFiles.length === 0) {
      console.log('❌ No .ipynb files found in submissions folder.');
      console.log('Please add a Jupyter notebook file to test with.');
      return;
    }
    
    // Use the first .ipynb file found
    const ipynbFilePath = path.join(submissionsFolder, ipynbFiles[0]);
    console.log(`📔 Testing with .ipynb file: ${ipynbFilePath}`);
    console.log(`📊 File size: ${fs.statSync(ipynbFilePath).size} bytes\n`);
    
    // Test 1: Direct conversion function
    console.log('🧪 Test 1: Direct .ipynb to PDF conversion...\n');
    
    const startConversionTime = Date.now();
    const pdfFilePath = await convertIpynbToPdf(ipynbFilePath);
    const endConversionTime = Date.now();
    
    console.log(`✅ Conversion completed in ${endConversionTime - startConversionTime}ms`);
    console.log(`📄 Generated PDF: ${pdfFilePath}`);
    console.log(`📊 PDF file size: ${fs.statSync(pdfFilePath).size} bytes\n`);
    
    // Test 2: processFileForGemini function
    console.log('🧪 Test 2: processFileForGemini function...\n');
    
    const fileProcessResult = await processFileForGemini(ipynbFilePath);
    
    if (fileProcessResult.success) {
      console.log(`✅ processFileForGemini successful`);
      console.log(`📄 Processed file: ${fileProcessResult.filePath}`);
      console.log(`📊 File type: ${fileProcessResult.fileType}`);
    } else {
      console.log(`❌ processFileForGemini failed: ${fileProcessResult.error}`);
      return;
    }
    
    // Test 3: Full evaluation with Gemini API
    console.log('\n🧪 Test 3: Full evaluation with Gemini API...\n');
    console.log('🚀 Starting .ipynb (PDF) evaluation with Gemini API...\n');
    
    const startEvalTime = Date.now();
    const evaluationResult = await evaluateSubmission(
      mockAssignmentData,
      mockRubricData, 
      null, // No solution data for this test
      ipynbFilePath,
      'test-student-ipynb-001'
    );
    const endEvalTime = Date.now();
    
    console.log('\n=== EVALUATION RESULTS ===');
    console.log(`⏱️  Evaluation completed in ${endEvalTime - startEvalTime}ms`);
    console.log(`📈 Overall Grade: ${evaluationResult.overallGrade}/${evaluationResult.totalPossible}`);
    console.log(`📝 Number of criteria grades: ${evaluationResult.criteriaGrades ? evaluationResult.criteriaGrades.length : 0}`);
    console.log(`💪 Strengths: ${evaluationResult.strengths ? evaluationResult.strengths.length : 0} items`);
    console.log(`📋 Areas for improvement: ${evaluationResult.areasForImprovement ? evaluationResult.areasForImprovement.length : 0} items`);
    console.log(`💡 Suggestions: ${evaluationResult.suggestions ? evaluationResult.suggestions.length : 0} items`);
    
    if (evaluationResult.processingError) {
      console.log(`❌ Processing Error: ${evaluationResult.processingError}`);
    }
    
    console.log('\n=== SAMPLE FEEDBACK ===');
    if (evaluationResult.criteriaGrades && evaluationResult.criteriaGrades.length > 0) {
      evaluationResult.criteriaGrades.forEach((criteria, index) => {
        console.log(`${index + 1}. ${criteria.criterionName}: ${criteria.score}/${criteria.maxScore}`);
        console.log(`   Feedback: ${criteria.feedback.substring(0, 200)}...`);
      });
    }
    
    console.log('\n✅ .ipynb to PDF conversion and evaluation test completed successfully!');
    
    // Clean up test files
    try {
      if (fs.existsSync(pdfFilePath)) {
        fs.unlinkSync(pdfFilePath);
        console.log(`🧹 Cleaned up test PDF file: ${pdfFilePath}`);
      }
    } catch (cleanupError) {
      console.warn(`⚠️  Could not clean up test PDF file: ${cleanupError.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testIpynbToPdfConversion();
}

module.exports = { testIpynbToPdfConversion };
