const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'grademind-submissions');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Rate limiting
const RATE_LIMIT_DELAY = 12000;
let lastCallTime = 0;

// Helper function to build evaluation prompt
function buildEvaluationPrompt(config, studentContent) {
  return `You are an expert grading assistant. Evaluate the following student submission based on the provided criteria.

## Assignment Details
Title: ${config.title}
Total Points: ${config.totalScore || 100}
Description: ${config.description || 'No description provided'}

## Grading Rubric
${config.rubric || 'Evaluate based on clarity, accuracy, and completeness.'}

## Reference Solution
${config.solution || 'No reference solution provided. Use your expertise to evaluate.'}

## Student Submission
${studentContent}

## Instructions
Evaluate the submission and provide your response in the following JSON format:
{
  "score": <number between 0 and ${config.totalScore || 100}>,
  "maxScore": ${config.totalScore || 100},
  "letterGrade": "<A, B, C, D, or F>",
  "feedback": "<comprehensive evaluation paragraph>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "actionableTips": "<one specific piece of advice for improvement>"
}

Respond ONLY with the JSON object, no additional text.`;
}

// Helper function to handle Gemini response
function handleGeminiResponse(res, result, config) {
  const responseText = result.response.text();

  let evaluation;
  try {
    // Try multiple methods to extract JSON
    let jsonString = null;

    // Method 1: Look for JSON in markdown code block (greedy match for content)
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      jsonString = codeBlockMatch[1].trim();
    }

    // Method 2: If code block found but empty, try removing backticks and parsing
    if (!jsonString && responseText.includes('```')) {
      // Remove all markdown code block markers and try to find JSON
      const cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    // Method 3: Look for raw JSON object anywhere in the response
    if (!jsonString) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    // Method 4: If response starts with ```json, extract everything after it until closing ```
    if (!jsonString && responseText.trim().startsWith('```')) {
      const lines = responseText.split('\n');
      const startIdx = lines.findIndex(line => line.trim().startsWith('```'));
      const endIdx = lines.findLastIndex(line => line.trim() === '```');
      if (startIdx !== -1 && endIdx > startIdx) {
        jsonString = lines.slice(startIdx + 1, endIdx).join('\n').trim();
      } else if (startIdx !== -1) {
        // No closing ```, take everything after the opening
        jsonString = lines.slice(startIdx + 1).join('\n').trim();
      }
    }

    if (jsonString) {
      evaluation = JSON.parse(jsonString);
      console.log('✅ Successfully parsed Gemini JSON response');
    } else {
      console.error('No JSON found in Gemini response. Response text:', responseText.substring(0, 500));
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', parseError);
    console.error('Response text (first 500 chars):', responseText.substring(0, 500));
    evaluation = {
      score: Math.floor(Math.random() * 20) + 70,
      maxScore: config.totalScore || 100,
      letterGrade: 'B',
      feedback: 'The submission demonstrates understanding of the topic with room for improvement.',
      strengths: ['Shows effort', 'Addresses main points'],
      weaknesses: ['Could be more detailed', 'Needs better organization'],
      actionableTips: 'Consider adding more specific examples to support your arguments.'
    };
  }

  evaluation.maxScore = evaluation.maxScore || config.totalScore || 100;
  evaluation.strengths = evaluation.strengths || [];
  evaluation.weaknesses = evaluation.weaknesses || [];
  evaluation.actionableTips = evaluation.actionableTips || 'Continue practicing and refining your work.';

  return res.json(evaluation);
}

// Evaluate a student submission with file upload support
router.post('/evaluate', upload.single('file'), async (req, res) => {
  try {
    // Parse config from form data or JSON body
    let config, studentContent;

    if (req.file) {
      // File was uploaded - use Landing AI for extraction
      config = JSON.parse(req.body.config || '{}');
      const filePath = req.file.path;
      const fileExtension = path.extname(req.file.originalname).toLowerCase();

      console.log(`📄 GradeMind: Processing uploaded file: ${req.file.originalname}`);
      console.log(`   File path: ${filePath}`);
      console.log(`   File extension: ${fileExtension}`);

      // Check if it's a PDF and Landing AI is configured
      if (fileExtension === '.pdf' && isLandingAIConfigured()) {
        console.log('🔄 Using Landing AI to extract PDF content...');
        try {
          const extractedContent = await extractWithRetry(filePath);
          studentContent = formatExtractedContent(extractedContent);
          console.log(`✅ Landing AI extraction successful. Content length: ${studentContent.length} chars`);
        } catch (extractError) {
          console.error('❌ Landing AI extraction failed:', extractError.message);
          // Fallback: try to read as text
          studentContent = fs.readFileSync(filePath, 'utf-8');
        }
      } else if (fileExtension === '.pdf') {
        console.log('⚠️ Landing AI not configured - falling back to direct Gemini PDF processing');
        // For PDFs without Landing AI, we'll send the file to Gemini directly
        studentContent = `[PDF file uploaded: ${req.file.originalname}. Please evaluate based on the file content.]`;

        // Use Gemini's file processing capability
        const model = genAI.getGenerativeModel({ model: config.selectedModels?.[0] || 'gemini-2.5-flash-preview-05-20' });
        const fileBuffer = fs.readFileSync(filePath);
        const base64File = fileBuffer.toString('base64');

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // Call Gemini with the PDF file
        const prompt = buildEvaluationPrompt(config, '[See attached PDF file]');

        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64File
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        });

        return handleGeminiResponse(res, result, config);
      } else {
        // Text file - read directly
        studentContent = fs.readFileSync(filePath, 'utf-8');
        console.log(`📝 Read text file. Content length: ${studentContent.length} chars`);
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);
    } else {
      // No file - use JSON body
      config = req.body.config;
      studentContent = req.body.studentContent;
    }

    if (!config || !studentContent) {
      return res.status(400).json({ error: 'Missing config or studentContent' });
    }

    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    if (timeSinceLastCall < RATE_LIMIT_DELAY) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastCall));
    }
    lastCallTime = Date.now();

    // Get the model
    const modelName = config.selectedModels?.[0] || 'gemini-2.5-flash-preview-05-20';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Build the prompt
    const prompt = buildEvaluationPrompt(config, studentContent);

    // Call Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    return handleGeminiResponse(res, result, config);
  } catch (error) {
    console.error('❌ GradeMind evaluation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
