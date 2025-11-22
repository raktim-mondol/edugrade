import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, FileText, X, Paperclip, CheckCircle, LayoutGrid, Cpu, Zap, Sparkles, ToggleLeft, ToggleRight } from './Icons';

const SetupForm = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    title: '',
    description: '',
    totalScore: 100,
    assignmentText: '',
    rubric: '',
    solution: '',
    selectedModels: ['gemini-2.5-pro'],
    useAverageGrading: false
  });

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      setConfig(prev => ({
        ...prev,
        [field]: {
          mimeType: file.type,
          data: base64String,
          name: file.name
        }
      }));
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const removeFile = (field) => {
    setConfig(prev => ({ ...prev, [field]: undefined }));
  };

  const toggleModel = (modelId) => {
    setConfig(prev => {
      const current = prev.selectedModels || [];
      let newModels;
      if (current.includes(modelId)) {
        newModels = current.filter(m => m !== modelId);
        if (newModels.length === 0) newModels = ['gemini-2.5-pro'];
      } else {
        newModels = [...current, modelId];
      }

      return {
        ...prev,
        selectedModels: newModels,
        useAverageGrading: newModels.length > 1 ? prev.useAverageGrading : false
      };
    });
  };

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
    else onComplete(config);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onCancel();
  };

  const isStepValid = () => {
    if (step === 1) return config.title.trim().length > 0 && config.description.trim().length > 0;
    if (step === 2) return !!config.assignmentFile || config.assignmentText.trim().length > 0; // Either PDF or text required
    if (step === 3) return true; // Rubric is optional
    if (step === 4) return true; // Solution is optional
    if (step === 5) return config.selectedModels.length > 0;
    return true;
  };

  const availableModels = [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      desc: 'Most capable model. Best for complex grading and detailed feedback.',
      icon: <Sparkles className="w-4 h-4 text-purple-500" />
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      desc: 'Fast, efficient, and balanced. Best for standard essays.',
      icon: <Zap className="w-4 h-4 text-yellow-500" />
    },
    {
      id: 'gemini-flash-lite-latest',
      name: 'Gemini Flash Lite',
      desc: 'Lightweight and rapid. Best for simple checks.',
      icon: <Cpu className="w-4 h-4 text-blue-500" />
    }
  ];

  const PDFUploader = ({ field, currentFile, label, required = false }) => (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      </div>
      {currentFile ? (
        <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-200 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-zinc-600" />
            </div>
            <span className="text-sm font-medium text-zinc-900">{currentFile.name}</span>
          </div>
          <button onClick={() => removeFile(field)} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="cursor-pointer group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all">
          <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-zinc-600">
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">Upload PDF File</span>
            <span className="text-xs text-zinc-400">Click or drag and drop</span>
          </div>
          <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileChange(field, e)} />
        </label>
      )}
    </div>
  );

  const FileUploader = ({ field, currentFile, label }) => (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label} (PDF/Text)</label>
      </div>
      {currentFile ? (
        <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-200 rounded flex items-center justify-center">
              <FileText className="w-4 h-4 text-zinc-600" />
            </div>
            <span className="text-sm font-medium text-zinc-900">{currentFile.name}</span>
          </div>
          <button onClick={() => removeFile(field)} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="cursor-pointer group flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-all">
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-600">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload PDF or Text File</span>
          </div>
          <input type="file" className="hidden" accept=".pdf,.txt" onChange={(e) => handleFileChange(field, e)} />
        </label>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="max-w-4xl mx-auto w-full py-12 px-6 flex-1 flex flex-col">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <button onClick={onCancel} className="text-xs font-mono text-zinc-400 hover:text-black mb-4 flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" /> Back to Workspaces
            </button>
            <h2 className="text-3xl font-bold tracking-tight mb-2">New Assignment</h2>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-sm font-mono">
            <span className={`px-3 py-1 rounded-full transition-colors ${step === 1 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>01 Details</span>
            <span className={`px-3 py-1 rounded-full transition-colors ${step === 2 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>02 Assignment</span>
            <span className={`px-3 py-1 rounded-full transition-colors ${step === 3 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>03 Rubric</span>
            <span className={`px-3 py-1 rounded-full transition-colors ${step === 4 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>04 Solution</span>
            <span className={`px-3 py-1 rounded-full transition-colors ${step === 5 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>05 AI Config</span>
            <span className={`px-3 py-1 rounded-full transition-colors ${step === 6 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>06 Review</span>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {/* Step 1: Details - Title and Description only (no PDF, no marks) */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Assignment Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg p-4 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all placeholder:text-zinc-300"
                  placeholder="e.g. Midterm Essay: The Great Gatsby"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Instructions / Context <span className="text-red-500">*</span></label>
                <p className="text-sm text-zinc-500">Provide context or instructions for the AI grader about this assignment.</p>
                <textarea
                  value={config.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full h-48 bg-white border border-zinc-200 rounded-lg p-4 text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-300"
                  placeholder="This is a midterm essay assignment for English Literature 101. Students should demonstrate understanding of symbolism and themes in The Great Gatsby..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Assignment Content (PDF or Text) */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Assignment Questions <span className="text-red-500">*</span></label>
                <p className="text-sm text-zinc-500">Provide the assignment questions either as text or by uploading a PDF.</p>
              </div>
              <textarea
                value={config.assignmentText}
                onChange={(e) => handleChange('assignmentText', e.target.value)}
                className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-400"
                placeholder={`Question 1 (20 points): Analyze the symbolism of the green light in The Great Gatsby.\n\nQuestion 2 (30 points): Compare and contrast the characters of Tom and Gatsby.\n\nQuestion 3 (50 points): Write an essay discussing the theme of the American Dream.`}
                autoFocus
              />
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-100"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-mono uppercase">OR</span>
                <div className="flex-grow border-t border-zinc-100"></div>
              </div>
              <PDFUploader
                field="assignmentFile"
                currentFile={config.assignmentFile}
                label="Assignment PDF"
                required={false}
              />
            </div>
          )}

          {/* Step 3: Rubric (optional) with Total Marks */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Grading Rubric</label>
                  <p className="text-sm text-zinc-500">Define the criteria the AI should use to evaluate submissions.</p>
                </div>
                <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-1 rounded font-mono">Optional</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Points</label>
                <input
                  type="number"
                  value={config.totalScore}
                  onChange={(e) => handleChange('totalScore', parseInt(e.target.value) || 0)}
                  className="w-full md:w-48 bg-white border border-zinc-200 rounded-lg p-4 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  min="1"
                />
              </div>

              <textarea
                value={config.rubric}
                onChange={(e) => handleChange('rubric', e.target.value)}
                className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-400"
                placeholder={`1. Thesis (20pts): Clear, arguable thesis statement.\n2. Evidence (30pts): Uses citations effectively.\n3. Analysis (30pts): Explains significance of evidence.`}
                autoFocus
              />
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-100"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-mono uppercase">OR</span>
                <div className="flex-grow border-t border-zinc-100"></div>
              </div>
              <FileUploader field="rubricFile" currentFile={config.rubricFile} label="Upload Rubric" />
            </div>
          )}

          {/* Step 4: Solution (optional) */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Reference Solution / Key</label>
                  <p className="text-sm text-zinc-500">Provide a model answer or key to ground the AI's evaluation.</p>
                </div>
                <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-1 rounded font-mono">Optional</span>
              </div>
              <textarea
                value={config.solution}
                onChange={(e) => handleChange('solution', e.target.value)}
                className="w-full h-64 bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-400"
                placeholder="Paste the correct answer, code solution, or an exemplary essay here..."
                autoFocus
              />
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-zinc-100"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-mono uppercase">OR</span>
                <div className="flex-grow border-t border-zinc-100"></div>
              </div>
              <FileUploader field="solutionFile" currentFile={config.solutionFile} label="Upload Solution" />
            </div>
          )}

          {/* Step 5: AI Config */}
          {step === 5 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Select AI Models</label>
                <p className="text-sm text-zinc-500">Choose one or more models for evaluation.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {availableModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => toggleModel(model.id)}
                      className={`cursor-pointer p-4 rounded-xl border transition-all ${
                        config.selectedModels.includes(model.id)
                          ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg'
                          : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2 rounded-lg ${config.selectedModels.includes(model.id) ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                          {model.icon}
                        </div>
                        {config.selectedModels.includes(model.id) && <CheckCircle className="w-5 h-5 text-white" />}
                      </div>
                      <h3 className="font-bold text-sm mb-1">{model.name}</h3>
                      <p className={`text-xs ${config.selectedModels.includes(model.id) ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {model.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {config.selectedModels.length > 1 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Cpu className="w-4 h-4 text-zinc-900" />
                        <h3 className="font-bold text-zinc-900">Average Grading (Consensus)</h3>
                      </div>
                      <p className="text-sm text-zinc-500 max-w-md">
                        Calculate the final score by averaging results from all selected models.
                      </p>
                    </div>
                    <button
                      onClick={() => handleChange('useAverageGrading', !config.useAverageGrading)}
                      className="transition-colors text-zinc-900"
                    >
                      {config.useAverageGrading ? (
                        <ToggleRight className="w-10 h-10" />
                      ) : (
                        <ToggleLeft className="w-10 h-10 text-zinc-300" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-zinc-50 rounded-xl p-8 border border-zinc-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-zinc-900 p-2 rounded-lg">
                    <LayoutGrid className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900">Configuration Summary</h3>
                    <p className="text-sm text-zinc-500">Review the assignment setup before processing.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Assignment Title</h4>
                      <div className="text-lg font-medium text-zinc-900">{config.title}</div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Points</h4>
                      <div className="text-lg font-medium text-zinc-900">{config.totalScore}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">AI Configuration</h4>
                    <div className="flex flex-wrap gap-2">
                      {config.selectedModels.map(m => (
                        <span key={m} className="text-xs bg-white border border-zinc-200 px-2 py-1 rounded text-zinc-600 font-mono">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <FileText className="w-3 h-3" /> Instructions
                      </h4>
                      <div className="text-sm text-zinc-600 line-clamp-4">{config.description || <span className="text-zinc-400 italic">Not provided</span>}</div>
                    </div>

                    <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <FileText className="w-3 h-3" /> Assignment Questions
                      </h4>
                      {config.assignmentFile ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <Paperclip className="w-4 h-4 text-zinc-400" />
                          <span className="truncate">{config.assignmentFile.name}</span>
                        </div>
                      ) : config.assignmentText ? (
                        <div className="text-sm text-zinc-600 font-mono line-clamp-4">{config.assignmentText}</div>
                      ) : (
                        <span className="text-zinc-400 italic text-sm">Not provided</span>
                      )}
                    </div>

                    <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" /> Rubric
                      </h4>
                      {config.rubricFile ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <Paperclip className="w-4 h-4 text-zinc-400" />
                          <span className="truncate">{config.rubricFile.name}</span>
                        </div>
                      ) : config.rubric ? (
                        <div className="text-sm text-zinc-600 font-mono line-clamp-4">{config.rubric}</div>
                      ) : (
                        <span className="text-zinc-400 italic text-sm">Not provided (will extract from assignment)</span>
                      )}
                    </div>

                    <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" /> Solution
                      </h4>
                      {config.solutionFile ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                          <Paperclip className="w-4 h-4 text-zinc-400" />
                          <span className="truncate">{config.solutionFile.name}</span>
                        </div>
                      ) : config.solution ? (
                        <div className="text-sm text-zinc-600 font-mono line-clamp-4">{config.solution}</div>
                      ) : (
                        <span className="text-zinc-400 italic text-sm">Not provided</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-8 border-t border-zinc-100 mt-8">
          <button onClick={handleBack} className="text-zinc-500 hover:text-black font-medium px-4 py-2">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={handleNext}
            disabled={!isStepValid()}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium transition-all shadow-sm ${
              isStepValid()
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 hover:shadow-md hover:-translate-y-0.5'
                : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {step === 5 ? 'Review' : (step === 6 ? 'Create & Process' : 'Continue')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetupForm;
