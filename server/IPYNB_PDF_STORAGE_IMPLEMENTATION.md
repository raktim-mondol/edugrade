# IPYNB to PDF Storage Implementation

## Overview
This implementation ensures that when students upload Jupyter Notebook (.ipynb) files, they are automatically converted to PDF format and both the original and converted files are stored in the database for processing by Gemini AI.

## Key Components Modified

### 1. Submission Model (`models/submission.js`)
The submission model already had the necessary fields:
- `submissionFile`: Original uploaded file path
- `originalFilePath`: Path to the original file (IPYNB)
- `processedFilePath`: Path to the converted PDF file
- `fileType`: File extension (.pdf or .ipynb)

### 2. Submission Controller (`controllers/submissionController.js`)

#### Enhanced Upload Processing
- **Single Upload (`uploadSubmission`)**: Now immediately stores PDF paths in database after conversion
- **Batch Upload (`uploadBatchSubmissions`)**: Updated to handle IPYNB conversion in batch operations
- **Added Helper Function**: `getSubmissionPdfInfo()` to retrieve PDF information for submissions

#### New API Endpoints
- `GET /api/submissions/single/:id/pdf` - Download converted PDF file
- `GET /api/submissions/single/:id/file-info` - Get file information including PDF paths

#### Enhanced Response Data
Upload responses now include file information:
```json
{
  "message": "Submission created successfully",
  "submission": {
    "_id": "...",
    "studentId": "...",
    "studentName": "...",
    "status": "pending",
    "fileInfo": {
      "originalFile": "/path/to/original.ipynb",
      "fileType": ".ipynb",
      "hasConvertedPdf": true,
      "pdfFile": "/path/to/converted.pdf",
      "isIpynbConversion": true
    }
  }
}
```

### 3. PDF Extractor (`utils/pdfExtractor.js`)

#### Enhanced Conversion Process
- `convertIpynbToPdf()`: Converts IPYNB → HTML → PDF using nbconvert and Puppeteer
- `processFileForGemini()`: Main function that handles both PDF and IPYNB files
- Better logging and error handling for conversion process

### 4. Submission Routes (`routes/submissions.js`)
Added new route endpoints:
- `/single/:id/pdf` - Serve converted PDF files
- `/single/:id/file-info` - Get submission file information

### 5. Submission Processor (`workers/submissionProcessor.js`)
Already correctly stores file paths in database:
```javascript
await Submission.findByIdAndUpdate(submissionId, {
  processedFilePath: filePath,      // PDF path
  originalFilePath: originalPath,   // IPYNB path
  fileType: fileType,              // .ipynb
  processingStatus: 'completed'
});
```

## Flow Diagram

```
Student Upload (.ipynb)
         ↓
[multer stores original file]
         ↓
[processFileForGemini() called]
         ↓
[convertIpynbToPdf() converts to PDF]
         ↓
[Controller stores paths immediately]
         ↓
[Job queued for processing]
         ↓
[submissionProcessor updates database]
         ↓
[Gemini processes PDF file]
```

## File Storage Structure

```
uploads/
└── submissions/
    ├── 1234567890-notebook.ipynb     (original file)
    ├── notebook_converted.pdf        (converted PDF)
    └── 1234567891-document.pdf       (direct PDF upload)
```

## Database Storage

### Submission Document Example
```javascript
{
  _id: ObjectId("..."),
  assignmentId: ObjectId("..."),
  studentId: "student123",
  studentName: "John Doe",
  submissionFile: "/uploads/submissions/1234567890-notebook.ipynb",
  originalFilePath: "/uploads/submissions/1234567890-notebook.ipynb",
  processedFilePath: "/uploads/submissions/notebook_converted.pdf",
  fileType: ".ipynb",
  processingStatus: "completed",
  evaluationStatus: "pending",
  submitDate: ISODate("..."),
  // ... other fields
}
```

## API Usage Examples

### 1. Upload IPYNB File
```bash
curl -X POST http://localhost:5000/api/submissions/single \
  -F "submission=@notebook.ipynb" \
  -F "assignmentId=64a1b2c3d4e5f6789" \
  -F "studentId=student123" \
  -F "studentName=John Doe"
```

### 2. Get File Information
```bash
curl http://localhost:5000/api/submissions/single/64a1b2c3d4e5f6789/file-info
```

### 3. Download Converted PDF
```bash
curl http://localhost:5000/api/submissions/single/64a1b2c3d4e5f6789/pdf \
  --output converted.pdf
```

## Testing

Use the provided test script to verify functionality:
```bash
node test-ipynb-pdf-storage.js
```

## Benefits

1. **Automatic Conversion**: IPYNB files are automatically converted to PDF
2. **Path Preservation**: Both original and converted file paths are stored
3. **Database Integrity**: All file information is properly stored in the database
4. **API Access**: Easy access to both original and converted files via API
5. **Gemini Compatibility**: PDF files are ready for direct Gemini processing
6. **Batch Processing**: Works with both single and batch submissions
7. **Error Handling**: Robust error handling throughout the conversion process

## File Cleanup

The system properly cleans up files during deletion:
- Original IPYNB files are deleted
- Converted PDF files are deleted
- Database records are removed

This ensures no orphaned files remain on the filesystem.
