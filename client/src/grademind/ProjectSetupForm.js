import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Upload, FileText, X, Paperclip, CheckCircle, LayoutGrid, Code, FileCode } from './Icons';

const ProjectSetupForm = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({
    title: '',
    description: '',
    totalPoints: 100,
    projectType: 'code_and_report', // 'code_only', 'report_only', 'code_and_report'
    programmingLanguage: '',
    acceptedFileTypes: ['.py', '.js', '.java', '.cpp', '.c'],
    rubric: '',
    selectedModels: ['gemini-2.5-pro']
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

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
    else onComplete(config);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else onCancel();
  };

  const isStepValid = () => {
    if (step === 1) return config.title.trim().length > 0 && config.description.trim().length > 0;
    if (step === 2) return config.projectType.length > 0;
    if (step === 3) return true; // Rubric optional
    if (step === 4) return config.selectedModels.length > 0;
    return true;
  };

  const projectTypes = [
    {
      id: 'code_only',
      name: 'Code Only',
      desc: 'Students submit code files only',
      icon: <Code className="w-5 h-5" />
    },
    {
      id: 'report_only',
      name: 'Report Only',
      desc: 'Students submit PDF reports',
      icon: <FileText className="w-5 h-5" />
    },
    {
      id: 'code_and_report',
      name: 'Code & Report',
      desc: 'Students submit both code and report',
      icon: <FileCode className="w-5 h-5" />
    }
  ];

  const languageOptions = [
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'other', label: 'Other' }
  ];

  const FileUploader = ({ field, currentFile, label, accept = '.pdf,.txt' }) => (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</label>
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
            <span className="text-sm font-medium">Upload File</span>
          </div>
          <input type="file" className="hidden" accept={accept} onChange={(e) => handleFileChange(field, e)} />
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
            <h2 className="text-3xl font-bold tracking-tight mb-2">New Project</h2>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-sm font-mono">
            <span className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${step === 1 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>01 Details</span>
            <span className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${step === 2 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>02 Type</span>
            <span className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${step === 3 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>03 Rubric</span>
            <span className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${step === 4 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>04 AI Config</span>
            <span className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${step === 5 ? 'bg-black text-white' : 'text-zinc-400 bg-zinc-100'}`}>05 Review</span>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {/* Step 1: Details */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full bg-white border border-zinc-200 rounded-lg p-4 text-xl font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all placeholder:text-zinc-300"
                  placeholder="e.g. Machine Learning Classification Project"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Project Description <span className="text-red-500">*</span></label>
                <textarea
                  value={config.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full h-48 bg-white border border-zinc-200 rounded-lg p-4 text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-300"
                  placeholder="Describe the project requirements and what students should implement..."
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Points</label>
                <input
                  type="number"
                  value={config.totalPoints}
                  onChange={(e) => handleChange('totalPoints', parseInt(e.target.value) || 0)}
                  className="w-32 bg-white border border-zinc-200 rounded-lg p-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  min="1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Project Type */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Submission Type</label>
                <p className="text-sm text-zinc-500">What type of submissions will students provide?</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projectTypes.map((type) => (
                  <div
                    key={type.id}
                    onClick={() => handleChange('projectType', type.id)}
                    className={`cursor-pointer p-6 rounded-xl border transition-all ${
                      config.projectType === type.id
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg'
                        : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 rounded-lg ${config.projectType === type.id ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                        {type.icon}
                      </div>
                      {config.projectType === type.id && <CheckCircle className="w-5 h-5 text-white" />}
                    </div>
                    <h3 className={`font-bold text-sm mb-1 ${config.projectType === type.id ? 'text-white' : 'text-zinc-900'}`}>{type.name}</h3>
                    <p className={`text-xs ${config.projectType === type.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {type.desc}
                    </p>
                  </div>
                ))}
              </div>

              {(config.projectType === 'code_only' || config.projectType === 'code_and_report') && (
                <div className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Programming Language</label>
                    <select
                      value={config.programmingLanguage}
                      onChange={(e) => handleChange('programmingLanguage', e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                    >
                      <option value="">Select language...</option>
                      {languageOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Rubric */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Grading Rubric</label>
                  <p className="text-sm text-zinc-500">Define the criteria for evaluating project submissions.</p>
                </div>
                <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-1 rounded font-mono">Optional</span>
              </div>

              <textarea
                value={config.rubric}
                onChange={(e) => handleChange('rubric', e.target.value)}
                className="w-full h-48 bg-zinc-50 border border-zinc-200 rounded-lg p-6 text-sm font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all resize-none placeholder:text-zinc-400"
                placeholder={`Code Quality (30pts):\n- Clean, readable code structure\n- Proper variable naming\n- Efficient algorithms\n\nFunctionality (40pts):\n- All features implemented\n- Correct output\n- Error handling\n\nDocumentation (30pts):\n- Code comments\n- README file\n- Report quality`}
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

          {/* Step 4: AI Config */}
          {step === 4 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Select AI Model</label>
                <p className="text-sm text-zinc-500">Choose the AI model for project evaluation.</p>

                <div className="grid grid-cols-1 gap-4">
                  <div
                    onClick={() => handleChange('selectedModels', ['gemini-2.5-pro'])}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      config.selectedModels.includes('gemini-2.5-pro')
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg'
                        : 'bg-white border-zinc-200 text-zinc-900 hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`font-bold text-sm mb-1 ${config.selectedModels.includes('gemini-2.5-pro') ? 'text-white' : 'text-zinc-900'}`}>Gemini 2.5 Pro</h3>
                        <p className={`text-xs ${config.selectedModels.includes('gemini-2.5-pro') ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Best for code analysis and detailed feedback
                        </p>
                      </div>
                      {config.selectedModels.includes('gemini-2.5-pro') && <CheckCircle className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-zinc-50 rounded-xl p-8 border border-zinc-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-zinc-900 p-2 rounded-lg">
                    <LayoutGrid className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900">Project Configuration Summary</h3>
                    <p className="text-sm text-zinc-500">Review before creating the project.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Project Title</h4>
                      <div className="text-lg font-medium text-zinc-900">{config.title}</div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Total Points</h4>
                      <div className="text-lg font-medium text-zinc-900">{config.totalPoints}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Submission Type</h4>
                      <div className="text-sm font-medium text-zinc-900">
                        {projectTypes.find(t => t.id === config.projectType)?.name}
                      </div>
                    </div>
                    {config.programmingLanguage && (
                      <div>
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Language</h4>
                        <div className="text-sm font-medium text-zinc-900">{config.programmingLanguage}</div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white border border-zinc-200 rounded-lg">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Description</h4>
                    <div className="text-sm text-zinc-600 line-clamp-4">{config.description}</div>
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
                      <span className="text-zinc-400 italic text-sm">Not provided</span>
                    )}
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
            {step === 4 ? 'Review' : (step === 5 ? 'Create Project' : 'Continue')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSetupForm;
