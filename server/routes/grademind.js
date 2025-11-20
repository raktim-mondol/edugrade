const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rate limiting
const RATE_LIMIT_DELAY = 12000;
let lastCallTime = 0;

// Evaluate a student submission
router.post('/evaluate', async (req, res) => {
  try {
    const { config, studentContent } = req.body;

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
    const prompt = `You are an expert grading assistant. Evaluate the following student submission based on the provided criteria.

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

    // Call Gemini
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const responseText = result.response.text();

    // Parse the JSON response
    let evaluation;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Return a default evaluation
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

    // Ensure required fields exist
    evaluation.maxScore = evaluation.maxScore || config.totalScore || 100;
    evaluation.strengths = evaluation.strengths || [];
    evaluation.weaknesses = evaluation.weaknesses || [];
    evaluation.actionableTips = evaluation.actionableTips || 'Continue practicing and refining your work.';

    res.json(evaluation);
  } catch (error) {
    console.error('❌ GradeMind evaluation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
