const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { extractWithRetry, formatExtractedContent, isConfigured: isLandingAIConfigured } = require('../utils/landingAIService');
const { Submission } = require('../models/submission');

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

const upload = multer({
  storage,
  limits: {
    fieldSize: 50 * 1024 * 1024, // 50MB for form fields (config JSON with rubric/solution)
    fileSize: 50 * 1024 * 1024   // 50MB for uploaded files
  }
});

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
  "feedback": "<comprehensive evaluation summary paragraph>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<area for improvement 1>", "<area for improvement 2>", ...],
  "actionableTips": "<one specific piece of advice for improvement>",
  "lostMarks": [
    {
      "area": "<topic or section where marks were lost>",
      "pointsLost": <number of points deducted>,
      "reason": "<specific explanation of why marks were deducted>"
    }
  ]
}

Respond ONLY with the JSON object, no additional text.`;
}

// Helper function to handle Gemini response
function handleGeminiResponse(res, result, config) {
  // Check for valid response structure
  if (!result || !result.response) {
    console.error('❌ Invalid Gemini API response structure');
    return res.status(500).json({
      error: 'Invalid API response',
      details: 'Gemini API returned an invalid response structure'
    });
  }

  const responseText = result.response.text();

  // Check for empty response
  if (!responseText || responseText.trim() === '') {
    console.error('❌ Empty response from Gemini API');
    return res.status(500).json({
      error: 'Empty AI response',
      details: 'Gemini API returned an empty response. The content may be too large or contain unsupported elements.'
    });
  }

  console.log(`📥 Received Gemini response (${responseText.length} chars)`);

  let evaluation;
  try {
    // With responseMimeType: "application/json", the response should be direct JSON
    // But we still try multiple methods for robustness
    let jsonString = null;

    // Method 1: Try direct parsing (for responseMimeType: "application/json")
    try {
      evaluation = JSON.parse(responseText.trim());
      console.log('📝 Method 1: Direct JSON parse successful');
    } catch (directParseError) {
      // Method 2: Look for JSON in markdown code block
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        jsonString = codeBlockMatch[1].trim();
        console.log('📝 Method 2: Found JSON in code block');
      }

      // Method 3: Strip markdown and find JSON object
      if (!jsonString) {
        let cleanedText = responseText
          .replace(/```json\n?/gi, '')
          .replace(/```\n?/g, '')
          .trim();

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log('📝 Method 3: Found JSON after stripping markdown');
        }
      }

      // Method 4: Direct JSON object search in original text
      if (!jsonString) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log('📝 Method 4: Found raw JSON object');
        }
      }

      if (jsonString) {
        evaluation = JSON.parse(jsonString);
      } else {
        throw new Error('No JSON found in response');
      }
    }

    console.log('✅ Successfully parsed Gemini JSON response');
    console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
  } catch (parseError) {
    console.error('❌ Failed to parse Gemini response:', parseError.message);
    console.error('Response text (first 1000 chars):', responseText.substring(0, 1000));

    // Return error to frontend instead of random score
    return res.status(500).json({
      error: 'Failed to parse AI response',
      details: parseError.message
    });
  }

  evaluation.maxScore = evaluation.maxScore || config.totalScore || 100;
  evaluation.strengths = evaluation.strengths || [];
  evaluation.weaknesses = evaluation.weaknesses || [];
  evaluation.actionableTips = evaluation.actionableTips || 'Continue practicing and refining your work.';
  evaluation.lostMarks = evaluation.lostMarks || [];

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
          // Fallback: use direct Gemini PDF processing
          console.log('🔄 Falling back to direct Gemini PDF processing...');

          const model = genAI.getGenerativeModel({ model: config.selectedModels?.[0] || 'gemini-2.5-pro' });
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
        }
      } else if (fileExtension === '.pdf') {
        console.log('⚠️ Landing AI not configured - falling back to direct Gemini PDF processing');
        // For PDFs without Landing AI, we'll send the file to Gemini directly
        studentContent = `[PDF file uploaded: ${req.file.originalname}. Please evaluate based on the file content.]`;

        // Use Gemini's file processing capability
        const model = genAI.getGenerativeModel({ model: config.selectedModels?.[0] || 'gemini-2.5-pro' });
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

    // Build the prompt
    const prompt = buildEvaluationPrompt(config, studentContent);

    // Get selected models (default to gemini-2.5-pro)
    const selectedModels = config.selectedModels?.length > 0
      ? config.selectedModels
      : ['gemini-2.5-pro'];

    const useAverageGrading = config.useAverageGrading && selectedModels.length > 1;

    console.log(`📤 Sending evaluation request to Gemini`);
    console.log(`   Models: ${selectedModels.join(', ')}`);
    console.log(`   Average grading: ${useAverageGrading}`);
    console.log(`   Content length: ${studentContent.length} chars`);

    // If using average grading, call all models and average results
    if (useAverageGrading) {
      console.log(`🔄 Running evaluation with ${selectedModels.length} models for averaging...`);

      const evaluations = [];
      const modelResults = {};

      for (const modelName of selectedModels) {
        try {
          // Rate limiting between model calls
          const now = Date.now();
          const timeSinceLastCall = now - lastCallTime;
          if (timeSinceLastCall < RATE_LIMIT_DELAY) {
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastCall));
          }
          lastCallTime = Date.now();

          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: "application/json",
            },
          });

          console.log(`   📤 Calling model: ${modelName}`);
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });

          const responseText = result.response.text();
          let evaluation;

          try {
            evaluation = JSON.parse(responseText.trim());
          } catch (parseError) {
            // Try to extract JSON from code blocks
            const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
              evaluation = JSON.parse(codeBlockMatch[1].trim());
            } else {
              const jsonMatch = responseText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                evaluation = JSON.parse(jsonMatch[0]);
              } else {
                throw parseError;
              }
            }
          }

          evaluations.push(evaluation);
          modelResults[modelName] = evaluation.score;
          console.log(`   ✅ ${modelName}: ${evaluation.score}/${evaluation.maxScore || config.totalScore || 100}`);
        } catch (modelError) {
          console.error(`   ❌ ${modelName} failed:`, modelError.message);
          // Continue with other models
        }
      }

      if (evaluations.length === 0) {
        return res.status(500).json({
          error: 'All models failed to evaluate',
          details: 'No successful evaluations from any selected model'
        });
      }

      // Average the scores
      const avgScore = Math.round(evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length);
      const maxScore = config.totalScore || 100;

      // Combine feedback from all models
      const combinedStrengths = [...new Set(evaluations.flatMap(e => e.strengths || []))];
      const combinedWeaknesses = [...new Set(evaluations.flatMap(e => e.weaknesses || []))];

      // Use the most common letter grade
      const grades = evaluations.map(e => e.letterGrade).filter(Boolean);
      const gradeCount = grades.reduce((acc, g) => {
        acc[g] = (acc[g] || 0) + 1;
        return acc;
      }, {});
      const avgGrade = Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'C';

      // Combine lost marks from all evaluations
      const allLostMarks = evaluations.flatMap(e => e.lostMarks || []);

      const averagedEvaluation = {
        score: avgScore,
        maxScore: maxScore,
        letterGrade: avgGrade,
        feedback: `Average score from ${evaluations.length} models. ${evaluations[0]?.feedback || ''}`,
        strengths: combinedStrengths.slice(0, 5),
        weaknesses: combinedWeaknesses.slice(0, 5),
        actionableTips: evaluations[0]?.actionableTips || 'Continue practicing and refining your work.',
        lostMarks: allLostMarks,
        modelScores: modelResults,
        modelsUsed: selectedModels.filter(m => modelResults[m] !== undefined)
      };

      console.log(`✅ Averaged evaluation complete: ${avgScore}/${maxScore}`);
      console.log(`   Individual scores: ${JSON.stringify(modelResults)}`);

      return res.json(averagedEvaluation);
    }

    // Single model evaluation
    const modelName = selectedModels[0];
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    console.log(`📤 Single model evaluation: ${modelName}`);

    // Call Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    return handleGeminiResponse(res, result, config);
  } catch (error) {
    console.error('❌ GradeMind evaluation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save grademind evaluation result as a Submission document
router.post('/save-result', async (req, res) => {
  try {
    const { assignmentId, studentName, studentId, evaluationResult, sectionName } = req.body;

    if (!assignmentId || !studentName || !evaluationResult) {
      return res.status(400).json({
        error: 'Missing required fields: assignmentId, studentName, evaluationResult'
      });
    }

    // Build questionScores from lostMarks or create a single overall entry
    let questionScores = [];
    if (evaluationResult.lostMarks && evaluationResult.lostMarks.length > 0) {
      // Create question entries from lost marks areas
      questionScores = evaluationResult.lostMarks.map((item, idx) => ({
        questionNumber: String(idx + 1),
        earnedScore: Math.max(0, (evaluationResult.maxScore / evaluationResult.lostMarks.length) - item.pointsLost),
        maxScore: evaluationResult.maxScore / evaluationResult.lostMarks.length,
        feedback: `${item.area}: ${item.reason}`
      }));
    } else {
      // Create a single question entry with the overall score
      questionScores = [{
        questionNumber: '1',
        earnedScore: evaluationResult.score,
        maxScore: evaluationResult.maxScore,
        feedback: evaluationResult.feedback
      }];
    }

    // Check if submission already exists for this student and assignment
    const existingSubmission = await Submission.findOne({
      assignmentId,
      studentId: studentId || studentName
    });

    if (existingSubmission) {
      // Update existing submission
      existingSubmission.evaluationResult = {
        overallGrade: evaluationResult.score,
        totalPossible: evaluationResult.maxScore,
        letterGrade: evaluationResult.letterGrade,
        feedback: evaluationResult.feedback,
        strengths: evaluationResult.strengths,
        areasForImprovement: evaluationResult.weaknesses,
        actionableTips: evaluationResult.actionableTips,
        lostMarks: evaluationResult.lostMarks,
        questionScores: questionScores
      };
      existingSubmission.overallGrade = evaluationResult.score;
      existingSubmission.totalPossible = evaluationResult.maxScore;
      existingSubmission.evaluationStatus = 'completed';
      existingSubmission.processingStatus = 'completed';
      existingSubmission.evaluationCompletedAt = new Date();

      await existingSubmission.save();
      console.log(`✅ Updated grademind submission for ${studentName}`);
      return res.json({ submissionId: existingSubmission._id, updated: true });
    }

    // Create new submission
    const submission = new Submission({
      assignmentId,
      studentId: studentId || studentName,
      studentName: studentName,
      submissionFile: `grademind-${sectionName || 'default'}-${studentName}`,
      processingStatus: 'completed',
      evaluationStatus: 'completed',
      evaluationCompletedAt: new Date(),
      overallGrade: evaluationResult.score,
      totalPossible: evaluationResult.maxScore,
      evaluationResult: {
        overallGrade: evaluationResult.score,
        totalPossible: evaluationResult.maxScore,
        letterGrade: evaluationResult.letterGrade,
        feedback: evaluationResult.feedback,
        strengths: evaluationResult.strengths,
        areasForImprovement: evaluationResult.weaknesses,
        actionableTips: evaluationResult.actionableTips,
        lostMarks: evaluationResult.lostMarks,
        questionScores: questionScores
      }
    });

    await submission.save();
    console.log(`✅ Saved grademind submission for ${studentName} (ID: ${submission._id})`);

    res.json({ submissionId: submission._id, created: true });
  } catch (error) {
    console.error('❌ Error saving grademind result:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
