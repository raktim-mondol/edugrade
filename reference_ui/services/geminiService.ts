import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AssignmentConfig, GradeResult } from "../types";

const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

// Define the strict schema for the grading output
const gradingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "The numerical score awarded based on the rubric out of the assignment total points.",
    },
    maxScore: {
      type: Type.NUMBER,
      description: "The maximum possible score defined by the assignment.",
    },
    letterGrade: {
      type: Type.STRING,
      description: "The letter grade (A, B, C, D, F) corresponding to the score.",
    },
    feedback: {
      type: Type.STRING,
      description: "A comprehensive paragraph justifying the grade based on the rubric and solution.",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 2-3 specific things the student did well.",
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 2-3 specific areas where the student failed to meet the rubric.",
    },
    actionableTips: {
      type: Type.STRING,
      description: "One specific, actionable piece of advice for the student to improve next time.",
    },
  },
  required: ["score", "maxScore", "letterGrade", "feedback", "strengths", "weaknesses", "actionableTips"],
};

const getGradeFromScore = (score: number, total: number): string => {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
};

export const evaluateSubmission = async (
  assignment: AssignmentConfig,
  studentContent: string
): Promise<GradeResult> => {
  const models = assignment.selectedModels && assignment.selectedModels.length > 0 
    ? assignment.selectedModels 
    : ['gemini-2.5-flash'];

  const totalPoints = assignment.totalScore || 100;

  try {
    const promises = models.map(async (model) => {
        const parts: any[] = [];

        // System Instruction / Context
        parts.push({ text: `
          You are GradeMind, an expert academic evaluator known for precision, fairness, and constructive criticism.
          
          TASK:
          Evaluate the following student submission against the provided assignment description, rubric, and reference solution.
          
          ASSIGNMENT TITLE: ${assignment.title}
          TOTAL POSSIBLE POINTS: ${totalPoints}
        `});
    
        // 1. Assignment Description
        parts.push({ text: "--- ASSIGNMENT DESCRIPTION ---" });
        if (assignment.descriptionFile) {
          parts.push({ inlineData: { mimeType: assignment.descriptionFile.mimeType, data: assignment.descriptionFile.data } });
        }
        if (assignment.description) {
          parts.push({ text: assignment.description });
        }
    
        // 2. Rubric
        parts.push({ text: "--- RUBRIC ---" });
        if (assignment.rubricFile) {
          parts.push({ inlineData: { mimeType: assignment.rubricFile.mimeType, data: assignment.rubricFile.data } });
        }
        if (assignment.rubric) {
          parts.push({ text: assignment.rubric });
        }
    
        // 3. Solution
        parts.push({ text: "--- REFERENCE SOLUTION ---" });
        if (assignment.solutionFile) {
          parts.push({ inlineData: { mimeType: assignment.solutionFile.mimeType, data: assignment.solutionFile.data } });
        }
        if (assignment.solution) {
          parts.push({ text: assignment.solution });
        }
    
        // 4. Student Submission
        parts.push({ text: "--- STUDENT SUBMISSION ---" });
        parts.push({ text: studentContent });
    
        parts.push({ text: `Provide the output strictly in JSON format. Ensure the 'score' is a number out of ${totalPoints}, and 'maxScore' is exactly ${totalPoints}.` });
    
        const response = await ai.models.generateContent({
          model: model,
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: gradingSchema,
            temperature: 0.1, 
          },
        });
    
        const jsonText = response.text;
        if (!jsonText) throw new Error(`No response from AI model ${model}`);
        return JSON.parse(jsonText) as GradeResult;
    });

    const results = await Promise.all(promises);

    // If only one result or average grading is disabled (and we just return the first one/primary)
    if (results.length === 1 || !assignment.useAverageGrading) {
        const res = results[0];
        return {
            ...res,
            maxScore: totalPoints, // Force override to ensure consistency
            modelUsed: results.length === 1 ? models[0] : `${models[0]} (Primary)`
        };
    }

    // Logic for Average Marking
    const avgScore = Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / results.length);
    const combinedStrengths = Array.from(new Set(results.flatMap(r => r.strengths))).slice(0, 5);
    const combinedWeaknesses = Array.from(new Set(results.flatMap(r => r.weaknesses))).slice(0, 5);
    
    // Combine feedback with attribution
    const combinedFeedback = results.map((r, i) => `[${models[i]}] ${r.feedback}`).join('\n\n');

    return {
        score: avgScore,
        maxScore: totalPoints,
        letterGrade: getGradeFromScore(avgScore, totalPoints),
        feedback: `CONSENSUS EVALUATION (${models.length} Models)\n\n${combinedFeedback}`,
        strengths: combinedStrengths,
        weaknesses: combinedWeaknesses,
        actionableTips: results[0].actionableTips, // Take tip from primary for simplicity
        modelUsed: `Average: ${models.join(', ')}`
    };

  } catch (error) {
    console.error("Grading Error:", error);
    throw error;
  }
};