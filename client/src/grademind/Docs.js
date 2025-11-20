import React, { useState } from 'react';
import { Check, ChevronLeft, Search, BookOpen, Sparkles, Zap, Cpu, LayoutGrid, FileText, Menu, X } from './Icons';

const Docs = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('intro');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'intro', title: 'Introduction', icon: Sparkles },
    { id: 'quickstart', title: 'Quick Start', icon: Zap },
    { id: 'assignments', title: 'Assignments & Rubrics', icon: LayoutGrid },
    { id: 'models', title: 'AI Models', icon: Cpu },
    { id: 'files', title: 'File Uploads', icon: FileText },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'intro':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">Introduction</h1>
              <p className="text-lg text-zinc-500 leading-relaxed">
                EduGrade is a precision evaluation tool designed to help educators grade assignments faster and more consistently using advanced AI.
              </p>
            </div>
            <hr className="border-zinc-100" />
            <div className="prose prose-zinc max-w-none">
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">Why EduGrade?</h3>
              <p className="text-zinc-600 mb-4">
                Traditional grading is time-consuming and prone to fatigue-induced inconsistency. EduGrade acts as a teaching assistant that reads student submissions, compares them against your specific rubric and solution key, and generates detailed feedback in seconds.
              </p>
              <h3 className="text-xl font-semibold text-zinc-900 mb-3">Key Features</h3>
              <ul className="list-disc list-inside space-y-2 text-zinc-600 ml-2">
                <li><strong>Context-Aware Grading:</strong> Upload your exact rubric and solution key.</li>
                <li><strong>Multi-Model Consensus:</strong> Use multiple AI models to reduce hallucination and bias.</li>
                <li><strong>Batch Processing:</strong> Grade entire sections (50+ students) in minutes.</li>
                <li><strong>Privacy First:</strong> Student data is processed securely and isolated within your workspace.</li>
              </ul>
            </div>
          </div>
        );
      case 'quickstart':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">Quick Start Guide</h1>
              <p className="text-lg text-zinc-500 leading-relaxed">
                Get your first assignment graded in under 5 minutes.
              </p>
            </div>
            <hr className="border-zinc-100" />
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">1</div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">Create a Workspace</h3>
                  <p className="text-zinc-600">Navigate to the Workspaces tab and click <span className="bg-zinc-100 px-2 py-0.5 rounded text-sm font-mono text-zinc-800">+ New Assignment</span>.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">2</div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">Define Criteria</h3>
                  <p className="text-zinc-600 mb-2">You will be guided through a 5-step wizard:</p>
                  <ul className="list-disc list-inside text-zinc-600 text-sm space-y-1 ml-2 bg-zinc-50 p-4 rounded-lg border border-zinc-100">
                    <li><strong>Details:</strong> Title and total points.</li>
                    <li><strong>Rubric:</strong> How points are awarded (copy/paste or upload PDF).</li>
                    <li><strong>Solution:</strong> The reference answer or key.</li>
                    <li><strong>AI Config:</strong> Select the model (Gemini Flash is default).</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">3</div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">Upload & Grade</h3>
                  <p className="text-zinc-600">Inside your new workspace, create a Section. Use the <span className="bg-zinc-100 px-2 py-0.5 rounded text-sm font-mono text-zinc-800">Upload Students</span> button to batch upload PDFs or text files. Finally, click <strong>Evaluate Section</strong>.</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'assignments':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">Assignments & Rubrics</h1>
              <p className="text-lg text-zinc-500 leading-relaxed">
                The quality of the AI output depends heavily on the quality of your inputs.
              </p>
            </div>
            <hr className="border-zinc-100" />

            <div className="space-y-6">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Structuring Rubrics
                </h3>
                <p className="text-zinc-600 mb-4">
                  AI works best with explicit, point-based rubrics. Avoid vague statements like "good grammar."
                </p>
                <div className="bg-white border border-zinc-200 rounded p-4 text-sm font-mono text-zinc-700 whitespace-pre-wrap">
{`Bad: "Give points for good analysis."

Good:
1. Thesis (20 pts): Strong, arguable claim located at the end of the intro.
2. Evidence (30 pts): At least 3 direct quotes from the text.
3. Analysis (30 pts): Explains HOW the evidence supports the thesis.`}
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5" /> Reference Solutions
                </h3>
                <p className="text-zinc-600">
                  Providing a "Gold Standard" answer helps the AI calibrate. For math/science, provide the step-by-step calculation. For essays, provide an example of an 'A' grade paper.
                </p>
              </div>
            </div>
          </div>
        );
      case 'models':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">AI Models</h1>
              <p className="text-lg text-zinc-500 leading-relaxed">
                Choose the right intelligence for the task.
              </p>
            </div>
            <hr className="border-zinc-100" />

            <div className="grid gap-6">
              <div className="p-6 border border-zinc-200 rounded-xl hover:border-zinc-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-yellow-100 rounded-lg"><Zap className="w-5 h-5 text-yellow-600" /></div>
                  <h3 className="text-lg font-bold">Gemini 2.5 Flash</h3>
                </div>
                <p className="text-zinc-600 text-sm mb-4">The default workhorse. Extremely fast and cost-effective. Best for standard essays, history, english, and general summarization tasks.</p>
                <span className="text-xs bg-zinc-100 px-2 py-1 rounded border border-zinc-200">Best Value</span>
              </div>

              <div className="p-6 border border-zinc-200 rounded-xl hover:border-zinc-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg"><Sparkles className="w-5 h-5 text-purple-600" /></div>
                  <h3 className="text-lg font-bold">Gemini 3 Pro</h3>
                </div>
                <p className="text-zinc-600 text-sm mb-4">Enhanced reasoning capabilities. Use this for complex STEM problems, code review, or logic-heavy assignments where nuance is critical.</p>
                <span className="text-xs bg-zinc-100 px-2 py-1 rounded border border-zinc-200">High Reasoning</span>
              </div>

              <div className="p-6 border border-zinc-200 rounded-xl hover:border-zinc-400 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg"><Cpu className="w-5 h-5 text-blue-600" /></div>
                  <h3 className="text-lg font-bold">Flash Lite</h3>
                </div>
                <p className="text-zinc-600 text-sm mb-4">Optimized for speed. Use this for simple compliance checks (e.g., "Did the student submit 500 words?").</p>
              </div>
            </div>
          </div>
        );
      case 'files':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">File Uploads</h1>
              <p className="text-lg text-zinc-500 leading-relaxed">
                EduGrade supports native document processing.
              </p>
            </div>
            <hr className="border-zinc-100" />
            <div className="space-y-4">
              <p className="text-zinc-600">
                You can upload documents for:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-600 ml-4">
                <li>Assignment Descriptions</li>
                <li>Rubrics</li>
                <li>Solution Keys</li>
                <li>Student Submissions (Batch upload)</li>
              </ul>

              <h3 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">Supported Formats</h3>
              <div className="flex gap-4">
                <div className="bg-zinc-50 border border-zinc-200 px-4 py-2 rounded font-mono text-sm">.pdf (Text based)</div>
                <div className="bg-zinc-50 border border-zinc-200 px-4 py-2 rounded font-mono text-sm">.txt</div>
                <div className="bg-zinc-50 border border-zinc-200 px-4 py-2 rounded font-mono text-sm">.md</div>
              </div>

              <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg mt-4 text-sm text-yellow-800">
                <strong>Note:</strong> For scanned PDFs (images), the system will use OCR capabilities within the Gemini model.
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-zinc-900 selection:text-white">
      <nav className="w-full px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white/80 backdrop-blur-sm z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
            <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-black">edugrade.ai</span>
            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-xs rounded-full font-mono border border-zinc-200 ml-2">DOCS</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-400 text-sm w-64">
              <Search className="w-4 h-4 mr-2" />
              <span>Search docs...</span>
            </div>
            <button onClick={onBack} className="text-sm font-medium text-zinc-500 hover:text-black flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Exit
            </button>
            <button
              className="md:hidden p-2 text-zinc-600"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto w-full flex">
        <aside className="hidden md:block w-64 border-r border-zinc-200 h-[calc(100vh-73px)] sticky top-[73px] overflow-y-auto py-8 px-4 bg-zinc-50/50">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 px-3">Documentation</div>
          <nav className="space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeSection === item.id
                    ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <item.icon className={`w-4 h-4 ${activeSection === item.id ? 'text-black' : 'text-zinc-400'}`} />
                {item.title}
              </button>
            ))}
          </nav>

          <div className="mt-8 pt-8 border-t border-zinc-200 px-3">
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Resources</div>
            <a href="#" className="block text-sm text-zinc-500 hover:text-black mb-2 flex items-center gap-2"><BookOpen className="w-4 h-4" /> API Reference</a>
            <a href="#" className="block text-sm text-zinc-500 hover:text-black mb-2">Community Forum</a>
            <a href="#" className="block text-sm text-zinc-500 hover:text-black">Status Page</a>
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-10 bg-white pt-20 px-6">
            <nav className="space-y-2">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-base font-medium rounded-lg transition-colors ${
                    activeSection === item.id
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-500'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.title}
                </button>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 min-w-0 py-12 px-6 md:px-12 lg:px-16">
          <div className="max-w-3xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
