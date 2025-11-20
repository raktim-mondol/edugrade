
export interface FileData {
  mimeType: string;
  data: string; // Base64
  name: string;
}

export interface AssignmentConfig {
  title: string;
  totalScore: number;
  description: string;
  rubric: string;
  solution: string;
  descriptionFile?: FileData;
  rubricFile?: FileData;
  solutionFile?: FileData;
  selectedModels: string[]; // List of model IDs
  useAverageGrading: boolean; // Whether to average scores from multiple models
}

export interface GradeResult {
  score: number;
  maxScore: number;
  letterGrade: string;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  actionableTips: string;
  modelUsed?: string;
}

export interface StudentSubmission {
  id: string;
  name: string;
  content: string; // Could be text or extracted text from file
  status: 'pending' | 'grading' | 'completed' | 'error';
}

export interface EvaluatedStudent extends StudentSubmission {
  result?: GradeResult;
}

export interface Section {
  id: string;
  name: string;
  students: EvaluatedStudent[];
}

export interface Assignment {
  id: string;
  config: AssignmentConfig;
  sections: Section[];
  createdAt: number;
}

export enum AppView {
  LANDING = 'LANDING',
  PRICING = 'PRICING',
  WORKSPACES = 'WORKSPACES',
  SETUP = 'SETUP',
  DASHBOARD = 'DASHBOARD',
  DOCS = 'DOCS',
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS'
}
