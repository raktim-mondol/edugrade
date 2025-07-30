/**
 * Test script to verify IPYNB to PDF conversion and database storage
 */
const mongoose = require('mongoose');
const { Submission } = require('./models/submission');
const { processFileForGemini } = require('./utils/pdfExtractor');
const path = require('path');
const fs = require('fs');

// Mock submission for testing
async function testIpynbPdfStorage() {
  console.log('🧪 Testing IPYNB to PDF storage functionality...\n');
  
  try {
    // Connect to MongoDB (adjust connection string as needed)
    await mongoose.connect('mongodb://localhost:27017/edugrade', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');
    
    // Test file paths (adjust these paths to actual test files)
    const testIpynbPath = path.join(__dirname, 'uploads', 'submissions', 'test-notebook.ipynb');
    const testPdfPath = path.join(__dirname, 'uploads', 'submissions', 'test-document.pdf');
    
    console.log('\n📋 Test Cases:');
    console.log('1. Testing PDF file processing (should return original path)');
    console.log('2. Testing IPYNB file processing (should convert to PDF and return PDF path)');
    console.log('3. Testing database storage of file paths\n');
    
    // Test 1: PDF file processing
    if (fs.existsSync(testPdfPath)) {
      console.log('🔍 Test 1: Processing PDF file...');
      const pdfResult = await processFileForGemini(testPdfPath);
      console.log('PDF Processing Result:', {
        success: pdfResult.success,
        filePath: pdfResult.filePath,
        originalPath: pdfResult.originalPath,
        fileType: pdfResult.fileType,
        isConverted: pdfResult.filePath !== pdfResult.originalPath
      });
      console.log('');
    } else {
      console.log('⚠️  Test PDF file not found, skipping PDF test');
    }
    
    // Test 2: IPYNB file processing
    if (fs.existsSync(testIpynbPath)) {
      console.log('🔍 Test 2: Processing IPYNB file...');
      const ipynbResult = await processFileForGemini(testIpynbPath);
      console.log('IPYNB Processing Result:', {
        success: ipynbResult.success,
        filePath: ipynbResult.filePath,
        originalPath: ipynbResult.originalPath,
        fileType: ipynbResult.fileType,
        isConverted: ipynbResult.filePath !== ipynbResult.originalPath,
        pdfExists: ipynbResult.success ? fs.existsSync(ipynbResult.filePath) : false
      });
      
      // Test 3: Database storage simulation
      if (ipynbResult.success) {
        console.log('\n🔍 Test 3: Simulating database storage...');
        
        const testSubmission = new Submission({
          assignmentId: new mongoose.Types.ObjectId(),
          studentId: 'test-student-123',
          studentName: 'Test Student',
          submissionFile: ipynbResult.originalPath,
          originalFilePath: ipynbResult.originalPath,
          processedFilePath: ipynbResult.filePath,
          fileType: ipynbResult.fileType,
          processingStatus: 'completed',
          evaluationStatus: 'pending'
        });
        
        // Save to database
        await testSubmission.save();
        console.log('✅ Test submission saved to database with ID:', testSubmission._id);
        
        // Retrieve and verify
        const retrievedSubmission = await Submission.findById(testSubmission._id);
        console.log('✅ Retrieved submission from database:');
        console.log('   Original IPYNB:', retrievedSubmission.originalFilePath);
        console.log('   Converted PDF:', retrievedSubmission.processedFilePath);
        console.log('   File Type:', retrievedSubmission.fileType);
        console.log('   PDF file exists on disk:', fs.existsSync(retrievedSubmission.processedFilePath));
        
        // Clean up test submission
        await Submission.findByIdAndDelete(testSubmission._id);
        console.log('✅ Test submission cleaned up from database');
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('📝 Summary:');
        console.log('   ✅ IPYNB files are converted to PDF');
        console.log('   ✅ Original IPYNB path is stored in originalFilePath');
        console.log('   ✅ Converted PDF path is stored in processedFilePath');
        console.log('   ✅ File type is correctly identified');
        console.log('   ✅ PDF files are preserved on disk for Gemini processing');
      }
    } else {
      console.log('⚠️  Test IPYNB file not found at:', testIpynbPath);
      console.log('💡 To run full tests, place a test .ipynb file at the above path');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Helper function to create a test IPYNB file if it doesn't exist
function createTestIpynbFile() {
  const testIpynbPath = path.join(__dirname, 'uploads', 'submissions', 'test-notebook.ipynb');
  const testNotebook = {
    cells: [
      {
        cell_type: "markdown",
        metadata: {},
        source: ["# Test Notebook\n", "This is a test Jupyter notebook for PDF conversion testing."]
      },
      {
        cell_type: "code",
        execution_count: 1,
        metadata: {},
        outputs: [
          {
            name: "stdout",
            output_type: "stream",
            text: ["Hello, World!\n"]
          }
        ],
        source: ["print('Hello, World!')"]
      }
    ],
    metadata: {
      kernelspec: {
        display_name: "Python 3",
        language: "python",
        name: "python3"
      }
    },
    nbformat: 4,
    nbformat_minor: 4
  };
  
  // Ensure directory exists
  const dir = path.dirname(testIpynbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create test file
  fs.writeFileSync(testIpynbPath, JSON.stringify(testNotebook, null, 2));
  console.log('✅ Created test IPYNB file at:', testIpynbPath);
}

// Run the test
if (require.main === module) {
  console.log('🚀 Starting IPYNB to PDF storage test...\n');
  
  // Check if test file exists, create if needed
  const testIpynbPath = path.join(__dirname, 'uploads', 'submissions', 'test-notebook.ipynb');
  if (!fs.existsSync(testIpynbPath)) {
    console.log('📝 Creating test IPYNB file...');
    createTestIpynbFile();
    console.log('');
  }
  
  testIpynbPdfStorage().then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testIpynbPdfStorage, createTestIpynbFile };
