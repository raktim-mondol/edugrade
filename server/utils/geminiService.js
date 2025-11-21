/**
 * Google Gemini API Service
 * Handles assignment evaluation after processing
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const fs = require('fs').promises; // Import fs promises

// Load environment variables
dotenv.config();

// Helper function to clean JSON responses from markdown formatting
function cleanJsonResponse(responseText) {
  let cleanedResponse = responseText.trim();
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    console.log("Removed markdown JSON formatting from response");
  } else if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    console.log("Removed generic markdown formatting from response");
  }
  return cleanedResponse;
}

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configuration
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.5-pro", // Use environment variable with fallback
  generationConfig: {
    temperature: 0.2, // Lower temperature for more deterministic grading
    maxOutputTokens: 65536, // Maximum output tokens for Gemini 2.5 Pro
    responseMimeType: "application/json", // Request JSON output directly
  },
  safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  ],
});

// Rate limiting for Gemini API (5 RPM = 1 request every 12 seconds)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 12000; // 12 seconds between requests
const requestQueue = [];
let isProcessingQueue = false;

// Helper function to enforce rate limiting
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${waitTime}ms before next request (RPM: 5)`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

// Queue system for handling multiple requests sequentially
async function addToQueue(apiCall) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ apiCall, resolve, reject });
    console.log(`Added request to queue. Queue length: ${requestQueue.length}`);
    processQueue();
  });
}

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }
  
  isProcessingQueue = true;
  console.log(`Processing queue with ${requestQueue.length} requests`);
  
  while (requestQueue.length > 0) {
    const { apiCall, resolve, reject } = requestQueue.shift();
    
    try {
      await enforceRateLimit();
      const result = await apiCall();
      resolve(result);
      console.log(`Request completed. Remaining in queue: ${requestQueue.length}`);
    } catch (error) {
      console.error(`Request failed. Remaining in queue: ${requestQueue.length}`, error.message);
      reject(error);
    }
  }
  
  isProcessingQueue = false;
  console.log(`Queue processing completed`);
}

// Helper function for retry logic with exponential backoff and rate limiting
async function withRetry(apiCall, maxRetries = 3, baseDelay = 15000) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      // Use the queue system to handle rate limiting
      return await addToQueue(apiCall);
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) {
        throw error;
      }
      
      // Handle quota limits specifically
      if (error.status === 429) {
        // Extract retry delay from error if available
        const retryAfter = error.errorDetails?.find(detail => 
          detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
        )?.retryDelay;
        
        let waitTime = Math.max(baseDelay, 30000); // At least 30 seconds for rate limits
        
        if (retryAfter) {
          // Parse retry delay (e.g., "11s" -> 11000ms)
          const seconds = parseInt(retryAfter.replace('s', ''));
          if (!isNaN(seconds)) {
            waitTime = Math.max(waitTime, seconds * 1000);
          }
        }
        
        console.log(`Rate limit hit, waiting ${waitTime}ms before retry ${attempts}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // For other errors, use longer delays due to rate limits
        const waitTime = Math.max(baseDelay, 15000 * Math.pow(2, attempts - 1));
        console.log(`API error, waiting ${waitTime}ms before retry ${attempts}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
}

// Helper function to calculate total possible score
function calculateTotalPossibleScore(assignmentData, rubricData) {
  const userProvidedPoints = assignmentData?.totalPoints ? Number(assignmentData.totalPoints) : null;
  let calculatedTotal = 0;

  const questionStructure = assignmentData?.questionStructure || [];
  if (questionStructure.length > 0) {
    questionStructure.forEach(question => {
      if (question.subQuestions && question.subQuestions.length > 0) {
        question.subQuestions.forEach(subQ => {
          calculatedTotal += Number(subQ.points || 0);
        });
      } else {
        calculatedTotal += Number(question.points || 0);
      }
    });
  } else {
    const rubricCriteria = rubricData?.grading_criteria || [];
    if (rubricCriteria.length > 0) {
      rubricCriteria.forEach(criterion => {
        if (criterion.weight) {
          calculatedTotal += parseFloat(criterion.weight);
        }
      });
    }
  }

  return userProvidedPoints !== null ? userProvidedPoints : (calculatedTotal > 0 ? calculatedTotal : 100);
}

/**
 * Gets a response from Gemini API
 * @param {string} prompt - The prompt to send to Gemini
 * @param {boolean} jsonResponse - Whether to expect a JSON response
 * @returns {Promise<string>} - The text response from Gemini
 */
async function getGeminiResponse(prompt, jsonResponse = false) {
  try {
    // Configure the model for this specific request
    const modelConfig = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
      generationConfig: {
        temperature: jsonResponse ? 0.1 : 0.4, // Lower temperature for JSON responses
        maxOutputTokens: 65536,
        responseMimeType: jsonResponse ? "application/json" : "text/plain",
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    });
    
    // Call the API with retries
    const result = await withRetry(async () => {
      const start = Date.now();
      const response = await modelConfig.generateContent(prompt);
      console.log(`Gemini API call completed in ${Date.now() - start}ms`);
      return response;
    });
    
    // Extract and return the text response
    const responseText = result.response.text();
    
    // Print the full API response for debugging
    console.log('=== GEMINI TEXT API RESPONSE START ===');
    console.log(responseText);
    console.log('=== GEMINI TEXT API RESPONSE END ===');
    
    return responseText;
  } catch (error) {
    console.error('Error getting Gemini response:', error);
    throw new Error(`Failed to get response from Gemini API: ${error.message}`);
  }
}

/**
 * Evaluate student submission against assignment, rubric, and solution using direct file input
 * @param {Object} assignmentData - Processed assignment data
 * @param {Object} rubricData - Processed rubric data
 * @param {Object} solutionData - Processed solution data
 * @param {string} submissionFilePath - Path to the student's submission file (PDF or .ipynb)
 * @param {string} studentId - ID of the student who made the submission
 * @param {Object} orchestratedData - Optional orchestrated validation and mapping data
 * @returns {Promise<Object>} - Evaluation results with feedback and grades
 * 
 * Note: PDF files are sent directly to Gemini API. .ipynb files are converted to PDF first.
 */
async function evaluateSubmission(assignmentData, rubricData, solutionData, submissionFilePath, studentId, orchestratedData = null) {
  try {
    // Check if proper data exists (rubricData is optional)
    if (!assignmentData || !submissionFilePath) {
      throw new Error("Missing required data (assignment or file path) for evaluation");
    }
    
    // Store original file path for cleanup later
    const originalSubmissionPath = submissionFilePath;
    
    // Determine file type from extension
    const path = require('path');
    const fileExtension = path.extname(submissionFilePath).toLowerCase();
    let mimeType, originalFileType;
    
    if (fileExtension === '.pdf') {
      mimeType = 'application/pdf';
      originalFileType = '.pdf';
    } else if (fileExtension === '.ipynb') {
      // For .ipynb files, we'll process them with pdfExtractor to convert to PDF
      const { processFileForGemini } = require('./pdfExtractor');
      const fileProcessResult = await processFileForGemini(submissionFilePath);
      
      if (!fileProcessResult.success) {
        throw new Error(`Failed to process Jupyter notebook: ${fileProcessResult.error}`);
      }
      
      submissionFilePath = fileProcessResult.filePath; // Use the converted PDF file
      mimeType = 'application/pdf';
      originalFileType = '.ipynb';
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}. Only PDF and .ipynb files are supported.`);
    }
    
    console.log(`Processing ${originalFileType} file for Gemini evaluation: ${submissionFilePath}`);
    
    // Read the file directly (PDF or HTML converted from .ipynb)
    let fileBuffer;
    try {
      fileBuffer = await fs.readFile(submissionFilePath);
    } catch (readError) {
      console.error(`Error reading submission file ${submissionFilePath}:`, readError);
      throw new Error(`Failed to read submission file: ${readError.message}`);
    }

    // Encode the file buffer to Base64
    const base64Data = fileBuffer.toString('base64');

    // --- Prepare prompt components ---
    const questionStructure = assignmentData.questionStructure || [];
    const userProvidedPoints = assignmentData.totalPoints ? Number(assignmentData.totalPoints) : null;
    
    // Calculate question structure text
    let questionStructureText = 'Question Structure:\n';
    if (questionStructure.length > 0) {
      questionStructure.forEach(q => {
        questionStructureText += `- Q${q.number || '?'}: ${q.question || 'N/A'} (${q.points || 0} points)\n`;
      });
    } else {
      questionStructureText += 'No specific question structure provided.\n';
    }

    // Calculate rubric criteria text
    const rubricCriteria = rubricData?.grading_criteria || [];
    let questionRubricText = 'Rubric Details per Question:\n';
    let criteriaQuestionMappingText = 'Criteria to Question Mapping:\n';
    if (rubricCriteria.length > 0) {
      rubricCriteria.forEach(crit => {
        const qNum = crit.question_number || 'General';
        questionRubricText += `- Criterion: ${crit.criterionName || 'N/A'} (Max: ${crit.weight || 0} points)\n  Description: ${crit.description || 'N/A'}\n`;
        if (crit.marking_scale) {
          questionRubricText += `  Scale: ${crit.marking_scale}\n`;
        }
        criteriaQuestionMappingText += `- Criterion '${crit.criterionName || 'N/A'}' applies to Question(s): ${qNum}\n`;
      });
    } else {
      questionRubricText += rubricData ? 'No detailed rubric criteria found.\n' : 'No separate rubric provided - using assignment instructions for grading.\n';
      criteriaQuestionMappingText += rubricData ? 'No criteria-question mapping available.\n' : 'Grading criteria should be derived from assignment instructions.\n';
    }

    // Calculate total possible score
    const totalPossibleScore = calculateTotalPossibleScore(assignmentData, rubricData);
    
    // --- Construct the Text Part of the Prompt --- 
    const fileTypeDescription = originalFileType === '.ipynb' 
      ? 'Jupyter notebook (converted to PDF)' 
      : 'PDF document';
    
    const textPromptPart = `
You are an automated assignment grading assistant. Your task is to evaluate the student's submission provided as a ${fileTypeDescription} against the assignment requirements, grading rubric, model solution, and the specific question structure provided below. 

⚠️ **CRITICAL REQUIREMENT - READ THIS FIRST:**
You MUST provide DETAILED SUBSECTION-LEVEL grading for EVERY SINGLE QUESTION in the criteriaGrades array.
- If a question has subsections (e.g., 1a, 1b, 1c), you MUST create SEPARATE criteriaGrade entries for EACH subsection
- If a question has NO subsections, you MUST still create at least ONE criteriaGrade entry for that question
- NEVER summarize multiple subsections into one entry
- NEVER skip any questions
This is NOT optional - it is MANDATORY for every submission.

${originalFileType === '.ipynb' ? 
  'This submission was originally a Jupyter notebook containing code cells, markdown explanations, and execution outputs, which has been converted to PDF format. Analyze all content including code, explanations, outputs, plots, and any visual elements.' :
  'This is a PDF document submission. Analyze the entire content of the document including text, images, tables, charts, graphs, code snippets, mathematical expressions, diagrams, and any visual elements.'
}

ASSIGNMENT INFORMATION:
Title: ${assignmentData.title || "No title provided"}
Description: ${assignmentData.description || "No description provided"}
${questionStructureText}

GRADING RUBRIC:
${rubricCriteria.length > 0 ? '**A DETAILED GRADING RUBRIC HAS BEEN PROVIDED - THIS IS THE PRIMARY GRADING STANDARD**' : ''}
Total Points: ${totalPossibleScore}
${rubricCriteria.length > 0 ? `Grading Criteria: ${rubricCriteria.length} criteria found - EACH MUST BE APPLIED` : "No specific grading criteria found - derive from assignment instructions"}
${questionRubricText}
${criteriaQuestionMappingText}

MODEL SOLUTION:
${solutionData && Object.keys(solutionData).length > 0 && !solutionData.processing_error ? 
  `Solution available with ${solutionData.questions ? solutionData.questions.length : 0} question(s)` : 
  "No model solution available or solution processing failed."}

STUDENT INFORMATION:
Student ID: ${studentId || 'Not provided'}

${orchestratedData ? `
ORCHESTRATION INSIGHTS (INTEGRATED GRADING STRUCTURE):
This assignment has been analyzed for consistency and completeness. Use the following insights to guide your evaluation:

Validation Status:
- Overall Status: ${orchestratedData.validation?.isValid ? '✓ VALID' : '⚠ HAS ISSUES'}
- Completeness Score: ${orchestratedData.validation?.completenessScore || 0}%
- Questions with Rubric Mapping: ${orchestratedData.statistics?.questionsWithRubric || 0}/${orchestratedData.statistics?.totalQuestions || 0}
- Questions with Solution: ${orchestratedData.statistics?.questionsWithSolution || 0}/${orchestratedData.statistics?.totalQuestions || 0}

${orchestratedData.validation?.issues && orchestratedData.validation.issues.length > 0 ? `
Known Issues to Be Aware Of:
${orchestratedData.validation.issues.map((issue, idx) => 
  `${idx + 1}. [${issue.severity?.toUpperCase()}] ${issue.message}${issue.affectedQuestions && issue.affectedQuestions.length > 0 ? ` (Questions: ${issue.affectedQuestions.join(', ')})` : ''}`
).join('\n')}
` : ''}

${orchestratedData.recommendations && orchestratedData.recommendations.length > 0 ? `
Grading Recommendations:
${orchestratedData.recommendations.map((rec, idx) => 
  `${idx + 1}. [${rec.priority?.toUpperCase()}] ${rec.recommendation}`
).join('\n')}
` : ''}

INTEGRATED QUESTION STRUCTURE (Use this as your primary grading guide):
${orchestratedData.integratedStructure?.questions ? 
  orchestratedData.integratedStructure.questions.map(q => {
    let questionInfo = `
Question ${q.number}: ${q.text}
- Total Points: ${q.points}
- Requirements: ${q.requirements && q.requirements.length > 0 ? q.requirements.join('; ') : 'See assignment description'}`;
    
    if (q.rubricCriteria && q.rubricCriteria.length > 0) {
      questionInfo += `
- Rubric Criteria (${q.rubricCriteria.length} criteria):
${q.rubricCriteria.map((c, idx) => 
  `  ${idx + 1}. ${c.name} (Weight: ${c.weight || 'N/A'})
     Description: ${c.description || 'N/A'}
     ${c.markingScale ? `Marking Scale: ${c.markingScale}` : ''}`
).join('\n')}`;
    }
    
    if (q.solution?.available) {
      questionInfo += `
- Solution Available: Yes
  Summary: ${q.solution.summary || 'See full solution'}
  Key Points: ${q.solution.keyPoints && q.solution.keyPoints.length > 0 ? q.solution.keyPoints.join('; ') : 'See solution details'}`;
    } else {
      questionInfo += `
- Solution Available: No - Use assignment requirements for grading`;
    }
    
    return questionInfo;
  }).join('\n---\n')
  : 'No integrated structure available - use raw assignment/rubric data'}

**IMPORTANT**: The integrated structure above combines assignment questions, rubric criteria, and solutions into a unified grading guide. Use this structure as your PRIMARY reference for grading each question.
` : ''}

EVALUATION INSTRUCTIONS:
1. Analyze the attached ${fileTypeDescription} which contains the student's submission.
2. **Pay close attention to ALL content, including text, code, outputs, figures, images, charts, graphs, tables, mathematical expressions, and diagrams.**
3. ${originalFileType === '.ipynb' ? 
   'For Jupyter notebooks (converted to PDF), evaluate code quality, correctness, execution results, explanations in markdown cells, and any visualizations or plots. Pay attention to the cell structure and outputs that show the execution flow.' :
   'For PDF documents, carefully examine all text content, code snippets, mathematical expressions, diagrams, charts, and visual elements. Pay special attention to handwritten or typed answers, code implementations, calculations, and any visual representations of solutions.'
  }
4. The TOTAL maximum score for this assignment is ${totalPossibleScore} points.
5. Grade EXACTLY according to the provided question structure and point values.
6. Each question or subquestion must receive a score matching its defined point value in the question structure.
7. ${rubricCriteria.length > 0 ? 
    '**IMPORTANT: A grading rubric has been provided. You MUST follow the rubric criteria strictly for each question. Use the specific criteria descriptions, marking scales, and point distributions defined in the rubric. Reference all content (text, code, visuals, outputs) when applying the rubric criteria.**' : 
    'Since no explicit rubric is provided, derive grading criteria from the assignment instructions and question descriptions. Create appropriate evaluation criteria based on what each question is asking for.'
  }
8. ${rubricCriteria.length > 0 ? '**CRITICAL: Use the question-to-criteria mappings provided in the rubric. Each criterion is mapped to specific question(s) and must be applied accordingly with the specified weights.**' : 'Base your grading criteria on standard expectations for the type of questions asked (e.g., correctness, completeness, clarity, code quality, explanation depth).'}
9. Do NOT convert scores to percentages. Use the raw scores exactly as specified.
10. Provide detailed feedback for each question/subquestion${rubricCriteria.length > 0 ? ', **explicitly referencing which rubric criteria were met or not met**' : ''}${solutionData && Object.keys(solutionData).length > 0 && !solutionData.processing_error ? ' and comparing with the model solution' : ''} where applicable.
11. ${originalFileType === '.ipynb' ? 
    'Include assessment of code implementation, execution results, documentation quality, and any visualizations. Consider the logical flow of the notebook and the quality of outputs.' :
    'Include assessment of written explanations, code implementations (if any), mathematical work, diagrams, and any visual elements in your feedback. Describe what you observe in the document.'
   }
12. Provide an overall grade (sum of question/subquestion scores), ensuring it does not exceed the total possible score.
13. Provide a list of strengths observed in the submission (considering all content).
14. Provide a list of areas for improvement (considering all content).
15. Provide concrete suggestions for the student.
${rubricCriteria.length > 0 ? '\n**REMINDER: When a rubric is provided, it is the PRIMARY grading standard. All scores and feedback must align with the rubric criteria.**' : ''}

OUTPUT REQUIREMENTS:
Provide your response ONLY as a valid JSON object matching the requested structure. The JSON object must include:
- "overallGrade": <number> (Sum of scores, cannot exceed totalPossibleScore)
- "totalPossible": <number> (The total possible score: ${totalPossibleScore})
- "criteriaGrades": Array of objects with MANDATORY subsection breakdown for EVERY question. Each object must have:
  * "questionNumber": <string> (e.g., "1", "2", "1a", "1b")
  * "criterionName": <string> (descriptive name of what's being graded)
  * "score": <number> (points awarded)
  * "maxScore": <number> (maximum possible points)
  * "feedback": <string> (detailed explanation, minimum 20 words)
  
  **CRITICAL RULES FOR criteriaGrades:**
  1. EVERY question from the question structure MUST have AT LEAST ONE entry in criteriaGrades
  2. If a question has no explicit subsections, create ONE criteriaGrade entry for that entire question
  3. If a question has multiple parts/subsections, create SEPARATE criteriaGrade entries for each part
  4. Question numbers in criteriaGrades MUST match the question structure exactly
  5. The sum of all scores in criteriaGrades MUST equal overallGrade
  6. Each criteriaGrade entry MUST have substantive feedback (minimum 20 words)
  
  Example for a simple question with no subsections:
  {
    "questionNumber": "1",
    "criterionName": "Question 1: Complete Solution",
    "score": 8,
    "maxScore": 10,
    "feedback": "The solution demonstrates good understanding of the core concepts. Code implementation is correct but could benefit from better documentation and error handling."
  }
  
  Example for a question with subsections:
  [
    {
      "questionNumber": "2a",
      "criterionName": "Question 2a: Data Loading and Preprocessing",
      "score": 3,
      "maxScore": 3,
      "feedback": "Correctly loaded the dataset using pandas. Proper handling of missing values and data types. Clean preprocessing pipeline implemented."
    },
    {
      "questionNumber": "2b", 
      "criterionName": "Question 2b: Statistical Analysis and Visualization",
      "score": 5,
      "maxScore": 7,
      "feedback": "Analysis shows good effort with appropriate statistical tests. However, visualizations lack proper labels and the interpretation of results is incomplete. Need more detailed discussion of findings."
    }
  ]

- "questionScores": Array of objects with detailed question-level breakdown. Each object must include:
  * "questionNumber": <string> (e.g., "1", "2", "3" for main questions)
  * "questionText": <string> (Brief summary of the question)
  * "maxScore": <number> (Maximum possible points for this question/subsection)
  * "earnedScore": <number> (Points earned by the student)
  * "feedback": <string> (Specific feedback for this question/subsection)
  * "subsections": Array of objects (if question has subsections like a, b, c or i, ii, iii, otherwise empty array). Each subsection object includes:
    - "subsectionNumber": <string> (e.g., "a", "b", "i", "ii", "1", "2")
    - "subsectionText": <string> (Brief summary)
    - "maxScore": <number>
    - "earnedScore": <number>
    - "feedback": <string>
- "strengths": Array of strings (minimum 3 strengths).
- "areasForImprovement": Array of strings (minimum 2 areas).
- "suggestions": Array of strings (minimum 2 concrete suggestions).

**YOU MUST NEVER SKIP SUBSECTION DETAILS IN criteriaGrades. Every question needs granular grading entries with detailed feedback.**

IMPORTANT: For questionScores, if a question has subsections (e.g., Question 1a, 1b, 1c), create ONE entry for Question 1 with subsections array containing 1a, 1b, 1c details. The question's earnedScore should be the sum of subsection scores.
`;

    // --- Construct the Multi-Modal Request Content --- 
    const contents = [
      { // Single turn for the user
        parts: [
          { text: textPromptPart }, // The detailed instructions and context
          {
            inlineData: { // The inline file data
              mimeType: mimeType,
              data: base64Data 
            }
          }
        ]
      }
    ];

    // --- Enhanced Debugging: Show what data Gemini is receiving ---
    console.log('\n=== GEMINI INPUT DEBUG INFO START ===');
    console.log(`Original file: ${originalSubmissionPath} (${originalFileType})`);
    console.log(`Submission file: ${submissionFilePath} (${mimeType})`);
    console.log(`File size: ${fileBuffer.length} bytes`);
    console.log(`Total possible score for evaluation: ${totalPossibleScore}`);
    
    console.log('\n--- ASSIGNMENT DATA STRUCTURE ---');
    console.log('Assignment title:', assignmentData.title || 'Not provided');
    console.log('Assignment description:', assignmentData.description || 'Not provided');
    console.log('Question structure count:', questionStructure.length);
    if (questionStructure.length > 0) {
      console.log('Questions:');
      questionStructure.forEach((q, i) => {
        console.log(`  Q${q.number || i+1}: ${q.question || 'N/A'} (${q.points || 0} points)`);
      });
    }
    
    console.log('\n--- RUBRIC DATA STRUCTURE ---');
    if (rubricData && rubricData.grading_criteria) {
      console.log('Rubric criteria count:', rubricData.grading_criteria.length);
      rubricData.grading_criteria.forEach((crit, i) => {
        console.log(`  Criterion ${i+1}: ${crit.criterionName || 'N/A'} (${crit.weight || 0} points)`);
        console.log(`    Question: ${crit.question_number || 'General'}`);
        console.log(`    Description: ${crit.description || 'N/A'}`);
      });
    } else {
      console.log('No rubric data available');
    }
    
    console.log('\n--- SOLUTION DATA STRUCTURE ---');
    if (solutionData && solutionData.questions) {
      console.log('Solution questions count:', solutionData.questions.length);
      solutionData.questions.forEach((q, i) => {
        console.log(`  Solution Q${q.number || i+1}: ${q.questionSummary || 'N/A'}`);
      });
    } else {
      console.log('No solution data available or processing failed');
    }
    
    console.log('\n--- ORCHESTRATED DATA STRUCTURE ---');
    if (orchestratedData) {
      console.log('✓ Orchestrated data is ACTIVE and will be used for evaluation');
      console.log('Validation status:', orchestratedData.validation?.isValid ? 'VALID' : 'HAS ISSUES');
      console.log('Completeness score:', orchestratedData.validation?.completenessScore || 0, '%');
      console.log('Integrated questions:', orchestratedData.integratedStructure?.questions?.length || 0);
      console.log('Issues found:', orchestratedData.validation?.issues?.length || 0);
      console.log('Recommendations:', orchestratedData.recommendations?.length || 0);
      if (orchestratedData.validation?.issues && orchestratedData.validation.issues.length > 0) {
        console.log('Issues:');
        orchestratedData.validation.issues.forEach((issue, idx) => {
          console.log(`  ${idx + 1}. [${issue.severity}] ${issue.message}`);
        });
      }
    } else {
      console.log('⚠ No orchestrated data available - using raw assignment/rubric/solution data');
    }
    
    console.log('\n--- PROMPT BEING SENT TO GEMINI ---');
    console.log(textPromptPart);
    console.log('=== GEMINI INPUT DEBUG INFO END ===\n');
    
    console.log(`Sending multi-modal evaluation request to Gemini API for ${originalFileType} file (as ${mimeType}): ${submissionFilePath}`);
    
    try {
      // --- Make the API Call --- 
      const result = await withRetry(async () => {
        const start = Date.now();
        const response = await model.generateContent({ contents });
        console.log(`Gemini API call completed in ${Date.now() - start}ms`);
        return response;
      });
      
      // Check if response exists and has the expected structure
      if (!result || !result.response || !result.response.candidates || !result.response.candidates[0]) {
        throw new Error("Invalid response structure from Gemini API");
      }
      
      const candidate = result.response.candidates[0];
      if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        throw new Error("No content found in Gemini response");
      }
      
      const evaluationResult = candidate.content.parts[0].text;
      console.log(`Gemini evaluation response text length: ${evaluationResult ? evaluationResult.length : 0}`);
      
      // Print the full API response for debugging
      console.log('=== GEMINI API RESPONSE START ===');
      console.log(evaluationResult);
      console.log('=== GEMINI API RESPONSE END ===');
      
      if (!evaluationResult || evaluationResult.trim() === '') {
        throw new Error("Empty response from Gemini API");
      }
      
      let parsedResult;
      try {
        const cleanedResponse = cleanJsonResponse(evaluationResult);
        parsedResult = JSON.parse(cleanedResponse);
      } catch (jsonError) {
        console.error("Failed to parse JSON response for evaluation:", evaluationResult.substring(0, 500));
        throw new Error(`Invalid JSON response from Gemini API: ${jsonError.message}`);
      }
      
      console.log(`Received and parsed JSON response from Gemini API.`);
      console.log(`Parsed result summary: overallGrade=${parsedResult.overallGrade}, totalPossible=${parsedResult.totalPossible}, criteriaGrades=${parsedResult.criteriaGrades ? parsedResult.criteriaGrades.length : 0} items`);
      
      // Ensure totalPossible is included
      if (!parsedResult.totalPossible && totalPossibleScore > 0) {
        parsedResult.totalPossible = totalPossibleScore;
        console.log(`Added missing totalPossible: ${totalPossibleScore}`);
      }
      
      // Basic validation
      if (typeof parsedResult.overallGrade !== 'number' || !Array.isArray(parsedResult.criteriaGrades)) {
          throw new Error("Gemini response did not match the expected JSON structure.");
      }

      // *** CRITICAL VALIDATION: Ensure criteriaGrades has entries for ALL questions ***
      console.log('\n=== CRITERIA GRADES VALIDATION START ===');
      const questionNumbers = questionStructure.map(q => String(q.number));
      console.log(`Expected questions from structure: [${questionNumbers.join(', ')}]`);
      console.log(`Received criteriaGrades count: ${parsedResult.criteriaGrades.length}`);
      
      // Check which questions are covered in criteriaGrades
      const coveredQuestions = new Set();
      parsedResult.criteriaGrades.forEach(cg => {
        const qNum = String(cg.questionNumber || '').replace(/[^\d]/g, '').split('')[0]; // Extract base question number
        if (qNum) coveredQuestions.add(qNum);
      });
      
      console.log(`Questions covered in criteriaGrades: [${Array.from(coveredQuestions).join(', ')}]`);
      
      // Find missing questions
      const missingQuestions = questionNumbers.filter(qn => !coveredQuestions.has(qn));
      
      if (missingQuestions.length > 0) {
        console.warn(`⚠️  WARNING: Missing criteriaGrades for questions: [${missingQuestions.join(', ')}]`);
        console.warn(`⚠️  This violates the prompt requirement that EVERY question must have criteriaGrades entries`);
        console.warn(`⚠️  LLM may not be following instructions properly. Consider re-running this submission.`);
        
        // Log the actual criteriaGrades for debugging
        console.log('Actual criteriaGrades received:');
        parsedResult.criteriaGrades.forEach((cg, idx) => {
          console.log(`  ${idx + 1}. Q${cg.questionNumber}: ${cg.criterionName} (${cg.score}/${cg.maxScore})`);
        });
      } else {
        console.log(`✅ All questions have criteriaGrades entries`);
      }
      
      // Validate that criteriaGrades has detailed breakdown (multiple entries per question if subsections exist)
      const questionCounts = {};
      parsedResult.criteriaGrades.forEach(cg => {
        const baseQ = String(cg.questionNumber || '').charAt(0);
        questionCounts[baseQ] = (questionCounts[baseQ] || 0) + 1;
      });
      
      console.log('CriteriaGrades count per question:', questionCounts);
      
      // Check if we have subsection-level detail in questionScores
      if (parsedResult.questionScores && Array.isArray(parsedResult.questionScores)) {
        parsedResult.questionScores.forEach(qs => {
          if (qs.subsections && qs.subsections.length > 0) {
            const qNum = String(qs.questionNumber);
            const subsectionCount = qs.subsections.length;
            const criteriaCount = questionCounts[qNum] || 0;
            
            if (subsectionCount > 1 && criteriaCount === 1) {
              console.warn(`⚠️  Question ${qNum} has ${subsectionCount} subsections but only ${criteriaCount} criteriaGrade entry`);
              console.warn(`⚠️  Expected ${subsectionCount} separate criteriaGrade entries for detailed breakdown`);
            }
          }
        });
      }
      
      console.log('=== CRITERIA GRADES VALIDATION END ===\n');
      // *** END VALIDATION ***

      // Clean up temporary PDF files if they were created from .ipynb
      if (originalFileType === '.ipynb' && submissionFilePath !== originalSubmissionPath) {
        try {
          if (require('fs').existsSync(submissionFilePath)) {
            require('fs').unlinkSync(submissionFilePath);
            console.log(`Cleaned up temporary PDF file: ${submissionFilePath}`);
          }
        } catch (cleanupError) {
          console.warn(`Could not clean up temporary PDF file ${submissionFilePath}:`, cleanupError.message);
        }
      }

      return parsedResult;

    } catch (apiError) {
      console.error("Gemini API error (multi-modal):", apiError);
      throw new Error(`Gemini API evaluation failed: ${apiError.message}`);
    }
  } catch (error) {
    console.error("Error evaluating submission with Gemini:", error);
    const totalPossibleScore = calculateTotalPossibleScore(assignmentData, rubricData);
    return {
      overallGrade: 0,
      totalPossible: totalPossibleScore,
      criteriaGrades: [],
      strengths: ["Could not evaluate due to technical error"],
      areasForImprovement: ["Resubmit for evaluation"],
      suggestions: ["Contact instructor for manual evaluation"],
      processingError: error.message
    };
  }
}

/**
 * Evaluate student submission using extracted text content (for .ipynb files)
 * @param {Object} assignmentData - Processed assignment data
 * @param {Object} rubricData - Processed rubric data
 * @param {Object} solutionData - Processed solution data
 * @param {string} submissionText - Extracted text content from the submission
 * @param {string} studentId - ID of the student who made the submission
 * @returns {Promise<Object>} - Evaluation results with feedback and grades
 */
async function evaluateSubmissionWithText(assignmentData, rubricData, solutionData, submissionText, studentId) {
  try {
    // --- Prepare prompt components ---
    const questionStructure = assignmentData.questionStructure || [];
    
    // Calculate question structure text
    let questionStructureText = 'Question Structure:\n';
    if (questionStructure.length > 0) {
      questionStructure.forEach(q => {
        questionStructureText += `- Q${q.number || '?'}: ${q.question || 'N/A'} (${q.points || 0} points)\n`;
      });
    } else {
      questionStructureText += 'No specific question structure provided.\n';
    }

    // Calculate rubric criteria text
    const rubricCriteria = rubricData?.grading_criteria || [];
    let questionRubricText = 'Rubric Details per Question:\n';
    let criteriaQuestionMappingText = 'Criteria to Question Mapping:\n';
    if (rubricCriteria.length > 0) {
      rubricCriteria.forEach(crit => {
        const qNum = crit.question_number || 'General';
        questionRubricText += `- Criterion: ${crit.criterionName || 'N/A'} (Max: ${crit.weight || 0} points)\n  Description: ${crit.description || 'N/A'}\n`;
        if (crit.marking_scale) {
          questionRubricText += `  Scale: ${crit.marking_scale}\n`;
        }
        criteriaQuestionMappingText += `- Criterion '${crit.criterionName || 'N/A'}' applies to Question(s): ${qNum}\n`;
      });
    } else {
      questionRubricText += rubricData ? 'No detailed rubric criteria found.\n' : 'No separate rubric provided - using assignment instructions for grading.\n';
      criteriaQuestionMappingText += rubricData ? 'No criteria-question mapping available.\n' : 'Grading criteria should be derived from assignment instructions.\n';
    }

    // Calculate total possible score
    const totalPossibleScore = calculateTotalPossibleScore(assignmentData, rubricData);
    
    const prompt = `
You are an automated assignment grading assistant. Your task is to evaluate the student's Jupyter notebook submission against the assignment requirements, grading rubric, and model solution provided below.

⚠️ **CRITICAL REQUIREMENT - READ THIS FIRST:**
You MUST provide DETAILED SUBSECTION-LEVEL grading for EVERY SINGLE QUESTION in the criteriaGrades array.
- If a question has subsections (e.g., 1a, 1b, 1c), you MUST create SEPARATE criteriaGrade entries for EACH subsection
- If a question has NO subsections, you MUST still create at least ONE criteriaGrade entry for that question
- NEVER summarize multiple subsections into one entry
- NEVER skip any questions
This is NOT optional - it is MANDATORY for every submission.

ASSIGNMENT INFORMATION:
Title: ${assignmentData.title || "No title provided"}
Description: ${assignmentData.description || "No description provided"}
${questionStructureText}

GRADING RUBRIC:
${rubricCriteria.length > 0 ? '**A DETAILED GRADING RUBRIC HAS BEEN PROVIDED - THIS IS THE PRIMARY GRADING STANDARD**' : ''}
Total Points: ${totalPossibleScore}
${rubricCriteria.length > 0 ? `Grading Criteria: ${rubricCriteria.length} criteria found - EACH MUST BE APPLIED` : "No specific grading criteria found - derive from assignment instructions"}
${questionRubricText}
${criteriaQuestionMappingText}

MODEL SOLUTION:
${solutionData && Object.keys(solutionData).length > 0 && !solutionData.processing_error ? 
  `Solution available with ${solutionData.questions ? solutionData.questions.length : 0} question(s)` : 
  "No model solution available or solution processing failed."}

STUDENT INFORMATION:
Student ID: ${studentId || 'Not provided'}

STUDENT SUBMISSION (Jupyter Notebook Content):
${submissionText}

EVALUATION INSTRUCTIONS:
1. Analyze the Jupyter notebook content which includes code cells, markdown cells, and outputs.
2. Pay attention to both the code implementation and any explanatory text in markdown cells.
3. Consider the execution outputs when evaluating the correctness of the solutions.
4. The TOTAL maximum score for this assignment is ${totalPossibleScore} points.
5. Grade EXACTLY according to the provided question structure and point values.
6. Each question or subquestion must receive a score matching its defined point value in the question structure.
7. ${rubricCriteria.length > 0 ? 
    '**IMPORTANT: A grading rubric has been provided. You MUST follow the rubric criteria strictly for each question. Use the specific criteria descriptions, marking scales, and point distributions defined in the rubric.**' : 
    'Since no explicit rubric is provided, derive grading criteria from the assignment instructions and question descriptions. Create appropriate evaluation criteria based on what each question is asking for.'
  }
8. ${rubricCriteria.length > 0 ? '**CRITICAL: Use the question-to-criteria mappings provided in the rubric. Each criterion is mapped to specific question(s) and must be applied accordingly with the specified weights.**' : 'Base your grading criteria on standard expectations for the type of questions asked (e.g., correctness, completeness, clarity, code quality, explanation depth).'}
9. Do NOT convert scores to percentages. Use the raw scores exactly as specified.
10. Provide detailed feedback for each question/subquestion${rubricCriteria.length > 0 ? ', **explicitly referencing which rubric criteria were met or not met**' : ''}${solutionData && Object.keys(solutionData).length > 0 && !solutionData.processing_error ? ' and comparing with the model solution' : ''} where applicable.
11. Consider code quality, correctness, documentation, and results when grading.
12. Provide an overall grade (sum of question/subquestion scores), ensuring it does not exceed the total possible score.
13. Provide a list of strengths observed in the submission.
14. Provide a list of areas for improvement.
15. Provide concrete suggestions for the student.
${rubricCriteria.length > 0 ? '\n**REMINDER: When a rubric is provided, it is the PRIMARY grading standard. All scores and feedback must align with the rubric criteria.**' : ''}

OUTPUT REQUIREMENTS:
Provide your response ONLY as a valid JSON object matching the requested structure. The JSON object must include:
- "overallGrade": <number> (Sum of scores, cannot exceed totalPossibleScore)
- "totalPossible": <number> (The total possible score: ${totalPossibleScore})
- "criteriaGrades": Array of objects with MANDATORY subsection breakdown for EVERY question. Each object must have:
  * "questionNumber": <string> (e.g., "1", "2", "1a", "1b")
  * "criterionName": <string> (descriptive name of what's being graded)
  * "score": <number> (points awarded)
  * "maxScore": <number> (maximum possible points)
  * "feedback": <string> (detailed explanation, minimum 20 words)
  
  **CRITICAL RULES FOR criteriaGrades:**
  1. EVERY question from the question structure MUST have AT LEAST ONE entry in criteriaGrades
  2. If a question has no explicit subsections, create ONE criteriaGrade entry for that entire question
  3. If a question has multiple parts/subsections, create SEPARATE criteriaGrade entries for each part
  4. Question numbers in criteriaGrades MUST match the question structure exactly
  5. The sum of all scores in criteriaGrades MUST equal overallGrade
  6. Each criteriaGrade entry MUST have substantive feedback (minimum 20 words)
  
  Example for a simple question with no subsections:
  {
    "questionNumber": "1",
    "criterionName": "Question 1: Complete Solution",
    "score": 8,
    "maxScore": 10,
    "feedback": "The solution demonstrates good understanding of the core concepts. Code implementation is correct but could benefit from better documentation and error handling."
  }
  
  Example for a question with subsections:
  [
    {
      "questionNumber": "2a",
      "criterionName": "Question 2a: Data Loading and Preprocessing",
      "score": 3,
      "maxScore": 3,
      "feedback": "Correctly loaded the dataset using pandas. Proper handling of missing values and data types. Clean preprocessing pipeline implemented."
    },
    {
      "questionNumber": "2b", 
      "criterionName": "Question 2b: Statistical Analysis and Visualization",
      "score": 5,
      "maxScore": 7,
      "feedback": "Analysis shows good effort with appropriate statistical tests. However, visualizations lack proper labels and the interpretation of results is incomplete. Need more detailed discussion of findings."
    }
  ]

- "questionScores": Array of objects with detailed question-level breakdown. Each object must include:
  * "questionNumber": <string> (e.g., "1", "2", "3" for main questions)
  * "questionText": <string> (Brief summary of the question)
  * "maxScore": <number> (Maximum possible points for this question/subsection)
  * "earnedScore": <number> (Points earned by the student)
  * "feedback": <string> (Specific feedback for this question/subsection)
  * "subsections": Array of objects (if question has subsections like a, b, c or i, ii, iii, otherwise empty array). Each subsection object includes:
    - "subsectionNumber": <string> (e.g., "a", "b", "i", "ii", "1", "2")
    - "subsectionText": <string> (Brief summary)
    - "maxScore": <number>
    - "earnedScore": <number>
    - "feedback": <string>
- "strengths": Array of strings (minimum 3 strengths).
- "areasForImprovement": Array of strings (minimum 2 areas).
- "suggestions": Array of strings (minimum 2 concrete suggestions).

**YOU MUST NEVER SKIP SUBSECTION DETAILS IN criteriaGrades. Every question needs granular grading entries with detailed feedback.**

IMPORTANT: For questionScores, if a question has subsections (e.g., Question 1a, 1b, 1c), create ONE entry for Question 1 with subsections array containing 1a, 1b, 1c details. The question's earnedScore should be the sum of subsection scores.
`;

    console.log(`Sending text-based evaluation request to Gemini API for Jupyter notebook content`);
    console.log(`Text length: ${submissionText.length} characters`);
    console.log(`Total possible score for evaluation: ${totalPossibleScore}`);
    
    const result = await getGeminiResponse(prompt, true);
    const cleanedResponse = cleanJsonResponse(result);
    const parsedResult = JSON.parse(cleanedResponse);
    
    console.log(`Received and parsed JSON response from Gemini API for notebook evaluation.`);
    console.log(`Parsed result summary: overallGrade=${parsedResult.overallGrade}, totalPossible=${parsedResult.totalPossible}, criteriaGrades=${parsedResult.criteriaGrades ? parsedResult.criteriaGrades.length : 0} items`);
    
    // Ensure totalPossible is included
    if (!parsedResult.totalPossible && totalPossibleScore > 0) {
      parsedResult.totalPossible = totalPossibleScore;
      console.log(`Added missing totalPossible: ${totalPossibleScore}`);
    }
    
    // Basic validation
    if (typeof parsedResult.overallGrade !== 'number' || !Array.isArray(parsedResult.criteriaGrades)) {
        throw new Error("Gemini response did not match the expected JSON structure.");
    }

    // *** CRITICAL VALIDATION: Ensure criteriaGrades has entries for ALL questions ***
    console.log('\n=== CRITERIA GRADES VALIDATION (Text-based) START ===');
    const questionNumbers = questionStructure.map(q => String(q.number));
    console.log(`Expected questions from structure: [${questionNumbers.join(', ')}]`);
    console.log(`Received criteriaGrades count: ${parsedResult.criteriaGrades.length}`);
    
    // Check which questions are covered in criteriaGrades
    const coveredQuestions = new Set();
    parsedResult.criteriaGrades.forEach(cg => {
      const qNum = String(cg.questionNumber || '').replace(/[^\d]/g, '').split('')[0]; // Extract base question number
      if (qNum) coveredQuestions.add(qNum);
    });
    
    console.log(`Questions covered in criteriaGrades: [${Array.from(coveredQuestions).join(', ')}]`);
    
    // Find missing questions
    const missingQuestions = questionNumbers.filter(qn => !coveredQuestions.has(qn));
    
    if (missingQuestions.length > 0) {
      console.warn(`⚠️  WARNING: Missing criteriaGrades for questions: [${missingQuestions.join(', ')}]`);
      console.warn(`⚠️  This violates the prompt requirement that EVERY question must have criteriaGrades entries`);
      console.warn(`⚠️  LLM may not be following instructions properly. Consider re-running this submission.`);
      
      // Log the actual criteriaGrades for debugging
      console.log('Actual criteriaGrades received:');
      parsedResult.criteriaGrades.forEach((cg, idx) => {
        console.log(`  ${idx + 1}. Q${cg.questionNumber}: ${cg.criterionName} (${cg.score}/${cg.maxScore})`);
      });
    } else {
      console.log(`✅ All questions have criteriaGrades entries`);
    }
    
    // Validate that criteriaGrades has detailed breakdown (multiple entries per question if subsections exist)
    const questionCounts = {};
    parsedResult.criteriaGrades.forEach(cg => {
      const baseQ = String(cg.questionNumber || '').charAt(0);
      questionCounts[baseQ] = (questionCounts[baseQ] || 0) + 1;
    });
    
    console.log('CriteriaGrades count per question:', questionCounts);
    
    // Check if we have subsection-level detail in questionScores
    if (parsedResult.questionScores && Array.isArray(parsedResult.questionScores)) {
      parsedResult.questionScores.forEach(qs => {
        if (qs.subsections && qs.subsections.length > 0) {
          const qNum = String(qs.questionNumber);
          const subsectionCount = qs.subsections.length;
          const criteriaCount = questionCounts[qNum] || 0;
          
          if (subsectionCount > 1 && criteriaCount === 1) {
            console.warn(`⚠️  Question ${qNum} has ${subsectionCount} subsections but only ${criteriaCount} criteriaGrade entry`);
            console.warn(`⚠️  Expected ${subsectionCount} separate criteriaGrade entries for detailed breakdown`);
          }
        }
      });
    }
    
    console.log('=== CRITERIA GRADES VALIDATION (Text-based) END ===\n');
    // *** END VALIDATION ***

    return parsedResult;

  } catch (error) {
    console.error("Error evaluating submission with text-based approach:", error);
    const totalPossibleScore = calculateTotalPossibleScore(assignmentData, rubricData);
    return {
      overallGrade: 0,
      totalPossible: totalPossibleScore,
      criteriaGrades: [],
      strengths: ["Could not evaluate due to technical error"],
      areasForImprovement: ["Resubmit for evaluation"],
      suggestions: ["Contact instructor for manual evaluation"],
      processingError: error.message
    };
  }
}

/**
 * Evaluates a project submission including code and/or report
 * @param {Object} submission - The ProjectSubmission object to evaluate
 * @param {Object} projectData - Optional DeepSeek processed project data
 * @param {Object} rubricData - Optional DeepSeek processed rubric data
 * @returns {Promise<Object>} - Returns the updated submission with evaluation results
 */
async function evaluateProjectSubmission(submission, projectData = null, rubricData = null) {
  try {
    // Start timing the evaluation
    submission.evaluationStartTime = new Date();
    submission.evaluationStatus = 'processing';
    await submission.save();
    
    // Get the project details for evaluation criteria
    const mongoose = require('mongoose');
    const Project = mongoose.model('Project');
    const project = await Project.findById(submission.projectId);
    
    if (!project) {
      throw new Error(`Project ${submission.projectId} not found`);
    }
    
    // Use provided project data or get it from database
    const processedProjectData = projectData || project.processedData;
    const processedRubricData = rubricData || project.processedRubric;
    
    console.log(`Evaluating project submission with ${processedProjectData ? 'provided' : 'db'} project data`);
    console.log(`Evaluating project submission with ${processedRubricData ? 'provided' : 'db'} rubric data`);
    
    // Initialize evaluation result
    let evaluationResult = {
      codeEvaluation: {
        score: null,
        feedback: null,
        strengths: [],
        improvements: [],
        detailedFeedback: {}
      },
      reportEvaluation: {
        score: null,
        feedback: null,
        strengths: [],
        improvements: [],
        detailedFeedback: {}
      },
      overallScore: null,
      overallFeedback: null
    };
    
    // Get rubric information from processed data or extract from file
    let rubricInfo = '';
    if (processedRubricData && processedRubricData.grading_criteria) {
      // Format the grading criteria for better prompting
      const criteria = processedRubricData.grading_criteria;
      rubricInfo = `Rubric (${processedRubricData.total_points || project.totalPoints} total points):\n`;
      criteria.forEach((criterion, index) => {
        rubricInfo += `${index+1}. ${criterion.criterionName || 'Criterion'} (${criterion.weight || 'N/A'} points): ${criterion.description || 'No description'}\n`;
        if (criterion.marking_scale) {
          rubricInfo += `   Scale: ${criterion.marking_scale}\n`;
        }
      });
    } else if (project.rubricFile) {
      // Use direct file processing for Gemini
      const { processFileForGemini } = require('../utils/pdfExtractor');
      try {
        const processResult = await processFileForGemini(project.rubricFile);
        if (processResult.success) {
          rubricInfo = `[Rubric PDF file processed: ${processResult.filePath}]`;
        } else {
          console.warn(`Could not process rubric file: ${processResult.error}`);
        }
      } catch (error) {
        console.warn(`Could not process rubric file: ${error.message}`);
        // Continue without rubric text
      }
    }
    
    // Project description with extracted content if available
    const extendedDescription = processedProjectData && processedProjectData.extracted_text 
      ? `${project.description}\n\nDetailed instructions: ${processedProjectData.extracted_text.substring(0, 2000)}...` 
      : project.description;
    
    // Evaluate code if present
    if (submission.codeFile && submission.codeText) {
      const codeEvaluation = await evaluateCode(
        submission.codeText,
        project.title,
        extendedDescription,
        rubricInfo,
        project.totalPoints / (project.codeRequired && project.reportRequired ? 2 : 1) // Allocate points based on submission requirements
      );
      
      evaluationResult.codeEvaluation = codeEvaluation;
    }
    
    // Evaluate report if present
    if (submission.reportFile && submission.reportText) {
      const reportEvaluation = await evaluateReport(
        submission.reportText,
        project.title,
        extendedDescription,
        rubricInfo,
        project.totalPoints / (project.codeRequired && project.reportRequired ? 2 : 1) // Allocate points based on submission requirements
      );
      
      evaluationResult.reportEvaluation = reportEvaluation;
    }
    
    // Calculate overall score and feedback
    const codeScore = evaluationResult.codeEvaluation.score || 0;
    const reportScore = evaluationResult.reportEvaluation.score || 0;
    
    if (project.codeRequired && project.reportRequired) {
      // Both are required, so average the scores
      evaluationResult.overallScore = (codeScore + reportScore) / 2;
    } else if (project.codeRequired) {
      // Only code required
      evaluationResult.overallScore = codeScore;
    } else if (project.reportRequired) {
      // Only report required
      evaluationResult.overallScore = reportScore;
    } else {
      // Neither required (shouldn't happen, but just in case)
      evaluationResult.overallScore = Math.max(codeScore, reportScore);
    }
    
    // Generate overall feedback
    try {
      const overallFeedback = await getOverallFeedback(
        project.title,
        submission.codeText || '',
        submission.reportText || '',
        evaluationResult.codeEvaluation.feedback || '',
        evaluationResult.reportEvaluation.feedback || '',
        evaluationResult.overallScore,
        project.totalPoints
      );
      
      evaluationResult.overallFeedback = overallFeedback;
    } catch (error) {
      console.error('Error generating overall feedback:', error);
      evaluationResult.overallFeedback = 'Could not generate overall feedback due to an error.';
    }
    
    // Update the submission with the evaluation results
    submission.evaluationResult = evaluationResult;
    submission.evaluationEndTime = new Date();
    submission.evaluationStatus = 'completed';
    await submission.save();
    
    return submission;
    
  } catch (error) {
    console.error(`Error evaluating project submission ${submission._id}:`, error);
    submission.evaluationStatus = 'failed';
    submission.evaluationError = error.message;
    submission.evaluationEndTime = new Date();
    await submission.save();
    throw error;
  }
}

/**
 * Evaluates code submission
 * @param {string} codeText - The extracted code text
 * @param {string} projectTitle - The project title
 * @param {string} projectDescription - The project description
 * @param {string} rubricText - Text from the rubric file
 * @param {number} maxPoints - Maximum points for the code portion
 * @returns {Promise<Object>} - Returns evaluation result for code
 */
async function evaluateCode(codeText, projectTitle, projectDescription, rubricText, maxPoints) {
  try {
    const prompt = `
You are an expert programming instructor tasked with evaluating a student's code submission.

Project Title: ${projectTitle}
Project Description: ${projectDescription}

${rubricText ? `Rubric Information:\n${rubricText}\n` : ''}

Please evaluate the following code submission and provide:
1. A score out of ${maxPoints} points
2. Detailed feedback (2-3 paragraphs)
3. 3-5 strengths of the submission
4. 3-5 areas for improvement
5. Specific feedback on:
   - Code quality and organization
   - Implementation of required functionality
   - Efficiency and performance considerations
   - Documentation and comments

CODE SUBMISSION:
\`\`\`
${codeText}
\`\`\`

Format your response as JSON:
{
  "score": <number>,
  "feedback": <string>,
  "strengths": [<string>, <string>, ...],
  "improvements": [<string>, <string>, ...],
  "detailedFeedback": {
    "codeQuality": <string>,
    "functionality": <string>,
    "efficiency": <string>,
    "documentation": <string>
  }
}
`;

    const result = await getGeminiResponse(prompt, true);
    let evaluationResult;
    
    try {
      const cleanedResponse = cleanJsonResponse(result);
      evaluationResult = JSON.parse(cleanedResponse);
      
      // Ensure score is within bounds
      evaluationResult.score = Math.min(Math.max(0, evaluationResult.score), maxPoints);
      
      return evaluationResult;
    } catch (error) {
      console.error('Error parsing code evaluation result:', error);
      throw new Error('Failed to parse code evaluation result');
    }
  } catch (error) {
    console.error('Error evaluating code:', error);
    return {
      score: 0,
      feedback: 'Failed to evaluate code submission due to an error.',
      strengths: [],
      improvements: ['Submit again to get a proper evaluation.'],
      detailedFeedback: {
        codeQuality: 'Not evaluated',
        functionality: 'Not evaluated',
        efficiency: 'Not evaluated',
        documentation: 'Not evaluated'
      }
    };
  }
}

/**
 * Evaluates report submission
 * @param {string} reportText - The extracted report text
 * @param {string} projectTitle - The project title
 * @param {string} projectDescription - The project description
 * @param {string} rubricText - Text from the rubric file
 * @param {number} maxPoints - Maximum points for the report portion
 * @returns {Promise<Object>} - Returns evaluation result for report
 */
async function evaluateReport(reportText, projectTitle, projectDescription, rubricText, maxPoints) {
  try {
    const prompt = `
You are an expert academic evaluator tasked with evaluating a student's project report.

Project Title: ${projectTitle}
Project Description: ${projectDescription}

${rubricText ? `Rubric Information:\n${rubricText}\n` : ''}

Please evaluate the following report submission and provide:
1. A score out of ${maxPoints} points
2. Detailed feedback (2-3 paragraphs)
3. 3-5 strengths of the report
4. 3-5 areas for improvement
5. Specific feedback on:
   - Content and argument quality
   - Structure and organization
   - Research and evidence
   - Writing style and clarity

REPORT CONTENT:
${reportText}

Format your response as JSON:
{
  "score": <number>,
  "feedback": <string>,
  "strengths": [<string>, <string>, ...],
  "improvements": [<string>, <string>, ...],
  "detailedFeedback": {
    "content": <string>,
    "structure": <string>,
    "research": <string>,
    "writingStyle": <string>
  }
}
`;

    const result = await getGeminiResponse(prompt, true);
    let evaluationResult;
    
    try {
      const cleanedResponse = cleanJsonResponse(result);
      evaluationResult = JSON.parse(cleanedResponse);
      
      // Ensure score is within bounds
      evaluationResult.score = Math.min(Math.max(0, evaluationResult.score), maxPoints);
      
      return evaluationResult;
    } catch (error) {
      console.error('Error parsing report evaluation result:', error);
      throw new Error('Failed to parse report evaluation result');
    }
  } catch (error) {
    console.error('Error evaluating report:', error);
    return {
      score: 0,
      feedback: 'Failed to evaluate report submission due to an error.',
      strengths: [],
      improvements: ['Submit again to get a proper evaluation.'],
      detailedFeedback: {
        content: 'Not evaluated',
        structure: 'Not evaluated',
        research: 'Not evaluated',
        writingStyle: 'Not evaluated'
      }
    };
  }
}

/**
 * Generates overall feedback for a project submission
 * @param {string} projectTitle - The project title
 * @param {string} codeText - The code text (if any)
 * @param {string} reportText - The report text (if any)
 * @param {string} codeFeedback - Feedback on the code
 * @param {string} reportFeedback - Feedback on the report
 * @param {number} overallScore - The overall score
 * @param {number} totalPoints - Total points possible
 * @returns {Promise<string>} - Returns overall feedback
 */
async function getOverallFeedback(projectTitle, codeText, reportText, codeFeedback, reportFeedback, overallScore, totalPoints) {
  try {
    const prompt = `
You are an expert instructor tasked with providing overall feedback on a student's project submission.

Project Title: ${projectTitle}

${codeText ? 'The student submitted code.' : ''}
${reportText ? 'The student submitted a report.' : ''}

${codeFeedback ? `Feedback on code: ${codeFeedback}` : ''}

${reportFeedback ? `Feedback on report: ${reportFeedback}` : ''}

Overall Score: ${overallScore} out of ${totalPoints}

Please provide a comprehensive overall feedback (2-3 paragraphs) that synthesizes the strengths and areas for improvement across the entire submission. Make your feedback constructive, specific, and actionable. Include:
1. An opening that acknowledges the student's effort
2. Summary of key strengths
3. Summary of main areas for improvement
4. Closing with encouragement and next steps

Your feedback should be helpful for the student's learning and growth.
`;

    return await getGeminiResponse(prompt);
  } catch (error) {
    console.error('Error generating overall feedback:', error);
    return 'Unable to generate overall feedback. Please review the individual feedback for code and report sections.';
  }
}

/**
 * Extract rubric/marking criteria from assignment PDF when no separate rubric file is provided
 * @param {string} pdfFilePath - Path to the assignment PDF file
 * @param {number} providedTotalPoints - Total points provided by the user (optional)
 * @returns {Promise<Object>} - Structured rubric data extracted from assignment
 */
async function extractRubricFromAssignmentPDF(pdfFilePath, providedTotalPoints = null) {
  try {
    console.log(`Extracting rubric from assignment PDF: ${pdfFilePath}`);
    
    // Read the PDF file
    const fs = require('fs').promises;
    const fileBuffer = await fs.readFile(pdfFilePath);
    const base64Data = fileBuffer.toString('base64');
    
    const defaultTotalPoints = 100;
    const totalPoints = providedTotalPoints || defaultTotalPoints;
    
    const prompt = `
You are analyzing an assignment document to extract marking criteria and rubric information. 

TASK: Look for ANY marking/grading information in this assignment document including:
- Point values for questions or tasks
- Marking schemes or criteria
- Grade distributions
- Evaluation guidelines
- Assessment weightings
- Marking rubrics embedded in the assignment

IMPORTANT INSTRUCTIONS:
1. Extract ALL grading/marking criteria found in the assignment document
2. Look for point values, percentages, or weights for different questions/sections
3. Find any marking guidelines, evaluation criteria, or assessment descriptions
4. If specific marking scales are mentioned (e.g., "Excellent: 4-5 points", "Good: 2-3 points"), extract those
5. The total points should be ${totalPoints} - adjust weights proportionally if needed
6. If no explicit marking criteria are found, create reasonable criteria based on the assignment requirements

Return as JSON with this structure:
{
  "has_embedded_rubric": true/false (whether explicit marking criteria were found),
  "grading_criteria": [
    {
      "question_number": "Question or section this applies to",
      "criterionName": "What is being evaluated",
      "weight": "Point value (numeric)",
      "description": "Detailed description of what this criterion measures",
      "marking_scale": "Description of performance levels and scoring"
    }
  ],
  "extracted_total_points": "Total points found in document (or null)",
  "total_points": ${totalPoints},
  "extraction_notes": "Notes about what marking information was found"
}

Analyze the PDF document thoroughly and return ONLY a JSON object.`;

    // Configure the model for PDF processing
    const modelConfig = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    });
    
    const contents = [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data 
            }
          }
        ]
      }
    ];

    console.log(`Sending assignment PDF to Gemini for rubric extraction: ${pdfFilePath}`);
    
    console.log('\n=== ASSIGNMENT RUBRIC EXTRACTION PROMPT DEBUG START ===');
    console.log('Prompt being sent to Gemini for Assignment Rubric extraction:');
    console.log(prompt);
    console.log('=== ASSIGNMENT RUBRIC EXTRACTION PROMPT DEBUG END ===\n');
    
    const result = await addToQueue(async () => {
      const start = Date.now();
      const response = await modelConfig.generateContent({ contents });
      console.log(`Gemini rubric extraction completed in ${Date.now() - start}ms`);
      return response;
    });
    
    // Check if response exists and has the expected structure
    if (!result || !result.response || !result.response.candidates || !result.response.candidates[0]) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const candidate = result.response.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      throw new Error("No content found in Gemini response");
    }
    
    const responseText = candidate.content.parts[0].text;
    console.log(`Gemini rubric extraction response text length: ${responseText ? responseText.length : 0}`);
    
    // Print the full API response for debugging
    console.log('\n=== GEMINI ASSIGNMENT RUBRIC EXTRACTION RESPONSE START ===');
    console.log(responseText);
    console.log('=== GEMINI ASSIGNMENT RUBRIC EXTRACTION RESPONSE END ===\n');
    
    if (!responseText || responseText.trim() === '') {
      throw new Error("Empty response from Gemini API");
    }
    
    let parsed;
    try {
      const cleanedResponse = cleanJsonResponse(responseText);
      parsed = JSON.parse(cleanedResponse);
    } catch (jsonError) {
      console.error("Failed to parse JSON response for assignment rubric extraction:", responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Gemini API: ${jsonError.message}`);
    }
    
    // Ensure the parsed response has the expected structure
    if (!parsed.grading_criteria) {
      parsed.grading_criteria = [];
    }
    
    // Make sure total_points is included
    if (!parsed.total_points) {
      parsed.total_points = totalPoints;
    }
    
    console.log(`Successfully extracted ${parsed.grading_criteria.length} rubric criteria from assignment PDF`);
    
    return parsed;
  } catch (error) {
    console.error("Error extracting rubric from assignment PDF:", error);
    return {
      has_embedded_rubric: false,
      grading_criteria: [
        {
          criterionName: "Processing Error",
          weight: "N/A",
          description: "There was an error extracting rubric from the assignment document.",
          marking_scale: "N/A"
        }
      ],
      total_points: providedTotalPoints || 100,
      extraction_notes: `Error during extraction: ${error.message}`,
      processing_error: error.message
    };
  }
}

/**
 * Process assignment document with Gemini API using direct PDF input
 * Enhanced to also extract rubric information when no separate rubric is provided
 * @param {string} pdfFilePath - Path to the assignment PDF file
 * @returns {Promise<Object>} - Structured assignment data with embedded rubric if found
 */
async function processAssignmentPDF(pdfFilePath) {
  try {
    console.log(`Processing assignment PDF directly with Gemini: ${pdfFilePath}`);
    
    // Read the PDF file
    const fs = require('fs').promises;
    const fileBuffer = await fs.readFile(pdfFilePath);
    const base64Data = fileBuffer.toString('base64');
    
    const prompt = `
You are analyzing an assignment document. Extract the following key information and return it as a valid JSON object.

IMPORTANT: Your response must be ONLY valid JSON. Start with { and end with }. Do not include any text before or after the JSON.

Extract these fields:
1. "title": The assignment name (string)
2. "description": Brief summary of the assignment (string, keep under 500 characters)
3. "questions": An array where each question includes:
   - "number": The question number (string, e.g., "1", "2", "1.1")
   - "question": The question text (string, keep under 200 characters)
   - "requirements": Key tasks students must complete (array of strings)
   - "constraints": Any limitations or restrictions (array of strings)
   - "expected_output": What students should deliver (string)
4. "has_marking_criteria": Boolean indicating if marking/grading criteria are present in the document
5. "total_points": Extract total points for the assignment (number, or null if not found)

Return ONLY the JSON object. Ensure the JSON is complete and properly closed with all braces and brackets.`;

    // Configure the model for PDF processing
    const modelConfig = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536, // Maximum output tokens for Gemini 2.5 Pro
        // Removed responseMimeType to avoid potential truncation issues
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    });
    
    const contents = [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data 
            }
          }
        ]
      }
    ];

    console.log(`Sending assignment PDF to Gemini API: ${pdfFilePath}`);
    console.log(`PDF file size: ${fileBuffer.length} bytes`);
    console.log(`Using maxOutputTokens: 65536`);
    
    console.log('\n=== ASSIGNMENT PDF PROMPT DEBUG START ===');
    console.log('Prompt being sent to Gemini for Assignment PDF processing:');
    console.log(prompt);
    console.log('=== ASSIGNMENT PDF PROMPT DEBUG END ===\n');
    
    const result = await addToQueue(async () => {
      const start = Date.now();
      const response = await modelConfig.generateContent({ contents });
      console.log(`Gemini PDF processing completed in ${Date.now() - start}ms`);
      return response;
    });
    
    // Check if response exists and has the expected structure
    if (!result || !result.response || !result.response.candidates || !result.response.candidates[0]) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const candidate = result.response.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      throw new Error("No content found in Gemini response");
    }
    
    const responseText = candidate.content.parts[0].text;
    console.log(`Gemini assignment response text length: ${responseText ? responseText.length : 0}`);
    
    // Print the full API response for debugging
    console.log('=== GEMINI ASSIGNMENT PDF RESPONSE START ===');
    console.log(responseText);
    console.log('=== GEMINI ASSIGNMENT PDF RESPONSE END ===');
    
    if (!responseText || responseText.trim() === '') {
      throw new Error("Empty response from Gemini API");
    }
    
    // Check if the response appears to be truncated (doesn't end with proper JSON closing)
    const trimmedResponse = responseText.trim();
    if (!trimmedResponse.endsWith('}') && !trimmedResponse.endsWith(']')) {
      console.warn("Response appears to be truncated - doesn't end with proper JSON closing");
      console.log(`Last 100 characters: ${trimmedResponse.slice(-100)}`);
    }
    
    let parsed;
    try {
      const cleanedResponse = cleanJsonResponse(responseText);
      parsed = JSON.parse(cleanedResponse);
    } catch (jsonError) {
      console.error("Failed to parse JSON response for assignment:", responseText.substring(0, 500));
      console.error("Full response for debugging:", responseText);
      throw new Error(`Invalid JSON response from Gemini API: ${jsonError.message}`);
    }
    
    return parsed;
  } catch (error) {
    console.error("Error processing assignment PDF with Gemini:", error);
    // Return minimal valid structure even in case of error
    return {
      title: "Error Processing Assignment",
      description: "There was an error processing the assignment document.",
      requirements: ["Please check the original document for requirements"],
      processing_error: error.message
    };
  }
}

/**
 * Legacy text-based processing function (for backward compatibility)
 * @param {string} extractedText - The text extracted from the assignment PDF
 * @returns {Promise<Object>} - Structured assignment data
 */
async function processAssignment(extractedText) {
  try {
    // Limit text size to prevent API timeout issues
    const maxChars = 150000;
    const trimmedText = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars) + "... [content truncated]"
      : extractedText;
    
    const prompt = `
You are analyzing an assignment document. Extract the following key information in JSON format:
1. Title: The assignment name
2. Description: Brief summary of the assignment
3. Questions: An array where each question includes:
   - number: The question number (e.g., "1", "2", "1.1")
   - question: The question text
   - requirements: Key tasks students must complete for this question
   - constraints: Any limitations or restrictions for this question
   - expected_output: What students should deliver for this question

Analyze this text and return ONLY a JSON object with these fields:
"""
${trimmedText}
"""`;

    console.log(`Sending assignment to Gemini API (${trimmedText.length} chars)`);
    
    const result = await getGeminiResponse(prompt, true);
    const cleanedResponse = cleanJsonResponse(result);
    const parsed = JSON.parse(cleanedResponse);
    
    return parsed;
  } catch (error) {
    console.error("Error processing assignment with Gemini:", error);
    // Return minimal valid structure even in case of error
    return {
      title: "Error Processing Assignment",
      description: "There was an error processing the assignment document.",
      requirements: ["Please check the original document for requirements"],
      processing_error: error.message
    };
  }
}

/**
 * Process rubric document with Gemini API using direct PDF input
 * @param {string} pdfFilePath - Path to the rubric PDF file
 * @param {number} providedTotalPoints - Total points provided by the user (optional)
 * @returns {Promise<Object>} - Structured rubric data
 */
async function processRubricPDF(pdfFilePath, providedTotalPoints = null) {
  try {
    console.log(`Processing rubric PDF directly with Gemini: ${pdfFilePath}`);
    
    // Read the PDF file
    const fs = require('fs').promises;
    const fileBuffer = await fs.readFile(pdfFilePath);
    const base64Data = fileBuffer.toString('base64');
    
    const defaultTotalPoints = 100;
    const totalPoints = providedTotalPoints || defaultTotalPoints;
    
    console.log(`Gemini Rubric Processing - Using total points: ${totalPoints}`);
    
    const prompt = `
Analyze this rubric document and extract the grading criteria information. For each criterion, include:
1. Question Number: The question or section number associated with the criterion (if available)
2. Name: What is being evaluated
3. Weight: How many points this criterion is worth
4. Description: Brief explanation of what this criterion measures
5. Marking Scale: Description of different performance levels and their corresponding scores

IMPORTANT INSTRUCTIONS:
1. The total points for this assignment is ${totalPoints} points.
2. Extract all grading criteria directly from the PDF document.
3. If point values for criteria are provided, use those exact values.
4. If specific criteria descriptions or marking scales are provided, extract those precisely.
5. Ensure the weights (point values) of all criteria sum up to the total points (${totalPoints}).
6. Do NOT invent criteria that aren't in the document.

Return as JSON with the following structure:
{
  "grading_criteria": [
  {
    "question_number": "Question or section number (if available)",
    "criterionName": "Name of criterion",
    "weight": "Point value (numeric)",
    "description": "What this criterion evaluates",
    "marking_scale": "Description of different performance levels"
  }
  ],
  "extracted_total_points": "The total points you found in the document (or null if none found)",
  "total_points": ${totalPoints}
}

Analyze the PDF document and return ONLY a JSON object with this structure.`;

    // Configure the model for PDF processing
    const modelConfig = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    });
    
    const contents = [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data 
            }
          }
        ]
      }
    ];

    console.log(`Sending rubric PDF to Gemini API: ${pdfFilePath}`);
    
    console.log('\n=== RUBRIC PDF PROMPT DEBUG START ===');
    console.log('Prompt being sent to Gemini for Rubric PDF processing:');
    console.log(prompt);
    console.log('=== RUBRIC PDF PROMPT DEBUG END ===\n');
    
    const result = await addToQueue(async () => {
      const start = Date.now();
      const response = await modelConfig.generateContent({ contents });
      console.log(`Gemini PDF processing completed in ${Date.now() - start}ms`);
      return response;
    });
    
    // Check if response exists and has the expected structure
    if (!result || !result.response || !result.response.candidates || !result.response.candidates[0]) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const candidate = result.response.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      throw new Error("No content found in Gemini response");
    }
    
    const responseText = candidate.content.parts[0].text;
    console.log(`Gemini rubric response text length: ${responseText ? responseText.length : 0}`);
    
    // Print the full API response for debugging
    console.log('\n=== GEMINI RUBRIC PDF RESPONSE START ===');
    console.log(responseText);
    console.log('=== GEMINI RUBRIC PDF RESPONSE END ===\n');
    
    if (!responseText || responseText.trim() === '') {
      throw new Error("Empty response from Gemini API");
    }
    
    let parsed;
    try {
      const cleanedResponse = cleanJsonResponse(responseText);
      parsed = JSON.parse(cleanedResponse);
    } catch (jsonError) {
      console.error("Failed to parse JSON response for rubric:", responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Gemini API: ${jsonError.message}`);
    }
    
    // Ensure the parsed response has the expected structure
    if (!parsed.grading_criteria) {
      parsed.grading_criteria = parsed.criteria || [];
    }
    
    // Make sure total_points is included
    if (!parsed.total_points) {
      parsed.total_points = totalPoints;
    }
    
    return parsed;
  } catch (error) {
    console.error("Error processing rubric PDF with Gemini:", error);
    return {
      grading_criteria: [
        {
          criterionName: "Processing Error",
          weight: "N/A",
          description: "There was an error processing the rubric document.",
          marking_scale: "N/A"
        }
      ],
      total_points: providedTotalPoints || 100,
      processing_error: error.message
    };
  }
}

/**
 * Legacy text-based rubric processing function (for backward compatibility)
 * @param {string} extractedText - The text extracted from the rubric PDF
 * @param {number} providedTotalPoints - Total points provided by the user (optional)
 * @returns {Promise<Object>} - Structured rubric data
 */
async function processRubric(extractedText, providedTotalPoints = null) {
  try {
    // Limit text size to prevent API timeout issues
    const maxChars = 150000;
    const trimmedText = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars) + "... [content truncated]"
      : extractedText;
    
    // First, let the API extract the total points from the PDF text if not provided
    if (providedTotalPoints === null) {
      console.log("No total points provided, attempting to extract from rubric text");
      
      const pointsPrompt = `
Extract ONLY the total possible points for this assignment from the rubric text. 
Return ONLY a single number representing the total points.

If the total points are explicitly mentioned (e.g., "Total: 20 points", "Maximum score: 15", etc.), use that value.
If no explicit total is given but individual point values are listed, add them up.
If you cannot determine the total points at all, return 100 as a default value.

RUBRIC TEXT:
"""
${trimmedText.substring(0, Math.min(trimmedText.length, 120000))}
"""

RETURN ONLY THE NUMERIC VALUE WITH NO EXPLANATION.`;

      try {
        console.log("Sending initial request to extract total points");
        const pointsResult = await getGeminiResponse(pointsPrompt, false);
        const extractedPoints = parseInt(pointsResult.trim());
        
        // Check if we got a valid number
        if (!isNaN(extractedPoints) && extractedPoints > 0) {
          console.log(`Successfully extracted total points from rubric text: ${extractedPoints}`);
          providedTotalPoints = extractedPoints;
        } else {
          console.log(`Failed to extract valid total points from text, got: ${pointsResult}`);
          providedTotalPoints = 100; // Default if extraction failed
        }
      } catch (pointsErr) {
        console.log(`Error extracting total points: ${pointsErr.message}`);
        providedTotalPoints = 100; // Default if extraction fails
      }
    }
    
    const defaultTotalPoints = 100;
    const totalPoints = providedTotalPoints || defaultTotalPoints;
    
    console.log(`Gemini Rubric Processing - Using total points: ${totalPoints}`);
    
    const prompt = `
Analyze this rubric document and extract the grading criteria information. For each criterion, include:
1. Question Number: The question or section number associated with the criterion (if available)
2. Name: What is being evaluated
3. Weight: How many points this criterion is worth
4. Description: Brief explanation of what this criterion measures
5. Marking Scale: Description of different performance levels and their corresponding scores

IMPORTANT INSTRUCTIONS:
1. The total points for this assignment is ${totalPoints} points.
2. Extract all grading criteria directly from the PDF text.
3. If point values for criteria are provided, use those exact values.
4. If specific criteria descriptions or marking scales are provided, extract those precisely.
5. Ensure the weights (point values) of all criteria sum up to the total points (${totalPoints}).
6. Do NOT invent criteria that aren't in the document.

Return as JSON with the following structure:
{
  "grading_criteria": [
  {
    "question_number": "Question or section number (if available)",
    "criterionName": "Name of criterion",
    "weight": "Point value (numeric)",
    "description": "What this criterion evaluates",
    "marking_scale": "Description of different performance levels"
  }
  ],
  "extracted_total_points": "The total points you found in the document (or null if none found)",
  "total_points": ${totalPoints}
}

Analyze the rubric text:
"""
${trimmedText}
"""`;

    console.log(`Sending rubric to Gemini API (${trimmedText.length} chars)`);

    const result = await getGeminiResponse(prompt, true);
    const cleanedResponse = cleanJsonResponse(result);
    const parsed = JSON.parse(cleanedResponse);
    
    // Ensure the parsed response has the expected structure
    if (!parsed.grading_criteria) {
      parsed.grading_criteria = parsed.criteria || [];
    }
    
    // Make sure total_points is included
    if (!parsed.total_points) {
      parsed.total_points = totalPoints;
    }
    
    return parsed;
  } catch (error) {
    console.error("Error processing rubric with Gemini:", error);
    return {
      grading_criteria: [
        {
          criterionName: "Processing Error",
          weight: "N/A",
          description: "There was an error processing the rubric document.",
          marking_scale: "N/A"
        }
      ],
      total_points: providedTotalPoints || 100,
      processing_error: error.message
    };
  }
}

/**
 * Process solution document with Gemini API using direct PDF input
 * @param {string} pdfFilePath - Path to the solution PDF file
 * @returns {Promise<Object>} - Structured solution data
 */
async function processSolutionPDF(pdfFilePath) {
  try {
    console.log(`Processing solution PDF directly with Gemini: ${pdfFilePath}`);
    
    // Read the PDF file
    const fs = require('fs').promises;
    const fileBuffer = await fs.readFile(pdfFilePath);
    const base64Data = fileBuffer.toString('base64');
      
    const prompt = `
Analyze this model solution PDF and extract information for each question.

For each question identified, extract:
1. questionNumber: The question number (e.g., "1", "2", "1.1")
2. questionSummary: Brief description of what the question asks
3. solution: The complete model solution or implementation provided
4. expectedOutput: Expected results when the solution is executed (if shown)
5. keySteps: Array of main implementation steps or approach
6. dependencies: Array of required libraries/imports (if any)

Return ONLY a valid JSON object with this EXACT structure:
{
  "questions": [
    {
      "questionNumber": "string",
      "questionSummary": "string", 
      "solution": "string",
      "expectedOutput": "string",
      "keySteps": ["string"],
      "dependencies": ["string"]
    }
  ]
}

Do NOT include any markdown formatting, code blocks, or explanatory text. Return ONLY the raw JSON object.`;

    // Configure the model for PDF processing
    const modelConfig = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    });
    
    const contents = [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data 
            }
          }
        ]
      }
    ];

    console.log(`Sending solution PDF to Gemini API: ${pdfFilePath}`);
    
    console.log('\n=== SOLUTION PDF PROMPT DEBUG START ===');
    console.log('Prompt being sent to Gemini for Solution PDF processing:');
    console.log(prompt);
    console.log('=== SOLUTION PDF PROMPT DEBUG END ===\n');
    
    const result = await addToQueue(async () => {
      const start = Date.now();
      const response = await modelConfig.generateContent({ contents });
      console.log(`Gemini PDF processing completed in ${Date.now() - start}ms`);
      return response;
    });
    
    // Check if response exists and has the expected structure
    if (!result || !result.response || !result.response.candidates || !result.response.candidates[0]) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const candidate = result.response.candidates[0];
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      throw new Error("No content found in Gemini response");
    }
    
    const responseText = candidate.content.parts[0].text;
    console.log(`Gemini solution response text length: ${responseText ? responseText.length : 0}`);
    
    // Print the full API response for debugging
    console.log('\n=== GEMINI SOLUTION PDF RESPONSE START ===');
    console.log(responseText);
    console.log('=== GEMINI SOLUTION PDF RESPONSE END ===\n');
    
    if (!responseText || responseText.trim() === '') {
      throw new Error("Empty response from Gemini API");
    }
    
    let parsed;
    try {
      const cleanedResponse = cleanJsonResponse(responseText);
      parsed = JSON.parse(cleanedResponse);
    } catch (jsonError) {
      console.error("Failed to parse JSON response for solution:", responseText.substring(0, 500));
      throw new Error(`Invalid JSON response from Gemini API: ${jsonError.message}`);
    }
    
    // Validate the response structure
    if (!parsed.questions) {
      console.warn("Gemini response missing 'questions' array. Response:", JSON.stringify(parsed));
      // If the response is directly an array, wrap it
      if (Array.isArray(parsed)) {
        parsed = { questions: parsed };
      } else {
        // Otherwise return empty questions array
        parsed = { questions: [] };
      }
    }
    
    console.log(`Successfully parsed solution with ${parsed.questions.length} question(s)`);
    
    return parsed;
  } catch (error) {
    console.error("Error processing solution PDF with Gemini:", error);
    return {
      questions: [],
      processing_error: error.message
    };
  }
}

/**
 * Legacy text-based solution processing function (for backward compatibility)
 * @param {string} extractedText - The text extracted from the solution PDF
 * @returns {Promise<Object>} - Structured solution data
 */
async function processSolution(extractedText) {
  try {
    // Limit text size to prevent API timeout issues
    const maxChars = 180000;
    const trimmedText = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars) + "... [content truncated]"
      : extractedText;
      
    const prompt = `
Analyze this model solution and extract for each question:
1. Question Number: The question number (e.g., "1", "2", "1.1")
2. Question Summary: Brief description of the question
3. Solution: The provided solution or implementation
4. Expected Output: Results when executed
5. Key Steps: Main implementation steps
6. Dependencies: Required libraries (if any)

Return as JSON with an array of questions, where each question has these fields.
"""
${trimmedText}
"""`;

    console.log(`Sending solution to Gemini API (${trimmedText.length} chars)`);

    const result = await getGeminiResponse(prompt, true);
    const cleanedResponse = cleanJsonResponse(result);
    const parsed = JSON.parse(cleanedResponse);
    
    return parsed;
  } catch (error) {
    console.error("Error processing solution with Gemini:", error);
    return {
      questions: [],
      processing_error: error.message
    };
  }
}

/**
 * Process student submission document with Gemini API
 * @param {string} extractedText - The text extracted from the student submission PDF
 * @param {string} studentId - ID of the student who made the submission
 * @returns {Promise<Object>} - Structured submission data
 */
async function processSubmission(extractedText, studentId) {
  try {
    // Limit text length for faster processing
    const maxLength = 5000;
    const truncatedText = extractedText.length > maxLength 
      ? extractedText.substring(0, maxLength) + "... [content truncated due to length]" 
      : extractedText;
      
    const prompt = `
Extract the main questions and answers from this student submission.
For each question, include:
- number: Question number (e.g. "1", "2", "1.1")
- content: Student's answer

Return as JSON with a "questions" array. If no clear questions found, create a "summary" field.
"""
${truncatedText}
"""`;

    console.log(`Sending submission to Gemini API (${truncatedText.length} chars)`);
    
    const result = await getGeminiResponse(prompt, true);
    const cleanedResponse = cleanJsonResponse(result);
    const parsed = JSON.parse(cleanedResponse);
    
    // Add student ID to the result
    parsed.student_id = studentId;
    
    return parsed;
  } catch (error) {
    console.error("Error processing submission with Gemini:", error);
    return {
      student_id: studentId,
      processing_error: error.message,
      summary: "Error processing submission",
      questions: []
    };
  }
}

/**
 * Orchestrate and validate assignment, rubric, and solution data
 * Creates integrated mappings and validates consistency across documents
 * Can re-read files if needed for better validation
 * @param {Object} assignmentData - Processed assignment data
 * @param {Object} rubricData - Processed rubric data (can be null)
 * @param {Object} solutionData - Processed solution data (can be null)
 * @param {Object} filePaths - Optional file paths for re-reading: { assignmentPath, rubricPath, solutionPath }
 * @returns {Promise<Object>} - Orchestrated and validated data with mappings
 */
async function orchestrateAssignmentData(assignmentData, rubricData, solutionData, filePaths = null) {
  try {
    console.log('Starting orchestration of assignment, rubric, and solution data...');
    
    // If file paths are provided and data seems incomplete, re-read the files
    let enhancedAssignmentData = assignmentData;
    let enhancedRubricData = rubricData;
    let enhancedSolutionData = solutionData;
    
    if (filePaths) {
      console.log('File paths provided for potential re-reading:');
      if (filePaths.assignmentPath) console.log('  - Assignment:', filePaths.assignmentPath);
      if (filePaths.rubricPath) console.log('  - Rubric:', filePaths.rubricPath);
      if (filePaths.solutionPath) console.log('  - Solution:', filePaths.solutionPath);
      
      // Re-read assignment if it seems incomplete or if requested
      if (filePaths.assignmentPath && (!assignmentData || !assignmentData.questions || assignmentData.questions.length === 0)) {
        console.log('Re-reading assignment file for better data...');
        try {
          enhancedAssignmentData = await processAssignmentPDF(filePaths.assignmentPath);
          console.log('Assignment re-read successful');
        } catch (error) {
          console.warn('Failed to re-read assignment:', error.message);
        }
      }
      
      // Re-read rubric if it seems incomplete or if requested
      if (filePaths.rubricPath && (!rubricData || !rubricData.grading_criteria || rubricData.grading_criteria.length === 0)) {
        console.log('Re-reading rubric file for better data...');
        try {
          enhancedRubricData = await processRubricPDF(filePaths.rubricPath);
          console.log('Rubric re-read successful');
        } catch (error) {
          console.warn('Failed to re-read rubric:', error.message);
        }
      }
      
      // Re-read solution if it seems incomplete or if requested
      if (filePaths.solutionPath && (!solutionData || !solutionData.questions || solutionData.questions.length === 0)) {
        console.log('Re-reading solution file for better data...');
        try {
          enhancedSolutionData = await processSolutionPDF(filePaths.solutionPath);
          console.log('Solution re-read successful');
        } catch (error) {
          console.warn('Failed to re-read solution:', error.message);
        }
      }
    }
    
    // Build a comprehensive prompt for orchestration
    const prompt = `
You are an educational content orchestrator. Your task is to validate and integrate assignment, rubric, and solution documents to ensure consistency and completeness for automated grading.

You will receive three processed documents (some may be missing):
1. Assignment data (ALWAYS present)
2. Rubric data (OPTIONAL)
3. Solution data (OPTIONAL)

ASSIGNMENT DATA:
${JSON.stringify(enhancedAssignmentData, null, 2)}

RUBRIC DATA:
${enhancedRubricData ? JSON.stringify(enhancedRubricData, null, 2) : 'NOT PROVIDED - Grading criteria will be derived from assignment'}

SOLUTION DATA:
${enhancedSolutionData ? JSON.stringify(enhancedSolutionData, null, 2) : 'NOT PROVIDED - Solution is optional'}

YOUR TASKS:

1. **VALIDATION**: Check for consistency and completeness:
   ${enhancedRubricData ? `
   - Verify that EACH assignment question has corresponding rubric criteria
   - Check that rubric criteria total points match assignment total points
   - Identify any rubric criteria that don't map to specific questions
   - Ensure rubric question numbers match assignment question numbers` : ''}
   ${enhancedSolutionData ? `
   - Verify that solution covers all assignment questions
   - Check that solution question numbers match assignment question numbers` : ''}
   - Identify any inconsistencies in question numbering across documents

2. **MAPPING**: Create integrated mappings:
   ${enhancedRubricData ? `
   - Map each assignment question to its rubric criteria
   - Calculate expected points per question from rubric weights` : ''}
   ${enhancedSolutionData ? `
   - Map each assignment question to its solution
   - Link solution steps to assignment requirements` : ''}

3. **ISSUE DETECTION**: Identify problems:
   - Missing rubric criteria for assignment questions
   - Extra rubric criteria not tied to questions
   - Missing solutions for assignment questions
   - Point allocation mismatches
   - Question numbering inconsistencies

4. **RECOMMENDATIONS**: Provide actionable suggestions to improve grading accuracy

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure:

{
  "validation": {
    "isValid": <boolean>,
    "hasWarnings": <boolean>,
    "completenessScore": <number 0-100>,
    "issues": [
      {
        "severity": "error|warning|info",
        "category": "rubric|solution|numbering|points",
        "message": "Description of the issue",
        "affectedQuestions": ["question numbers"]
      }
    ]
  },
  "questionMapping": [
    {
      "questionNumber": "1",
      "questionText": "Brief summary",
      "assignmentPoints": <number>,
      "rubricCriteria": [
        {
          "criterionName": "Name",
          "weight": <number>,
          "description": "Description",
          "hasMapping": <boolean>
        }
      ],
      "hasSolution": <boolean>,
      "solutionSummary": "Brief summary if available",
      "totalMappedPoints": <number>,
      "pointsConsistent": <boolean>
    }
  ],
  "statistics": {
    "totalQuestions": <number>,
    "questionsWithRubric": <number>,
    "questionsWithSolution": <number>,
    "totalAssignmentPoints": <number>,
    "totalRubricPoints": <number>,
    "pointsMatch": <boolean>
  },
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "rubric|solution|structure",
      "recommendation": "Specific actionable suggestion"
    }
  ],
  "integratedStructure": {
    "questions": [
      {
        "number": "1",
        "text": "Question text",
        "points": <number>,
        "requirements": ["requirement1", "requirement2"],
        "rubricCriteria": [
          {
            "name": "Criterion name",
            "weight": <number>,
            "description": "Description",
            "markingScale": "Scale if available"
          }
        ],
        "solution": {
          "available": <boolean>,
          "summary": "Summary if available",
          "keyPoints": ["point1", "point2"]
        }
      }
    ],
    "metadata": {
      "totalPoints": <number>,
      "numberOfQuestions": <number>,
      "hasCompleteRubric": <boolean>,
      "hasCompleteSolution": <boolean>
    }
  }
}

IMPORTANT: Your response must be ONLY valid JSON. Ensure all fields are present and properly formatted.
`;

    console.log('\n=== ORCHESTRATION PROMPT DEBUG START ===');
    console.log('Sending orchestration request to Gemini...');
    console.log('Assignment questions:', enhancedAssignmentData?.questions?.length || 0);
    console.log('Rubric criteria:', enhancedRubricData?.grading_criteria?.length || 0);
    console.log('Solution questions:', enhancedSolutionData?.questions?.length || 0);
    console.log('=== ORCHESTRATION PROMPT DEBUG END ===\n');

    // Call Gemini API with the orchestration prompt
    const responseText = await getGeminiResponse(prompt, true);
    
    // Parse the response
    let orchestratedResult;
    try {
      orchestratedResult = JSON.parse(responseText);
      console.log('Orchestration completed successfully');
      console.log('Validation status:', orchestratedResult.validation?.isValid ? 'VALID' : 'HAS ISSUES');
      console.log('Completeness score:', orchestratedResult.validation?.completenessScore);
      console.log('Total issues found:', orchestratedResult.validation?.issues?.length || 0);
    } catch (parseError) {
      console.error('Failed to parse orchestration response:', parseError);
      throw new Error('Invalid JSON response from orchestration');
    }
    
    return orchestratedResult;
    
  } catch (error) {
    console.error('Error during orchestration:', error);
    throw new Error(`Orchestration failed: ${error.message}`);
  }
}

/**
 * Process assignment content extracted by Landing AI
 * @param {Object|string} extractedContent - Content extracted from Landing AI
 * @returns {Promise<Object>} - Processed assignment structure
 */
async function processAssignmentContent(extractedContent) {
  console.log('🤖 [Gemini] processAssignmentContent called');
  console.log(`   Content type: ${typeof extractedContent}`);
  console.log(`   Content length: ${typeof extractedContent === 'string' ? extractedContent.length : JSON.stringify(extractedContent).length} chars`);

  const contentText = typeof extractedContent === 'string'
    ? extractedContent
    : JSON.stringify(extractedContent, null, 2);

  console.log(`   Formatted content length: ${contentText.length} chars`);

  const prompt = `You are an expert assignment analyzer. Analyze the following extracted assignment content and provide a comprehensive structured output.

EXTRACTED CONTENT:
${contentText}

Analyze this content and return a JSON object with the following structure:
{
  "title": "Assignment title",
  "description": "Brief description of the assignment",
  "questions": [
    {
      "number": "1",
      "question": "Full question text",
      "requirements": ["requirement 1", "requirement 2"],
      "constraints": ["constraint 1"],
      "expected_output": "Description of expected output",
      "points": 10
    }
  ],
  "total_points": 100,
  "has_marking_criteria": true/false,
  "metadata": {
    "course": "Course name if mentioned",
    "deadline": "Deadline if mentioned",
    "submission_format": "Expected format"
  }
}

Important:
- Extract ALL questions from the content
- Identify question numbers/letters (1, 2, a, b, 1a, 1b, etc.)
- Calculate or extract point values for each question
- Identify any embedded rubric or marking criteria
- Be thorough and accurate in extraction`;

  try {
    console.log('🤖 [Gemini] Calling Gemini API for assignment processing...');
    const response = await getGeminiResponse(prompt, true);
    console.log(`🤖 [Gemini] Got response, length: ${response?.length || 0} chars`);
    const result = JSON.parse(cleanJsonResponse(response));
    console.log('✅ [Gemini] Assignment content processed successfully');
    console.log(`   Title: ${result.title || 'N/A'}`);
    console.log(`   Questions: ${result.questions?.length || 0}`);
    console.log(`   Total points: ${result.total_points || 'N/A'}`);
    return result;
  } catch (error) {
    console.error('❌ [Gemini] Error processing assignment content:', error.message);
    console.error('   Full error:', error);
    throw new Error(`Failed to process assignment content: ${error.message}`);
  }
}

/**
 * Process rubric content extracted by Landing AI
 * @param {Object|string} extractedContent - Content extracted from Landing AI
 * @param {number} providedTotalPoints - Total points if provided
 * @returns {Promise<Object>} - Processed rubric structure
 */
async function processRubricContent(extractedContent, providedTotalPoints = null) {
  const contentText = typeof extractedContent === 'string'
    ? extractedContent
    : JSON.stringify(extractedContent, null, 2);

  const prompt = `You are an expert rubric analyzer. Analyze the following extracted rubric content and provide a comprehensive structured output.

EXTRACTED CONTENT:
${contentText}

${providedTotalPoints ? `Total points provided: ${providedTotalPoints}` : ''}

Analyze this content and return a JSON object with the following structure:
{
  "grading_criteria": [
    {
      "question_number": "1",
      "criterionName": "Criterion name",
      "weight": 10,
      "description": "What this criterion measures",
      "marking_scale": "Performance level descriptions",
      "subcriteria": [
        {
          "name": "Subcriterion name",
          "weight": 5,
          "description": "Description"
        }
      ]
    }
  ],
  "total_points": 100,
  "grading_scale": {
    "A": "90-100",
    "B": "80-89",
    "C": "70-79",
    "D": "60-69",
    "F": "0-59"
  }
}

Important:
- Extract ALL grading criteria
- Map criteria to specific questions where possible
- Include point values/weights for each criterion
- Extract any performance level descriptions
- Be thorough and accurate`;

  try {
    const response = await getGeminiResponse(prompt, true);
    const result = JSON.parse(cleanJsonResponse(response));
    console.log('✅ Rubric content processed via Gemini');
    return result;
  } catch (error) {
    console.error('❌ Error processing rubric content:', error);
    throw new Error(`Failed to process rubric content: ${error.message}`);
  }
}

/**
 * Process solution content extracted by Landing AI
 * @param {Object|string} extractedContent - Content extracted from Landing AI
 * @returns {Promise<Object>} - Processed solution structure
 */
async function processSolutionContent(extractedContent) {
  const contentText = typeof extractedContent === 'string'
    ? extractedContent
    : JSON.stringify(extractedContent, null, 2);

  const prompt = `You are an expert solution analyzer. Analyze the following extracted model solution content and provide a comprehensive structured output.

EXTRACTED CONTENT:
${contentText}

Analyze this content and return a JSON object with the following structure:
{
  "questions": [
    {
      "questionNumber": "1",
      "questionSummary": "Brief description of what the question asks",
      "solution": "Complete solution text/code",
      "expectedOutput": "Expected output or result",
      "keySteps": ["Step 1", "Step 2", "Step 3"],
      "keyPoints": ["Important concept 1", "Important concept 2"],
      "dependencies": ["library1", "library2"],
      "alternativeApproaches": ["Alternative approach description"]
    }
  ],
  "generalNotes": "Any general notes about the solution",
  "commonMistakes": ["Common mistake 1", "Common mistake 2"]
}

Important:
- Extract solutions for ALL questions
- Include complete code/text for each solution
- Identify key steps and concepts
- Note any dependencies or requirements
- Be thorough and accurate`;

  try {
    const response = await getGeminiResponse(prompt, true);
    const result = JSON.parse(cleanJsonResponse(response));
    console.log('✅ Solution content processed via Gemini');
    return result;
  } catch (error) {
    console.error('❌ Error processing solution content:', error);
    throw new Error(`Failed to process solution content: ${error.message}`);
  }
}

/**
 * Evaluate student submission using extracted content
 * @param {Object} assignmentContent - Processed assignment data
 * @param {Object} rubricContent - Processed rubric data
 * @param {Object} solutionContent - Processed solution data
 * @param {Object|string} extractedSubmission - Extracted submission content from Landing AI
 * @param {string} studentId - Student identifier
 * @returns {Promise<Object>} - Evaluation results
 */
async function evaluateWithExtractedContent(assignmentContent, rubricContent, solutionContent, extractedSubmission, studentId) {
  console.log('🤖 [Gemini] evaluateWithExtractedContent called');
  console.log(`   Student ID: ${studentId}`);
  console.log(`   Assignment content: ${assignmentContent ? 'provided' : 'missing'}`);
  console.log(`   Rubric content: ${rubricContent ? 'provided' : 'missing'}`);
  console.log(`   Solution content: ${solutionContent ? 'provided' : 'missing'}`);
  console.log(`   Submission type: ${typeof extractedSubmission}`);

  const submissionText = typeof extractedSubmission === 'string'
    ? extractedSubmission
    : JSON.stringify(extractedSubmission, null, 2);

  console.log(`   Submission text length: ${submissionText.length} chars`);

  // Build question structure for reference
  const questionStructure = assignmentContent?.questions || assignmentContent?.questionStructure || [];
  const totalPossible = calculateTotalPossibleScore(assignmentContent, rubricContent);
  console.log(`   Total possible score: ${totalPossible}`);
  console.log(`   Questions in structure: ${questionStructure.length}`);

  const prompt = `You are an expert academic grader. Evaluate the following student submission against the assignment criteria.

=== ASSIGNMENT ===
${JSON.stringify(assignmentContent, null, 2)}

=== RUBRIC ===
${JSON.stringify(rubricContent, null, 2)}

=== MODEL SOLUTION ===
${JSON.stringify(solutionContent, null, 2)}

=== STUDENT SUBMISSION ===
Student ID: ${studentId}
${submissionText}

=== GRADING INSTRUCTIONS ===
Total possible points: ${totalPossible}

Evaluate the submission and return a JSON object with this EXACT structure:
{
  "overallGrade": <number between 0 and ${totalPossible}>,
  "totalPossible": ${totalPossible},
  "criteriaGrades": [
    {
      "questionNumber": "1",
      "criterionName": "Criterion name",
      "score": <number>,
      "maxScore": <number>,
      "feedback": "Detailed feedback (minimum 50 words)"
    }
  ],
  "questionScores": [
    {
      "questionNumber": "1",
      "questionText": "Brief summary",
      "maxScore": <number>,
      "earnedScore": <number>,
      "feedback": "Specific feedback",
      "subsections": [
        {
          "subsectionNumber": "a",
          "subsectionText": "Subsection description",
          "maxScore": <number>,
          "earnedScore": <number>,
          "feedback": "Feedback for subsection"
        }
      ]
    }
  ],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "areasForImprovement": ["Area 1", "Area 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

CRITICAL REQUIREMENTS:
1. Evaluate EVERY question from the assignment
2. Provide detailed, constructive feedback (minimum 50 words per criterion)
3. Ensure scores are consistent and sum correctly
4. Be fair but rigorous
5. Reference specific parts of the submission in feedback
6. Compare against the model solution where appropriate`;

  try {
    console.log('🤖 [Gemini] Calling Gemini API for evaluation...');
    const response = await getGeminiResponse(prompt, true);
    console.log(`🤖 [Gemini] Got evaluation response, length: ${response?.length || 0} chars`);
    const result = JSON.parse(cleanJsonResponse(response));

    // Validate result
    if (typeof result.overallGrade !== 'number' || !Array.isArray(result.criteriaGrades)) {
      console.error('❌ [Gemini] Invalid evaluation result structure');
      console.error('   overallGrade type:', typeof result.overallGrade);
      console.error('   criteriaGrades is array:', Array.isArray(result.criteriaGrades));
      throw new Error('Invalid evaluation result structure');
    }

    console.log(`✅ [Gemini] Evaluation completed for student ${studentId}`);
    console.log(`   Score: ${result.overallGrade}/${totalPossible}`);
    console.log(`   Criteria grades: ${result.criteriaGrades?.length || 0}`);
    console.log(`   Strengths: ${result.strengths?.length || 0}`);
    return result;
  } catch (error) {
    console.error('❌ [Gemini] Error evaluating submission:', error.message);
    console.error('   Full error:', error);
    throw new Error(`Failed to evaluate submission: ${error.message}`);
  }
}

/**
 * Extract rubric from assignment content (when no separate rubric provided)
 * @param {Object|string} extractedContent - Extracted assignment content from Landing AI
 * @param {number} providedTotalPoints - Total points if provided
 * @returns {Promise<Object>} - Extracted rubric
 */
async function extractRubricFromContent(extractedContent, providedTotalPoints = null) {
  const contentText = typeof extractedContent === 'string'
    ? extractedContent
    : JSON.stringify(extractedContent, null, 2);

  const prompt = `You are an expert at analyzing academic assignments. Extract grading criteria from the following assignment content.

EXTRACTED CONTENT:
${contentText}

${providedTotalPoints ? `Total points: ${providedTotalPoints}` : ''}

Even if there's no explicit rubric, create reasonable grading criteria based on:
- Questions and their requirements
- Expected outputs
- Point allocations mentioned
- Common academic standards

Return a JSON object:
{
  "grading_criteria": [
    {
      "question_number": "1",
      "criterionName": "Criterion name",
      "weight": 10,
      "description": "What to look for",
      "marking_scale": "How to grade"
    }
  ],
  "total_points": ${providedTotalPoints || 100},
  "extraction_notes": "Notes about how criteria were derived"
}`;

  try {
    const response = await getGeminiResponse(prompt, true);
    const result = JSON.parse(cleanJsonResponse(response));
    console.log('✅ Rubric extracted from assignment content');
    return result;
  } catch (error) {
    console.error('❌ Error extracting rubric from content:', error);
    throw new Error(`Failed to extract rubric: ${error.message}`);
  }
}

module.exports = {
  evaluateSubmission,
  evaluateSubmissionWithText,
  evaluateProjectSubmission,
  evaluateCode,
  evaluateReport,
  getOverallFeedback,
  processAssignment,
  processRubric,
  processSolution,
  processSubmission,
  // New PDF processing functions
  processAssignmentPDF,
  processRubricPDF,
  processSolutionPDF,
  extractRubricFromAssignmentPDF,
  // Orchestration function
  orchestrateAssignmentData,
  // New functions for Landing AI extracted content
  processAssignmentContent,
  processRubricContent,
  processSolutionContent,
  evaluateWithExtractedContent,
  extractRubricFromContent
};