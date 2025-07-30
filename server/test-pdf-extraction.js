const { extractFileContent } = require('./utils/pdfExtractor');
const path = require('path');
const fs = require('fs');

// Test PDF extraction
async function testPdfExtraction() {
  try {
    // Path to a sample PDF in the uploads directory
    let pdfPath = path.join(__dirname, 'uploads', 'assignments', '1743163414873-joya_cover_letter_professional.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error(`File not found: ${pdfPath}`);
      console.log('Available files in uploads/assignments:');
      
      // List files in the uploads directory
      try {
        const files = fs.readdirSync(path.join(__dirname, 'uploads', 'assignments'));
        console.log(files);
        
        if (files.length > 0) {
          // Try the first PDF file found
          const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
          if (pdfFiles.length > 0) {
            const firstPdf = pdfFiles[0];
            console.log(`\nTrying first available PDF file instead: ${firstPdf}`);
            pdfPath = path.join(__dirname, 'uploads', 'assignments', firstPdf);
          }
        }
      } catch (listError) {
        console.error('Error listing directory:', listError);
      }
      
      if (!fs.existsSync(pdfPath)) {
        console.error('No PDF files found to test. Please ensure there are PDF files in the uploads/assignments directory.');
        return;
      }
    }
    
    console.log(`Extracting text from ${pdfPath}...`);
    
    // Extract text from the PDF
    const text = await extractFileContent(pdfPath);
    
    console.log('\nExtraction successful! First 500 characters:');
    console.log(text.substring(0, 500) + '...');
    console.log(`\nTotal character count: ${text.length}`);
    
    // Write the extracted text to a file for inspection
    const outputPath = path.join(__dirname, 'extracted-text.txt');
    fs.writeFileSync(outputPath, text);
    console.log(`\nFull extracted text written to: ${outputPath}`);
  } catch (error) {
    console.error('Error during PDF extraction test:', error);
  }
}

// Run the test
testPdfExtraction();