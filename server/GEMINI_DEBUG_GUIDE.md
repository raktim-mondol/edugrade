# Gemini API Reading Verification Guide

This guide will help you verify that the Gemini API is correctly reading your assignment PDFs and student notebook (HTML) files.

## What I've Enhanced

I've added comprehensive debugging output to the system that will show you:

1. **Exact prompts sent to Gemini** - You'll see the complete instructions and context
2. **File processing details** - Information about how files are converted and prepared
3. **Data structures** - All the assignment, rubric, and solution data being used
4. **Complete API responses** - Full text responses from Gemini before JSON parsing
5. **File content previews** - Sample of HTML content generated from notebooks

## Key Debug Sections Added

### 1. Assignment PDF Processing
- Location: `processAssignmentPDF()` function in `geminiService.js`
- Shows: The prompt sent to extract assignment structure from PDF
- Output: Complete response showing how Gemini interprets your assignment

### 2. Rubric PDF Processing  
- Location: `processRubricPDF()` function in `geminiService.js`
- Shows: How Gemini reads and structures your grading rubric
- Output: Grading criteria and point values extracted from PDF

### 3. Solution PDF Processing
- Location: `processSolutionPDF()` function in `geminiService.js`  
- Shows: How Gemini processes your model solution
- Output: Question-by-question solution breakdown

### 4. Student Submission Processing
- Location: `processFileForGemini()` function in `pdfExtractor.js`
- Shows: Conversion of .ipynb to HTML, file sizes, content preview
- Output: Details of how student work is prepared for Gemini

### 5. Complete Evaluation Process
- Location: `evaluateSubmission()` function in `geminiService.js`
- Shows: All data structures, the complete prompt, and Gemini's evaluation response
- Output: Full evaluation workflow with debugging information

## How to Use the Debug Output

### Option 1: Use the Test Scripts

I've created two test scripts for you:

#### Simple Testing (Recommended)
```bash
cd server
node test-single-evaluation.js
```
This will:
- Find your latest assignment
- Show all processed data 
- Evaluate a test submission
- Display complete debug output

#### Advanced Testing
```bash
cd server  
node test-gemini-reading.js
```
This will:
- Test each component separately
- Process individual PDF files
- Show step-by-step workflow

### Option 2: Run Normal Evaluation with Debug Output

When you use the regular system to evaluate submissions, you'll now see extensive debug output in the server console including:

```
=== GEMINI INPUT DEBUG INFO START ===
Original file: /path/to/student.ipynb (.ipynb)
Processed file: /path/to/student.html (text/html)
File size: 156789 bytes
Total possible score for evaluation: 100

--- ASSIGNMENT DATA STRUCTURE ---
Assignment title: Machine Learning Assignment 1
Assignment description: Implement and evaluate classification algorithms
Question structure count: 3
Questions:
  Q1: Data preprocessing (20 points)
  Q2: Model implementation (50 points)  
  Q3: Analysis and evaluation (30 points)

--- RUBRIC DATA STRUCTURE ---
Rubric criteria count: 5
  Criterion 1: Data Quality (15 points)
    Question: 1
    Description: Clean and prepare dataset appropriately
  ...

--- SOLUTION DATA STRUCTURE ---
Solution questions count: 3
  Solution Q1: Data preprocessing steps
  ...

--- PROMPT BEING SENT TO GEMINI ---
You are an automated assignment grading assistant...
[Full prompt shown here]
=== GEMINI INPUT DEBUG INFO END ===
```

Then during evaluation:
```
=== GEMINI API RESPONSE START ===
{
  "overallGrade": 85,
  "totalPossible": 100,
  "criteriaGrades": [
    {
      "questionNumber": "1",
      "criterionName": "Data Quality",
      "score": 12,
      "maxScore": 15,
      "feedback": "Good data cleaning approach but missing handling of outliers..."
    }
  ],
  ...
}
=== GEMINI API RESPONSE END ===
```

## What to Look For

### 1. Assignment PDF Reading
- Verify the extracted title, description, and questions match your PDF
- Check that point values are correctly identified
- Ensure question requirements are properly captured

### 2. Student Notebook Reading  
- Confirm HTML conversion preserves code, outputs, and markdown
- Check file size is reasonable (not truncated)
- Verify HTML preview shows your notebook content

### 3. Evaluation Quality
- Review the prompt to ensure it includes all necessary context
- Check that Gemini's response addresses all rubric criteria
- Verify scores align with the rubric and student work

## Troubleshooting

### If Gemini seems to miss content:
1. Check file sizes - very large files may be truncated
2. Review HTML preview - ensure conversion worked properly  
3. Examine the prompt - verify all context is included

### If evaluations seem inaccurate:
1. Check rubric extraction - ensure criteria are clear
2. Review solution data - verify model answers are captured
3. Look at the evaluation prompt - ensure instructions are comprehensive

### If processing fails:
1. Check API key configuration
2. Verify file formats (PDF, .ipynb supported)
3. Review error messages in debug output

## Next Steps

1. Run the test scripts to see the debug output
2. Upload a test assignment and submission
3. Review the debug logs during evaluation
4. Adjust your PDFs/rubrics if needed based on what Gemini extracts
5. Monitor evaluation quality and fine-tune as needed

The enhanced debugging will give you complete transparency into how Gemini processes your files and makes evaluation decisions.
