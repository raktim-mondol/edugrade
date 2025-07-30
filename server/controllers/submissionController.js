const { Submission } = require('../models/submission');
const { Assignment } = require('../models/assignment');
const fs = require('fs').promises;
const path = require('path');
const { processFileForGemini } = require('../utils/pdfExtractor');
const { submissionProcessingQueue } = require('../config/queue');
const { isConnected } = require('../config/db');
const Excel = require('exceljs');
const os = require('os');

// Helper function to convert column number to Excel column letter (A, B, C, ... AA, AB, etc)
function getExcelColumnLetter(columnNumber) {
  let columnName = '';
  let dividend = columnNumber;
  let modulo;

  while (dividend > 0) {
    modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - 1) / 26);
  }
  return columnName;
}

// Helper function to define base columns
function defineBaseColumns() {
  return [
    { header: 'Serial No.', key: 'serialNo', width: 10 },
    { header: 'Student ID', key: 'studentId', width: 15 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Total Score', key: 'totalScore', width: 15, style: { alignment: { horizontal: 'center' } } }
  ];
}

// Helper function to sanitize keys for ExcelJS
function sanitizeKey(key) {
  // Replace non-alphanumeric characters (excluding underscore) with underscore
  // Also trim leading/trailing underscores and collapse multiple underscores
  return String(key)
    .replace(/[^a-zA-Z0-9_]/g, '_') 
    .replace(/^_+|_+$/g, '') // Trim leading/trailing underscores
    .replace(/_{2,}/g, '_'); // Collapse multiple underscores
}

// Helper function to define dynamic question columns based on submissions
function defineQuestionColumns(submissions) {
  const questionHeaders = new Map(); // Use a Map to store unique questions and their max scores

  submissions.forEach(sub => {
    if (sub.evaluationResult && Array.isArray(sub.evaluationResult.criteriaGrades)) {
      sub.evaluationResult.criteriaGrades.forEach(grade => {
        // Use original name/number for display header, but sanitized version for key
        const originalKey = grade.questionNumber || grade.criterionName || 'Unknown'; 
        const sanitizedKey = sanitizeKey(originalKey); // Sanitize the key

        if (!questionHeaders.has(sanitizedKey) || (grade.maxScore && grade.maxScore > (questionHeaders.get(sanitizedKey)?.maxScore || 0))) {
           // Store the original key for the header and the max score
           questionHeaders.set(sanitizedKey, { header: originalKey, maxScore: grade.maxScore || 0 }); 
        }
      });
    }
  });

  // Sort sanitized keys for consistent column order
  const sortedSanitizedKeys = Array.from(questionHeaders.keys()).sort((a, b) => {
    // Attempt to sort based on the original header text for better readability
    const headerA = questionHeaders.get(a)?.header || '';
    const headerB = questionHeaders.get(b)?.header || '';
    const numA = parseInt(String(headerA).replace(/[^0-9]/g, ''), 10);
    const numB = parseInt(String(headerB).replace(/[^0-9]/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) { // Sort numerically if possible and different
      return numA - numB;
    }
    // Fallback to string comparison of original headers
    return String(headerA).localeCompare(String(headerB));
  });

  const columns = [];
  sortedSanitizedKeys.forEach(sanitizedKey => {
    const { header, maxScore } = questionHeaders.get(sanitizedKey);
    // Create part header with max score
    const partHeader = maxScore > 0 ? `${header} (${maxScore})` : header;
    
    // Add a column for score with format "earned/total"
    columns.push({
      header: partHeader,
      key: `q_${sanitizedKey}_combined`, // Use sanitized key
      width: 18,
      style: { alignment: { horizontal: 'center' } }
    });
  });

  return columns;
}

// Helper function to define end columns
function defineEndColumns() {
  return [
    { header: 'Feedback', key: 'feedback', width: 40 },
    { header: 'Submission Date', key: 'submitted', width: 20 },
    { header: 'Evaluation Date', key: 'evaluated', width: 20 }
  ];
}

// Helper function to add title and info rows
function addTitleAndInfoRows(worksheet, assignment, submissions, lastCol) {
  // --- Row 1: Assignment title ---
  worksheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `Assignment Results: ${assignment.title || 'Untitled Assignment'}`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4167B8' }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // --- Row 2: Export date ---
  worksheet.mergeCells(`A2:${lastCol}2`);
  const infoCell = worksheet.getCell('A2');
  infoCell.value = `Generated: ${new Date().toLocaleString()}`;
  infoCell.font = { italic: true, size: 11, color: { argb: 'FF666666' } };
  infoCell.alignment = { horizontal: 'center' };
  worksheet.getRow(2).height = 25;

  // Empty row for spacing
  worksheet.addRow([]);
}

// Helper function to style the header row
function styleHeaderRow(worksheet, headerRowNum, baseColumns, questionColumns, endColumns) {
  const headerRow = worksheet.getRow(headerRowNum);
  headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }; // White text
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2E5090' } // Darker theme color
  };
  headerRow.height = 35; // Increased height for better visibility

  // Add borders to header row
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    };
    
    // Special border for the last cell in the header
    if (cell.address === `${getExcelColumnLetter(baseColumns.length + questionColumns.length + endColumns.length)}${headerRowNum}`) {
      cell.border.right = { style: 'medium', color: { argb: 'FF000000' } };
    }
    // Special border for the first cell
    if (cell.address === `A${headerRowNum}`) {
      cell.border.left = { style: 'medium', color: { argb: 'FF000000' } };
    }
  });
}

// Helper function to populate data rows
function populateDataRows(worksheet, submissions, dataStartRow) {
  submissions.forEach((sub, index) => {
    const rowNum = dataStartRow + index;
    const row = worksheet.getRow(rowNum);

    // --- Populate Base Columns ---
    row.getCell('serialNo').value = index + 1; // Add serial number
    row.getCell('studentId').value = sub.studentId || 'N/A';
    row.getCell('studentName').value = sub.studentName || 'N/A';
    row.getCell('status').value = sub.evaluationStatus || sub.processingStatus || 'unknown'; // Use evaluationStatus first

    // --- Populate Total Score in "earned/total" format ---
    const totalScoreCell = row.getCell('totalScore');
    if (sub.evaluationResult) {
      const earnedScore = typeof sub.evaluationResult.overallGrade === 'number' ? sub.evaluationResult.overallGrade : 0;
      const totalPossible = typeof sub.evaluationResult.totalPossible === 'number' 
                            ? sub.evaluationResult.totalPossible 
                            : (sub.assignment ? sub.assignment.totalPoints : 100);
      totalScoreCell.value = `${earnedScore}/${totalPossible}`;
    } else {
      const totalPossible = sub.assignment ? sub.assignment.totalPoints : 100;
      totalScoreCell.value = `0/${totalPossible}`;
    }

    // --- Populate Dynamic Question Columns in "earned/total" format ---
    const gradesMap = new Map(); // Map sanitized keys to scores
    if (sub.evaluationResult && Array.isArray(sub.evaluationResult.criteriaGrades)) {
      sub.evaluationResult.criteriaGrades.forEach(grade => {
        const originalKey = grade.questionNumber || grade.criterionName || 'Unknown';
        const sanitizedKey = sanitizeKey(originalKey); // Sanitize the key
        gradesMap.set(sanitizedKey, { score: grade.score, maxScore: grade.maxScore });
      });
    }

    // Iterate through the columns defined by defineQuestionColumns
    worksheet.columns.forEach(column => {
      if (column.key.startsWith('q_') && column.key.endsWith('_combined')) {
        const sanitizedKey = column.key.substring(2, column.key.length - 9); // Remove 'q_' and '_combined'
        const gradeData = gradesMap.get(sanitizedKey);
        if (gradeData && typeof gradeData.score === 'number' && typeof gradeData.maxScore === 'number') {
          row.getCell(column.key).value = `${gradeData.score}/${gradeData.maxScore}`;
        } else {
          row.getCell(column.key).value = '-';
        }
      }
    });

    // --- Populate End Columns ---
    const feedbackCell = row.getCell('feedback'); // Key from defineEndColumns
    const submittedCell = row.getCell('submitted'); // Key from defineEndColumns
    const evaluatedCell = row.getCell('evaluated'); // Key from defineEndColumns

    if (sub.evaluationResult) {
      let feedbackText = '';
      if (sub.evaluationResult.strengths && sub.evaluationResult.strengths.length > 0) {
        feedbackText += `Strengths:\n- ${sub.evaluationResult.strengths.join('\n- ')}\n\n`;
      }
      if (sub.evaluationResult.areasForImprovement && sub.evaluationResult.areasForImprovement.length > 0) {
        feedbackText += `Areas for Improvement:\n- ${sub.evaluationResult.areasForImprovement.join('\n- ')}\n\n`;
      }
      if (sub.evaluationResult.suggestions && sub.evaluationResult.suggestions.length > 0) {
        feedbackText += `Suggestions:\n- ${sub.evaluationResult.suggestions.join('\n- ')}\n\n`;
      }
      feedbackCell.value = feedbackText.trim() || 'No detailed feedback available.';
      evaluatedCell.value = sub.evaluationDate ? new Date(sub.evaluationDate) : null;
    } else {
      feedbackCell.value = sub.evaluationStatus === 'failed' ? `Evaluation failed: ${sub.evaluationError || 'Unknown error'}` : 'Not evaluated yet.';
      evaluatedCell.value = null;
    }

    submittedCell.value = sub.submitDate ? new Date(sub.submitDate) : null;
    submittedCell.numFmt = 'yyyy-mm-dd hh:mm';
    evaluatedCell.numFmt = 'yyyy-mm-dd hh:mm';

    const status = sub.evaluationStatus || sub.processingStatus;
    const statusCell = row.getCell('status');
    if (status === 'completed') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light green
      statusCell.font = { color: { argb: 'FF006100' } }; // Dark green text
    } else if (status === 'failed') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; // Light red
      statusCell.font = { color: { argb: 'FF9C0006' } }; // Dark red text
    } else if (status === 'evaluating' || status === 'pending') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }; // Light yellow
      statusCell.font = { color: { argb: 'FF9C6500' } }; // Dark yellow text
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
      };

      // Get column definition by column index
      const colDef = worksheet.getColumn(cell.col);

      // Default alignment
      cell.alignment = { 
        vertical: 'top', 
        horizontal: colDef?.style?.alignment?.horizontal || 'left',
        wrapText: false
      };

      // Apply specific formatting based on column key
      if (colDef && colDef.key === 'feedback') {
        cell.alignment.wrapText = true;
      }
      
      // Center align specific columns
      if (colDef && (['status', 'totalScore', 'serialNo'].includes(colDef.key) || 
          (colDef.key && colDef.key.startsWith('q_')))) {
          cell.alignment.horizontal = 'center';
      }


    });

    row.height = 60;
  });
}

// Helper function to add summary statistics
// Helper function to get PDF information for a submission
function getSubmissionPdfInfo(submission) {
  const info = {
    hasConvertedPdf: false,
    originalFile: submission.submissionFile,
    pdfFile: null,
    fileType: submission.fileType || 'unknown',
    isIpynbConversion: false
  };

  if (submission.processedFilePath) {
    info.pdfFile = submission.processedFilePath;
    info.hasConvertedPdf = true;
    
    // Check if this was an IPYNB conversion
    if (submission.fileType === '.ipynb' && submission.originalFilePath && submission.processedFilePath !== submission.originalFilePath) {
      info.isIpynbConversion = true;
    }
  }

  return info;
}

function addSummaryStatistics(worksheet, submissions, lastCol) {
  // Summary statistics section removed for cleaner, simpler export
  // Only the main data table is included
}

// Helper function to write and send the Excel file
async function writeAndSendExcel(res, workbook, assignment) {
  try {
    const tempDir = os.tmpdir();
    const safeName = (assignment.title || 'Assignment').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const tempFilePath = path.join(tempDir, `${safeName}_results_${Date.now()}.xlsx`);

    await workbook.xlsx.writeFile(tempFilePath);

    res.download(tempFilePath, `${safeName}_results.xlsx`, async (err) => {
      try {
        if (await fs.stat(tempFilePath)) {
          await fs.unlink(tempFilePath);
        }
      } catch (unlinkErr) {
        console.error(`Error deleting temporary Excel file ${tempFilePath}:`, unlinkErr);
      }

      if (err && !res.headersSent) {
        console.error('Error sending Excel file:', err);
        return res.status(500).json({ error: 'Failed to send Excel file' });
      }
    });
  } catch (fileError) {
    console.error('Error creating or writing Excel file:', fileError);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Excel file: ' + fileError.message });
    }
  }
}

// Create a new submission (for single submission uploads)
exports.uploadSubmission = async (req, res) => {
  try {
    // Check database connection first
    if (!isConnected()) {
      console.error('Database is not connected');
      return res.status(500).json({ 
        error: 'Database connection error. Please ensure MongoDB is running and try again.' 
      });
    }
    
    console.log('Submission upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const { assignmentId, studentId, studentName, comments } = req.body;
    
    if (!assignmentId) {
      console.log('Missing assignmentId in request');
      return res.status(400).json({ error: 'Assignment ID is required' });
    }

    if (!studentId) {
      console.log('Missing studentId in request');
      return res.status(400).json({ error: 'Student ID is required' });
    }

    try {
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        console.log('Assignment not found:', assignmentId);
        return res.status(404).json({ error: 'Assignment not found' });
      }
      console.log('Assignment found:', assignment._id);
    } catch (err) {
      console.error('Error finding assignment:', err);
      return res.status(404).json({ error: 'Invalid assignment ID format or assignment not found' });
    }

    const submissionFile = req.file;
    if (!submissionFile) {
      console.log('No submission file provided in request');
      return res.status(400).json({ error: 'Submission file is required' });
    }
    
    const submissionFilePath = submissionFile.path;
    console.log('Submission file path:', submissionFilePath);

    try {
      const submission = new Submission({
        assignmentId,
        studentId,
        studentName: studentName || studentId,
        comments,
        submissionFile: submissionFilePath,
        processingStatus: 'pending',
        evaluationStatus: 'pending',
        submitDate: new Date()
      });

      console.log('Creating submission document:', {
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        studentName: submission.studentName,
        filePath: submission.submissionFile
      });

      await submission.save();
      console.log('Submission saved to database:', submission._id);
      
      console.log('Processing file for Gemini:', submissionFilePath);
      
      try {
        const processResult = await processFileForGemini(submissionFilePath);
        
        if (processResult.success) {
          console.log('File processing successful, queueing for processing');
          console.log(`Original file: ${processResult.originalPath}`);
          console.log(`Processed file (PDF): ${processResult.filePath}`);
          console.log(`File type: ${processResult.fileType}`);
          
          // Store the processed file paths immediately in the submission
          submission.originalFilePath = processResult.originalPath;
          submission.processedFilePath = processResult.filePath;
          submission.fileType = processResult.fileType;
          await submission.save();
          
          await submissionProcessingQueue.createJob({
            submissionId: submission._id,
            studentId: studentId,
            filePath: processResult.filePath,
            originalPath: processResult.originalPath,
            fileType: processResult.fileType
          }).save();

          console.log(`Submission ${submission._id} queued for processing`);
          if (processResult.fileType === '.ipynb') {
            console.log(`✅ IPYNB file converted to PDF and stored in database`);
            console.log(`   Original IPYNB: ${processResult.originalPath}`);
            console.log(`   Converted PDF: ${processResult.filePath}`);
          }
        } else {
          console.error(`File processing failed: ${processResult.error}`);
          
          submission.processingStatus = 'failed';
          submission.processingError = `File processing failed: ${processResult.error}`;
          await submission.save();
          
          console.log(`Submission ${submission._id} marked as failed due to file processing error`);
        }
      } catch (extractError) {
        console.error('Error during file processing:', extractError);
        
        submission.processingStatus = 'failed';
        submission.processingError = 'Error in file processing: ' + extractError.message;
        await submission.save();
        console.log('Submission marked as failed processing but request will continue');
      }

      // Get PDF information for the response
      const pdfInfo = getSubmissionPdfInfo(submission);

      return res.status(201).json({
        message: 'Submission created successfully',
        submission: {
          _id: submission._id,
          studentId: submission.studentId,
          studentName: submission.studentName,
          status: submission.processingStatus,
          fileInfo: {
            originalFile: pdfInfo.originalFile,
            fileType: pdfInfo.fileType,
            hasConvertedPdf: pdfInfo.hasConvertedPdf,
            pdfFile: pdfInfo.pdfFile,
            isIpynbConversion: pdfInfo.isIpynbConversion
          }
        }
      });
    } catch (dbError) {
      console.error('Database error while creating submission:', dbError);
      return res.status(500).json({ error: 'Database error: ' + dbError.message });
    }
  } catch (error) {
    console.error('Error creating submission:', error);
    return res.status(500).json({ error: 'An error occurred while creating the submission: ' + error.message });
  }
};

// Upload batch submissions
exports.uploadBatchSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.body;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      submissions: []
    };
    
    for (const file of files) {
      try {
        const filenameBase = path.parse(file.originalname).name.trim();
        
        let studentId;
        if (!filenameBase || filenameBase === '.' || filenameBase === '..') {
            console.warn(`Invalid filename for student ID extraction: ${file.originalname}. Assigning placeholder.`);
            studentId = `invalid_filename_${Date.now()}`;
        } else {
            studentId = filenameBase;
        }
        
        const studentName = studentId;
        
        const submission = new Submission({
          assignmentId,
          studentId,
          studentName,
          submissionFile: file.path,
          processingStatus: 'pending',
          evaluationStatus: 'pending',
          submitDate: new Date()
        });
        
        await submission.save();
        
        try {
          const processResult = await processFileForGemini(file.path);
          
          if (processResult.success) {
            // Store the processed file paths immediately in the submission
            submission.originalFilePath = processResult.originalPath;
            submission.processedFilePath = processResult.filePath;
            submission.fileType = processResult.fileType;
            await submission.save();
            
            await submissionProcessingQueue.createJob({
              submissionId: submission._id,
              studentId,
              filePath: processResult.filePath,
              originalPath: processResult.originalPath,
              fileType: processResult.fileType
            }).save();
            
            console.log(`Batch submission ${submission._id} queued for processing`);
            if (processResult.fileType === '.ipynb') {
              console.log(`✅ Batch IPYNB file converted to PDF: ${processResult.filePath}`);
            }
            
            results.successful++;
            results.submissions.push({
              id: submission._id,
              studentId,
              status: 'queued',
              isIpynbConversion: processResult.fileType === '.ipynb'
            });
          } else {
            console.error(`File processing failed for batch submission ${submission._id}: ${processResult.error}`);
            
            submission.processingStatus = 'failed';
            submission.processingError = `File processing failed: ${processResult.error}`;
            await submission.save();
            
            results.failed++;
            results.submissions.push({
              id: submission._id,
              studentId,
              status: 'failed',
              error: 'File processing failed'
            });
          }
        } catch (extractProcessError) {
          console.error('Error during batch file processing:', extractProcessError);
          
          submission.processingStatus = 'failed';
          submission.processingError = 'Error in file processing: ' + extractProcessError.message;
          await submission.save();
          
          results.failed++;
          results.submissions.push({
            id: submission._id,
            studentId,
            status: 'failed',
            error: 'File processing failed'
          });
        }
      } catch (submissionError) {
        console.error('Error processing batch submission file:', submissionError);
        results.failed++;
        results.submissions.push({
          file: file.originalname,
          status: 'failed',
          error: 'Submission creation failed'
        });
      }
    }
    
    res.status(201).json({
      message: 'Batch submissions processed',
      results
    });
  } catch (error) {
    console.error('Error processing batch submissions:', error);
    res.status(500).json({ error: 'An error occurred while processing batch submissions' });
  }
};

// Get submissions for a specific assignment
exports.getSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    const submissions = await Submission.find({ assignmentId }).sort({ createdAt: -1 });
    
    res.status(200).json({ submissions });
  } catch (error) {
    console.error('Error retrieving submissions:', error);
    res.status(500).json({ error: 'An error occurred while retrieving submissions' });
  }
};

// Get a single submission by ID
exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.status(200).json({ submission });
  } catch (error) {
    console.error('Error retrieving submission:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the submission' });
  }
};

// Export to Excel
/**
 * Clean and Simple Excel Export Features:
 * 1. Individual marks shown as "earned/total" format (e.g., "13/15")
 * 2. Part-wise breakdown with headers like "Part 1 (13)", "Part 2 (12)", etc.
 * 3. Freeze panes for easy navigation (first 3 columns and header rows frozen)
 * 4. Auto-filter capability for data filtering
 * 5. Clean, simple layout focused purely on marks and essential data
 * 6. No statistics, percentages, or complex calculations - just raw scores
 */
exports.exportToExcel = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const submissions = await Submission.find({ assignmentId }).sort({ studentId: 1 });

    const workbook = new Excel.Workbook();
    workbook.creator = 'Edugrade';
    workbook.created = new Date();
    workbook.modified = new Date();
    const worksheet = workbook.addWorksheet('Results', {
      properties: { tabColor: { argb: '4167B8' } }
    });

    const baseColumns = defineBaseColumns();
    const questionColumns = defineQuestionColumns(submissions);
    const endColumns = defineEndColumns();
    worksheet.columns = [...baseColumns, ...questionColumns, ...endColumns];

    const totalColumns = worksheet.columns.length;
    const lastCol = getExcelColumnLetter(totalColumns);

    addTitleAndInfoRows(worksheet, assignment, submissions, lastCol);

    const headerRowNum = 4; // Simplified: Title (row 1), Date (row 2), Empty (row 3), Header (row 4)
    styleHeaderRow(worksheet, headerRowNum, baseColumns, questionColumns, endColumns);

    const dataStartRow = headerRowNum + 1;
    populateDataRows(worksheet, submissions, dataStartRow);

    // Add freeze panes to keep headers visible when scrolling
    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 3, // Freeze first 3 columns (Serial No, Student ID, Student Name)
        ySplit: headerRowNum, // Freeze all rows up to and including header
        topLeftCell: `D${headerRowNum + 1}`, // Top-left cell of the unfrozen area
        activeCell: 'A1'
      }
    ];

    // Add auto-filter to header row for easy data filtering
    worksheet.autoFilter = {
      from: `A${headerRowNum}`,
      to: `${lastCol}${headerRowNum}`
    };

    addSummaryStatistics(worksheet, submissions, lastCol);

    await writeAndSendExcel(res, workbook, assignment);

  } catch (error) {
    console.error('Error exporting to Excel:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An error occurred while exporting data to Excel: ' + error.message });
    }
  }
};

// Get converted PDF for a submission (if IPYNB was converted)
exports.getSubmissionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const pdfInfo = getSubmissionPdfInfo(submission);
    
    if (!pdfInfo.hasConvertedPdf) {
      return res.status(404).json({ 
        error: 'No converted PDF available for this submission',
        fileInfo: pdfInfo
      });
    }
    
    // Check if the PDF file exists
    try {
      await fs.access(pdfInfo.pdfFile);
    } catch (err) {
      return res.status(404).json({ 
        error: 'PDF file not found on disk',
        expectedPath: pdfInfo.pdfFile
      });
    }
    
    // Set appropriate headers for PDF
    const fileName = path.basename(pdfInfo.pdfFile);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Stream the PDF file
    const readStream = require('fs').createReadStream(pdfInfo.pdfFile);
    readStream.pipe(res);
    
    readStream.on('error', (err) => {
      console.error('Error streaming PDF file:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading PDF file' });
      }
    });
    
  } catch (error) {
    console.error('Error getting submission PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An error occurred while retrieving the PDF' });
    }
  }
};

// Get submission file information including PDF paths
exports.getSubmissionFileInfo = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const pdfInfo = getSubmissionPdfInfo(submission);
    
    res.status(200).json({
      submissionId: submission._id,
      studentId: submission.studentId,
      studentName: submission.studentName,
      fileInfo: pdfInfo,
      processingStatus: submission.processingStatus,
      evaluationStatus: submission.evaluationStatus
    });
    
  } catch (error) {
    console.error('Error getting submission file info:', error);
    res.status(500).json({ error: 'An error occurred while retrieving submission file information' });
  }
};

// Delete a submission
exports.deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Submission ID is required' });
    }
    
    const submission = await Submission.findById(id);
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Delete original submission file
    if (submission.submissionFile) {
      try {
        await fs.unlink(submission.submissionFile);
        console.log(`Deleted original submission file: ${submission.submissionFile}`);
      } catch (fileError) {
        console.error(`Error deleting original submission file: ${fileError}`);
      }
    }
    
    // Delete converted PDF file if it exists and is different from original
    if (submission.processedFilePath && submission.processedFilePath !== submission.submissionFile) {
      try {
        await fs.unlink(submission.processedFilePath);
        console.log(`Deleted converted PDF file: ${submission.processedFilePath}`);
      } catch (fileError) {
        console.error(`Error deleting converted PDF file: ${fileError}`);
      }
    }
    
    const deleteResult = await Submission.findByIdAndDelete(id);
    
    if (!deleteResult) {
      return res.status(500).json({ error: 'Failed to delete submission from database' });
    }
    
    console.log(`Successfully deleted submission ${id} from database`);
    
    res.status(200).json({ 
      success: true,
      message: 'Submission deleted successfully',
      deletedId: id
    });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'An error occurred while deleting the submission' });
  }
};