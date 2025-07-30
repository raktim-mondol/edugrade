# Enhanced Rubric Extraction from Assignment PDFs

## Overview
The system has been enhanced to automatically extract rubric and marking criteria information directly from assignment PDF documents when no separate rubric file is provided. This ensures that grading criteria are always available for evaluation, even if instructors don't upload a separate rubric document.

## New Functionality

### 1. Automatic Rubric Extraction
- **When triggered**: Automatically triggered during assignment processing when no separate rubric file is uploaded
- **What it extracts**: 
  - Point values for questions/sections
  - Marking schemes and criteria
  - Grade distributions and weightings
  - Evaluation guidelines
  - Assessment criteria descriptions
  - Performance level descriptions

### 2. Enhanced Assignment Processing
The assignment processor (`assignmentProcessor.js`) now:
- Processes the main assignment document
- Checks if a separate rubric file exists
- If no separate rubric: automatically extracts rubric from the assignment PDF
- Updates the database with extracted rubric information
- Tracks the source of the rubric (separate file vs. extracted from assignment)

## Key Features

### Smart Detection
- Identifies explicit marking criteria in assignment documents
- Extracts point values and weightings
- Creates reasonable default criteria when explicit ones aren't found
- Handles various assignment formats and layouts

### Flexible Point Allocation
- Respects instructor-provided total points
- Auto-detects total points from assignment when not specified
- Proportionally adjusts criteria weights to match total points
- Defaults to 100 points when no information is available

### Comprehensive Tracking
- Records whether rubric was found in assignment (`has_embedded_rubric`)
- Tracks extraction source (`rubricExtractionSource`)
- Stores extraction notes for debugging and transparency
- Maintains processing status for both assignment and rubric

## Database Schema Updates

### New Assignment Fields
```javascript
// Rubric extraction tracking
rubricExtractionSource: {
  type: String,
  enum: ['separate_file', 'assignment_pdf', 'assignment_pdf_failed', 'not_available'],
  default: 'not_available'
},
rubricExtractionNotes: String
```

### Updated Logic
- `rubricProcessingStatus` is now set to 'pending' even when no separate rubric file exists
- Assignment evaluation readiness considers rubrics from both sources
- Processing workflow handles both separate rubric files and extracted rubrics

## API Function

### `extractRubricFromAssignmentPDF(pdfFilePath, providedTotalPoints)`

**Parameters:**
- `pdfFilePath`: Path to the assignment PDF file
- `providedTotalPoints`: Optional total points (will auto-detect if not provided)

**Returns:**
```javascript
{
  has_embedded_rubric: true/false,
  grading_criteria: [
    {
      question_number: "Question or section number",
      criterionName: "What is being evaluated",
      weight: "Point value (numeric)",
      description: "Detailed description",
      marking_scale: "Performance levels and scoring"
    }
  ],
  extracted_total_points: "Points found in document",
  total_points: "Final total points used",
  extraction_notes: "Information about extraction process"
}
```

## Processing Workflow

### 1. Assignment Upload
- Instructor uploads assignment PDF (rubric optional)
- System creates assignment record
- Sets `rubricProcessingStatus` to 'pending' regardless of rubric file presence

### 2. Assignment Processing
- Processes assignment document for structure and requirements
- Checks for separate rubric file
- If no rubric file: extracts rubric from assignment PDF
- Updates database with results

### 3. Evaluation Readiness
- Assignment is ready for evaluation when:
  - Assignment processing is complete, AND
  - Either separate rubric is processed OR rubric extracted from assignment

## Testing

Use the test script to verify functionality:
```bash
node test-assignment-rubric-extraction.js
```

This will:
- Find assignment PDFs in the uploads directory
- Test rubric extraction with different point configurations
- Display detailed results including extracted criteria
- Show processing time and success metrics

## Benefits

### For Instructors
- No longer required to create separate rubric files
- System automatically finds marking criteria in assignments
- Maintains consistency in grading standards
- Reduces setup time and complexity

### For Students
- Always have access to grading criteria
- Consistent evaluation standards
- Clear understanding of point distributions
- Transparent marking schemes

### For System
- Higher completion rates for assignment processing
- More robust evaluation capabilities
- Better handling of diverse assignment formats
- Improved user experience

## Error Handling

The system gracefully handles various scenarios:
- **No marking criteria found**: Creates reasonable default criteria
- **Extraction failures**: Falls back to error state but doesn't break assignment processing
- **Invalid PDFs**: Provides clear error messages
- **API timeouts**: Implements retry logic with exponential backoff

## Future Enhancements

Potential improvements include:
- Machine learning to improve extraction accuracy
- Support for more document formats
- Integration with LTI systems for automatic rubric import
- Advanced criteria validation and normalization
- Historical analysis of extraction patterns
