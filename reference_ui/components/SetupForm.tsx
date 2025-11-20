import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, FileText, X, Paperclip, CheckCircle, LayoutGrid, Cpu, Zap, Sparkles, ToggleLeft, ToggleRight } from './ui/Icons';
import { AssignmentConfig } from '../types';

interface SetupFormProps {
  onComplete: (config: AssignmentConfig) => void;
  onCancel: () => void;
}

const SetupForm: React.FC<SetupFormProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<AssignmentConfig>({
    title: '',
    totalScore: 100,
    description: '',
    rubric: '',
    solution: '',
    selectedModels: ['gemini-2.5-flash'],
    useAverageGrading: false
  });

  const handleChange = (field: keyof AssignmentConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (field: 'descriptionFile' | 'rubricFile' | 'solutionFile', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
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

  const removeFile = (field: 'descriptionFile' | 'rubricFile' | 'solutionFile') => {
      setConfig(prev => ({ ...prev, [field]: undefined }));
  };

  const toggleModel = (modelId: string) => {
      setConfig(prev => {
          const current = prev.selectedModels || [];
          let newModels;
          if (current.includes(modelId)) {
              newModels = current.filter(m => m !== modelId);
              // Prevent deselecting all models
              if (newModels.length === 0) newModels = ['gemini-2.5-flash'];
          } else {
              newModels = [...current, modelId];
          }
          
          // If only 1 model is selected, force average grading off
          return {
              ...prev,
              selectedModels: newModels,
              useAverageGrading: newModels.length > 1 ? prev.useAverageGrading : false
          };
      });
  };

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else onComplete(config);
  };
  
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onCancel();
  };

  const isStepValid = () => {
    if (step === 1) return config.title.trim().length > 0 && config.totalScore > 0 && (config.description.trim().length > 0 || !!config.descriptionFile);
    if (step === 2) return config.rubric.trim().length > 0 || !!config.rubricFile;
    if (step === 3) return config.solution.trim().length > 0 || !!config.solutionFile;
    if (step === 4) return config.selectedModels.length > 0;
    return true;
  };

  const availableModels = [
      { 
          id: 'gemini-2.5-flash', 
          name: 'Gemini 2.5 Flash', 
          desc: 'Fast, efficient, and balanced. Best for standard essays.', 
          icon: <Zap className="w-4 h-4 text-yellow-500" /> 
      },
      { 
          id: 'gemini-3-pro-preview', 
          name: 'Gemini 3 Pro (Preview)', 
          desc: 'High reasoning capability. Best for complex STEM or logic.', 
          icon: <Sparkles className="w-4 h-4 text-purple-500" /> 
      },
      { 
          id: 'gemini-flash-lite-latest', 
          name: 'Gemini Flash Lite', 
          desc: 'Lightweight and rapid. Best for simple checks.', 
          icon: <Cpu className="w-4 h-4 text-blue-500" /> 
      }
  ];

  const FileUploader = ({ field, currentFile, label }: { field: 'descriptionFile' | 'rubricFile' | 'solutionFile', currentFile?: { name: string }, label: string }) => (
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
             <span className={`px-3 py-1 rounded-full transition-colors ${step === 2 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>02 Rubric</span>
             <span className={`px-3 py-1 rounded-full transition-colors ${step === 3 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>03 Solution</span>
             <span className={`px-3 py-1 rounded-full transition-colors ${step === 4 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>04 AI Config</span>
             <span className={`px-3 py-1 rounded-full transition-colors ${step === 5 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>05 Review</span>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Assignment Title</label>
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
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Points</label>
                    <input
                      type="number"
                      value={config.totalScore}
                      onChange={(e) => handleChange('totalScore', parseInt(e.target.value) || 0)}
                      className="w-full bg-white border border-zinc-200 rounded-lg p-4 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                      min="1"
                    />
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Description / Instructions</label>
                    <textarea
                    value={config.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full h-48 bg-white border border-zinc-200 rounded-lg p-4 text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-300"
                    placeholder="Paste the full assignment prompt or instructions here..."
                    />
                  </div>
                  <div className="relative flex items-center py-2">
                     <div className="flex-grow border-t border-zinc-100"></div>
                     <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-mono uppercase">OR</span>
                     <div className="flex-grow border-t border-zinc-100"></div>
                  </div>
                  <FileUploader field="descriptionFile" currentFile={config.descriptionFile} label="Upload Description"/>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Grading Rubric</label>
                <p className="text-sm text-zinc-500">Define the criteria the AI should use to evaluate submissions.</p>
                <textarea
                  value={config.rubric}
                  onChange={(e) => handleChange('rubric', e.target.value)}
                  className="w-full h-64 bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-400"
                  placeholder={`1. Thesis (20pts): Clear, arguable thesis statement.\n2. Evidence (30pts): Uses citations effectively.\n3. Analysis (30pts): Explains significance of evidence.`}
                  autoFocus
                />
              </div>
              <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-zinc-100"></div>
                    <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-mono uppercase">OR</span>
                    <div className="flex-grow border-t border-zinc-100"></div>
              </div>
              <FileUploader field="rubricFile" currentFile={config.rubricFile} label="Upload Rubric"/>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
               <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Reference Solution / Key</label>
                <p className="text-sm text-zinc-500">Provide a model answer or key to ground the AI's evaluation.</p>
                <textarea
                  value={config.solution}
                  onChange={(e) => handleChange('solution', e.target.value)}
                  className="w-full h-64 bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-400"
                  placeholder="Paste the correct answer, code solution, or an exemplary essay here..."
                  autoFocus
                />
              </div>
              <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-zinc-100"></div>
                    <span className="flex-shrink-0 mx-4 text-xs text-zinc-400 font-mono uppercase">OR</span>
                    <div className="flex-grow border-t border-zinc-100"></div>
              </div>
              <FileUploader field="solutionFile" currentFile={config.solutionFile} label="Upload Solution"/>
            </div>
          )}

          {step === 4 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Select AI Models</label>
                      <p className="text-sm text-zinc-500">Choose one or more models for evaluation. Using multiple models provides a consensus view.</p>
                      
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
                                      Calculate the final score by averaging results from all selected models. Feedback will be synthesized.
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

          {step === 5 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                  <div className="bg-zinc-50 rounded-xl p-8 border border-zinc-200">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="bg-zinc-900 p-2 rounded-lg">
                             <LayoutGrid className="w-5 h-5 text-white" />
                          </div>
                          <div>
                              <h3 className="font-bold text-lg text-zinc-900">Configuration Schema</h3>
                              <p className="text-sm text-zinc-500">Review the evaluation parameters before creating the workspace.</p>
                          </div>
                      </div>
                      
                      <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Assignment Title</h4>
                                <div className="text-lg font-medium text-zinc-900">{config.title}</div>
                                <div className="text-sm text-zinc-500">Total Points: {config.totalScore}</div>
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
                                {config.selectedModels.length > 1 && (
                                    <div className="text-xs text-zinc-500 mt-1">
                                        {config.useAverageGrading ? '• Averaging Enabled' : '• Averaging Disabled'}
                                    </div>
                                )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <FileText className="w-3 h-3" /> Description
                                  </h4>
                                  {config.descriptionFile ? (
                                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                          <Paperclip className="w-4 h-4 text-zinc-400" />
                                          <span className="truncate">{config.descriptionFile.name}</span>
                                      </div>
                                  ) : (
                                      <div className="text-sm text-zinc-600 font-mono line-clamp-4">{config.description}</div>
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
                                  ) : (
                                      <div className="text-sm text-zinc-600 font-mono line-clamp-4">{config.rubric}</div>
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
                                  ) : (
                                      <div className="text-sm text-zinc-600 font-mono line-clamp-4">{config.solution}</div>
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
                {step === 4 ? 'Review Schema' : (step === 5 ? 'Create Workspace' : 'Continue')}
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default SetupForm;