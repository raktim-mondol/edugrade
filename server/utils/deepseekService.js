/**
 * DeepSeek API Service
 * Handles interactions with DeepSeek API for document processing
 */
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize the DeepSeek API client with timeout
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
  timeout: 300000, // Increase to 5 minutes (300,000 ms)
  maxRetries: 2    // Allow up to 3 retries
});

/**
 * Perform an API request with exponential backoff retry
 * @param {Function} apiCall - The API call function to execute
 * @returns {Promise} - Result of the API call
 */
async function withRetry(apiCall) {
  const MAX_RETRIES = 2; // Number of retries
  const INITIAL_BACKOFF = 1000; // 1 second
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Add a small delay to prevent rate limiting
      if (attempt > 0) {
        const backoff = Math.min(INITIAL_BACKOFF * Math.pow(2, attempt - 1), 8000);
        console.log(`Retry attempt ${attempt}. Waiting ${backoff}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
      
      // Execute the API call with a timeout
      // Increased timeout to 5 minutes (300 seconds) to match OpenAI client timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('API request timed out after 300 seconds')), 300000)
      );
      
      return await Promise.race([apiCall(), timeoutPromise]);
    } catch (error) {
      console.warn(`API request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, error.message);
      
      // If this was our last retry, handle the error gracefully
      if (attempt === MAX_RETRIES) {
        // Return a fallback response for graceful handling
        console.log("Returning fallback response after maximum retries");
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                error: error.message.includes('timed out') ? "API timeout" : "API error",
                summary: error.message.includes('timed out') 
                  ? "The DeepSeek API took too long to respond. Please try again later."
                  : "There was an error with the DeepSeek API. Please try again later.",
                _fallback: true
              })
            }
          }]
        };
      }
      // Otherwise continue to the next retry
    }
  }
}

/**
 * Process assignment document with DeepSeek API
 * @param {string} extractedText - The text extracted from the assignment PDF
 * @returns {Promise<Object>} - Structured assignment data
 */
async function processAssignment(extractedText) {
  try {
    // Limit text size to prevent API timeout issues
    const maxChars = 150000; // Reduced from 10000 to improve response time
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

    console.log(`Sending assignment to DeepSeek API (${trimmedText.length} chars)`);
    
    const apiCallFn = async () => {
      const start = Date.now();
      const completion = await deepseek.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful assistant. Keep responses concise and in valid JSON format." },
          { role: "user", content: prompt }
        ],
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0.2, // Reduced from 0.3 for more deterministic responses
        max_tokens: 5000  // Limit response size
      });
      console.log(`DeepSeek API call completed in ${Date.now() - start}ms`);
      return completion;
    };

    // Use retry mechanism
    const completion = await withRetry(apiCallFn);

    // Parse the JSON response, handling fallback case
    const responseContent = completion.choices[0].message.content;
    const parsed = JSON.parse(responseContent);
    
    // If this was a fallback response, mark it as incomplete
    if (parsed._fallback) {
      return {
        title: "Processing Incomplete",
        description: "The assignment processing timed out. You may try again or proceed with limited information.",
        requirements: [],
        constraints: ["Processing was incomplete due to API timeout"],
        expected_output: "Not available due to processing timeout",
        processing_incomplete: true
      };
    }
    
    return parsed;
  } catch (error) {
    console.error("Error processing assignment with DeepSeek:", error);
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
 * Process rubric document with DeepSeek API
 * @param {string} extractedText - The text extracted from the rubric PDF
 * @param {number} providedTotalPoints - Total points provided by the user (optional)
 * @returns {Promise<Object>} - Structured rubric data
 */
async function processRubric(extractedText, providedTotalPoints = null) {
  try {
    // Limit text size to prevent API timeout issues
    const maxChars = 150000; // Slightly increased to capture more rubric details
    const trimmedText = extractedText.length > maxChars 
      ? extractedText.substring(0, maxChars) + "... [content truncated]"
      : extractedText;
    
    // First, let the API extract the total points from the PDF text
    if (providedTotalPoints === null) {
      console.log("No total points provided, attempting to extract from rubric text");
      
      // First pass to extract total points
      const pointsPrompt = `
Extract ONLY the total possible points for this assignment from the rubric text. 
Return ONLY a single number representing the total points.

If the total points are explicitly mentioned (e.g., "Total: 20 points", "Maximum score: 15", etc.), use that value.
If no explicit total is given but individual point values are listed, add them up.
If you cannot determine the total points at all, return 19 as a default value.

RUBRIC TEXT:
"""
${trimmedText.substring(0, Math.min(trimmedText.length, 120000))}
"""

RETURN ONLY THE NUMERIC VALUE WITH NO EXPLANATION.`;

      try {
        console.log("Sending initial request to extract total points");
        const pointsCompletion = await deepseek.chat.completions.create({
          messages: [
            { role: "system", content: "You are a helpful assistant. Respond with only the numeric value." },
            { role: "user", content: pointsPrompt }
          ],
          model: "deepseek-chat",
          temperature: 0.1,
          max_tokens: 10
        });
        
        const pointsResponse = pointsCompletion.choices[0].message.content.trim();
        const extractedPoints = parseInt(pointsResponse);
        
        // Check if we got a valid number
        if (!isNaN(extractedPoints) && extractedPoints > 0) {
          console.log(`Successfully extracted total points from rubric text: ${extractedPoints}`);
          providedTotalPoints = extractedPoints;
        } else {
          console.log(`Failed to extract valid total points from text, got: ${pointsResponse}`);
          // Use default if extraction failed
          providedTotalPoints = 100; // Default if no valid number found
        }
      } catch (pointsErr) {
        console.log(`Error extracting total points: ${pointsErr.message}`);
        providedTotalPoints = 100; // Default if extraction fails
      }
    }
    
    const defaultTotalPoints =100 // Default to use if no other source is available
    const totalPoints = providedTotalPoints || defaultTotalPoints;
    
    console.log(`DeepSeek Rubric Processing - Using total points: ${totalPoints}`);
    
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

    console.log(`Sending rubric to DeepSeek API (${trimmedText.length} chars)`);

    const apiCallFn = async () => {
      const start = Date.now();
      const completion = await deepseek.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful assistant specialized in analyzing academic rubrics. Keep responses concise and in valid JSON format." },
          { role: "user", content: prompt }
        ],
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0.1, // Lower temperature for more deterministic extraction
        max_tokens: 3000  // Increased to handle detailed rubrics
      });
      console.log(`DeepSeek API call completed in ${Date.now() - start}ms`);
      return completion;
    };

    // Use retry mechanism
    const completion = await withRetry(apiCallFn);

    // Parse the JSON response, handling fallback case
    const responseContent = completion.choices[0].message.content;
    const parsed = JSON.parse(responseContent);
    
    // If this was a fallback response, mark it as incomplete
    if (parsed._fallback) {
      return {
        grading_criteria: [
          {
            criterionName: "Processing Incomplete",
            weight: "N/A",
            description: "The rubric processing timed out. Please try again or proceed with limited information.",
            marking_scale: "N/A"
          }
        ],
        total_points: totalPoints,
        processing_incomplete: true
      };
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
    console.error("Error processing rubric with DeepSeek:", error);
    
    // Use the provided total points even in error case
    const errorTotalPoints = providedTotalPoints !== null ? providedTotalPoints : 100;
    console.log(`Error recovery - Using total points: ${errorTotalPoints}`);
    
    // Return minimal valid structure even in case of error
    return {
      grading_criteria: [
        {
          criterionName: "Error Processing Rubric",
          weight: "N/A",
          description: "There was an error processing the rubric document: " + error.message,
          marking_scale: "N/A"
        }
      ],
      total_points: errorTotalPoints,
      processing_error: error.message
    };
  }
}

/**
 * Process solution document with DeepSeek API
 * @param {string} extractedText - The text extracted from the solution PDF
 * @returns {Promise<Object>} - Structured solution data
 */
async function processSolution(extractedText) {
  try {
    // Limit text size to prevent API timeout issues
    const maxChars = 180000; // Reduced from 10000 to improve response time
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

    console.log(`Sending solution to DeepSeek API (${trimmedText.length} chars)`);

    const apiCallFn = async () => {
      const start = Date.now();
      const completion = await deepseek.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful assistant. Keep responses concise and in valid JSON format." },
          { role: "user", content: prompt }
        ],
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 6000
      });
      console.log(`DeepSeek API call completed in ${Date.now() - start}ms`);
      return completion;
    };

    // Use retry mechanism
    const completion = await withRetry(apiCallFn);

    // Parse the JSON response, handling fallback case
    const responseContent = completion.choices[0].message.content;
    const parsed = JSON.parse(responseContent);
    
    // If this was a fallback response, mark it as incomplete
    if (parsed._fallback) {
      return {
        summary: "Processing Incomplete - The solution processing timed out",
        key_steps: ["Processing was incomplete due to API timeout"],
        expected_output: "Not available due to processing timeout",
        dependencies: [],
        processing_incomplete: true
      };
    }
    
    return parsed;
  } catch (error) {
    console.error("Error processing solution with DeepSeek:", error);
    // Return minimal valid structure even in case of error
    return {
      summary: "Error Processing Solution",
      key_steps: ["There was an error processing the solution document"],
      expected_output: "Not available due to processing error",
      dependencies: [],
      processing_error: error.message
    };
  }
}

/**
 * Process student submission document with DeepSeek API
 * @param {string} extractedText - The text extracted from the student submission PDF
 * @param {string} studentId - ID of the student who made the submission
 * @returns {Promise<Object>} - Structured submission data
 */
async function processSubmission(extractedText, studentId) {
  try {
    // Limit text length for faster processing
    const maxLength = 5000; // Reduced further from 8000
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

    console.log(`Sending submission to DeepSeek API (${truncatedText.length} chars)`);
    
    const apiCallFn = async () => {
      const start = Date.now();
      const completion = await deepseek.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful assistant. Respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
        model: "deepseek-chat",
        response_format: { type: "json_object" },
        temperature: 0.2, 
        max_tokens: 2000 // Reduced from 4000
      });
      console.log(`DeepSeek API call completed in ${Date.now() - start}ms`);
      return completion;
    };

    // Use retry mechanism
    const completion = await withRetry(apiCallFn);
  
    // Guard against undefined or empty responses
    if (!completion?.choices?.length || !completion.choices[0]?.message?.content) {
      console.warn("DeepSeek API returned empty or undefined response");
      return {
        student_id: studentId,
        processing_error: "Empty API response",
        summary: "API returned an empty response",
        questions: []
      };
    }
  
    // Parse the JSON response with error handling
    const responseContent = completion.choices[0].message.content;
    console.log(`Received response from DeepSeek API with length: ${responseContent.length} characters`);
    
    let parsedResponse;
    try {
      // Try to parse as JSON
      parsedResponse = JSON.parse(responseContent);
      
      // Check for fallback response
      if (parsedResponse._fallback) {
        return {
          student_id: studentId,
          summary: "Processing incomplete - The submission processing timed out",
          questions: [],
          processing_incomplete: true
        };
      }
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      console.log("First 200 chars of received content:", responseContent.substring(0, 200));
      
      // Try to extract JSON from the response if it contains extra text
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log("Successfully extracted JSON from response");
        } catch (nestedError) {
          console.error("Failed to extract JSON from response:", nestedError);
          // Provide fallback structure
          parsedResponse = {
            student_id: studentId,
            processing_error: "Failed to parse API response",
            summary: "Content could not be structured properly",
            questions: []
          };
        }
      } else {
        // Provide fallback structure if no JSON-like content found
        parsedResponse = {
          student_id: studentId,
          processing_error: "Failed to parse API response",
          summary: "Content could not be structured properly",
          questions: []
        };
      }
    }
    
    // Add student ID if it wasn't included in the response
    if (!parsedResponse.student_id && studentId) {
      parsedResponse.student_id = studentId;
    }
    
    // Ensure we have the minimal expected structure
    if (!parsedResponse.questions && !parsedResponse.summary) {
      parsedResponse.summary = responseContent.length > 100 ? 
        responseContent.substring(0, 100) + "..." : 
        "Response structure was invalid";
      parsedResponse.questions = [];
    }
    
    return parsedResponse;
  } catch (error) {
    console.error("Error in submission processing function:", error);
    
    // Return a valid structure even in case of unexpected errors
    return {
      student_id: studentId,
      processing_error: `Unexpected error: ${error.message}`,
      summary: "Error occurred during processing",
      questions: []
    };
  }
}

module.exports = {
  processAssignment,
  processRubric,
  processSolution,
  processSubmission
};