# Solution Processing Guide

## Overview
The EduGrade system supports automatic processing of assignment solution files during assignment creation. When a solution file is provided, it is directly processed by the Gemini API to extract structured solution data that is then used during student submission evaluation.

## Solution Processing Workflow

### 1. Assignment Creation
When creating an assignment, instructors can optionally upload:
- Assignment PDF (required)
- Rubric PDF (optional)
- **Solution PDF (optional)**

If a solution file is provided, the system automatically:
1. Queues the solution for processing via `solutionProcessingQueue`
2. Processes the PDF directly with Gemini API using `processSolutionPDF()`
3. Stores structured solution data in `assignment.processedSolution`

### 2. Solution Processing Details
The `processSolutionPDF()` function:
- Reads the solution PDF file
- Sends it directly to Gemini API (gemini-2.5-pro model)
- Extracts structured data for each question:
  - Question Number
  - Question Summary
  - Solution/Implementation
  - Expected Output
  - Key Steps
  - Dependencies

### 3. Evaluation Integration
During submission evaluation:
1. The `submissionProcessor` includes `assignment.processedSolution` as `solutionData` in evaluation jobs
2. The `evaluationProcessor` passes solution data to the `evaluateSubmission()` function
3. Gemini API receives the solution data as part of the evaluation prompt
4. Submissions are graded with reference to the model solution

### 4. Tracking Solution Usage
The submission model now tracks:
- `solutionDataAvailable`: Boolean indicating if solution data was available during evaluation
- `solutionStatusAtEvaluation`: The solution processing status at the time of evaluation

## Benefits
- **Consistent Grading**: Students are evaluated against the same model solution
- **Detailed Feedback**: Gemini can provide feedback comparing student work to the expected solution
- **Automated Processing**: No manual intervention required once solution is uploaded
- **Quality Assurance**: Track which submissions were evaluated with/without solution data

## Status Tracking
Solution processing status can be:
- `pending`: Solution file uploaded, waiting for processing
- `processing`: Currently being processed by Gemini API
- `completed`: Successfully processed and stored
- `failed`: Processing failed (error stored in `solutionProcessingError`)
- `not_applicable`: No solution file provided

## API Integration
The solution data is automatically included in the evaluation prompt sent to Gemini, ensuring that:
1. Students are compared against the official solution
2. Grading is consistent across all submissions
3. Feedback references the expected approach/methodology
