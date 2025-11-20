import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, FileText, Sparkles, CheckCircle, Loader2, Brain, Zap, Search, X } from './Icons';

const AuthModal = ({ isOpen, onClose, onLogin, onSignup }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-zinc-100 animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-zinc-200">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Welcome to EduGrade</h3>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">Sign in to access your workspace or create a new account to get started.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full bg-zinc-900 text-white font-medium py-3 rounded-xl hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            Log In
          </button>
          <button
            onClick={onSignup}
            className="w-full bg-white text-zinc-900 border border-zinc-200 font-medium py-3 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-all"
          >
            Create Account
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-400">By continuing, you agree to our Terms of Service.</p>
        </div>
      </div>
    </div>
  );
};

const GradingAnimation = () => {
  const [phase, setPhase] = useState(0);
  const [processText, setProcessText] = useState("Processing...");

  useEffect(() => {
    let mounted = true;
    const runAnimation = async () => {
      while (mounted) {
        setPhase(0);
        await new Promise(r => setTimeout(r, 2000));
        if (!mounted) break;

        setPhase(1);

        setProcessText("Reading content...");
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;

        setProcessText("Checking rubric criteria...");
        await new Promise(r => setTimeout(r, 1000));
        if (!mounted) break;

        setProcessText("Analyzing arguments...");
        await new Promise(r => setTimeout(r, 1000));
        if (!mounted) break;

        setProcessText("Drafting feedback...");
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;

        setPhase(2);
        await new Promise(r => setTimeout(r, 5000));
      }
    };
    runAnimation();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden font-sans select-none transform hover:scale-[1.02] transition-transform duration-500">
      <div className="bg-white border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-zinc-100 p-1.5 rounded">
            <FileText className="w-3 h-3 text-zinc-600" />
          </div>
          <span className="text-xs font-semibold text-zinc-900">History_Essay_Final.pdf</span>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-wider flex items-center gap-2">
          {phase === 0 && <span className="text-zinc-400">Ready</span>}
          {phase === 1 && (
            <span className="text-blue-600 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> AI Processing
            </span>
          )}
          {phase === 2 && (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Graded
            </span>
          )}
        </div>
      </div>

      <div className="p-8 h-[400px] relative bg-zinc-50/30">
        <div className={`transition-all duration-700 bg-white shadow-sm border border-zinc-200 p-8 rounded-lg h-full relative overflow-hidden ${phase === 2 ? 'opacity-40 blur-[1px]' : 'opacity-100'}`}>
          <h4 className="text-base font-bold text-zinc-900 mb-4 font-serif">The Impact of the Industrial Revolution</h4>
          <div className="space-y-4 text-[11px] leading-relaxed text-zinc-600 font-serif text-justify">
            <p>
              The Industrial Revolution, spanning the late 18th and early 19th centuries, marked a pivotal shift in human history, transitioning societies from agrarian economies to machine-based manufacturing.
            </p>
            <p>
              However, this rapid industrialization was not without its consequences. The unparalleled rate of urbanization led to overcrowding in cities like Manchester and London.
            </p>
            <p>
              Despite these significant social challenges, the era laid the undeniable groundwork for the modern global economic system.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>

        {phase === 1 && (
          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-b-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{animation: 'scan 2s linear infinite'}}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900/95 text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 shadow-xl backdrop-blur-md min-w-[180px] justify-center transition-all duration-300 border border-zinc-700/50">
              <Sparkles className="w-3 h-3 animate-pulse text-yellow-300" />
              {processText}
            </div>
          </div>
        )}

        <div className={`absolute inset-0 z-20 flex items-center justify-center transition-all duration-500 ${phase === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
          <div className="bg-white w-[90%] rounded-xl shadow-xl border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold">A</div>
                <div className="text-sm opacity-80 font-medium border-l border-zinc-700 pl-3">
                  <div>Score</div>
                  <div>94/100</div>
                </div>
              </div>
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1 h-full bg-green-500 rounded-full"></div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-zinc-400">Feedback</p>
                  <p className="text-xs text-zinc-700 leading-relaxed">
                    Excellent analysis of socio-economic factors. Your thesis is strong and supported by relevant evidence.
                  </p>
                </div>
              </div>
              <div className="bg-zinc-50 p-2 rounded border border-zinc-100 flex items-center gap-2">
                <Brain className="w-3 h-3 text-blue-500" />
                <p className="text-[10px] text-zinc-600"><span className="font-bold text-zinc-900">Tip:</span> Explore the impact on global trade routes in more depth.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-50 px-4 py-2 border-t border-zinc-200 text-[10px] text-zinc-400 flex justify-between items-center font-mono">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${phase === 1 ? 'bg-blue-500 animate-pulse' : 'bg-zinc-300'}`}></div>
          <span>Gemini 2.5 Flash</span>
        </div>
        <div>
          {phase === 1 ? '143 tokens/sec' : 'Latency: 1.2s'}
        </div>
      </div>
    </div>
  );
};

const Landing = ({ onStart, onLogin, onDocs, onPrivacy, onTerms }) => {
  const [sloganIndex, setSloganIndex] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const slogans = ["in seconds.", "with precision.", "effortlessly."];

  useEffect(() => {
    const interval = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % slogans.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white selection:bg-zinc-900 selection:text-white">
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={onLogin}
        onSignup={() => { setShowAuthModal(false); onStart(); }}
      />

      <nav className="w-full px-6 py-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-black">edugrade.ai</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onStart} className="text-sm font-medium text-zinc-500 hover:text-black transition-colors hidden md:block">Pricing</button>
          <button onClick={onDocs} className="text-sm font-medium text-zinc-500 hover:text-black transition-colors hidden md:block">Docs</button>
          <button
            onClick={() => setShowAuthModal(true)}
            className="text-sm font-medium bg-zinc-100 hover:bg-zinc-200 px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col lg:flex-row items-center max-w-7xl mx-auto w-full px-6 py-12 lg:py-20 gap-16">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-600 mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Now powering 10,000+ classrooms</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-zinc-900 leading-[1.1]">
            Grading done <br />
            <span
              key={sloganIndex}
              className="text-zinc-400 inline-block"
              style={{animation: 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards'}}
            >
              {slogans[sloganIndex]}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-500 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Precision automated grading for modern educators. Create rubrics, upload assignments, and let AI provide detailed, actionable feedback instantly.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <button
              onClick={onStart}
              className="group flex items-center gap-2 bg-zinc-900 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-zinc-800 transition-all duration-300 shadow-lg shadow-zinc-200 hover:shadow-xl hover:-translate-y-1"
            >
              Start Grading Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 opacity-60 grayscale">
            <span className="text-sm font-bold text-zinc-400">STANFORD</span>
            <span className="text-sm font-bold text-zinc-400">MIT</span>
            <span className="text-sm font-bold text-zinc-400">HARVARD</span>
            <span className="text-sm font-bold text-zinc-400">BERKELEY</span>
          </div>
        </div>

        <div className="flex-1 w-full max-w-lg lg:max-w-full flex justify-center lg:justify-end">
          <div className="relative w-full">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-zinc-100 to-zinc-50 rounded-full blur-3xl opacity-60 -z-10"></div>
            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-gradient-to-tr from-zinc-100 to-blue-50 rounded-full blur-3xl opacity-60 -z-10"></div>
            <GradingAnimation />
          </div>
        </div>
      </main>

      <section className="border-t border-zinc-100 bg-zinc-50/50 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shadow-sm">
                <Brain className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="font-bold text-lg">Context-Aware AI</h3>
              <p className="text-zinc-500 leading-relaxed">
                Our models don't just read; they understand. By uploading your specific solution key and rubric, we ensure grading matches your exact standards.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shadow-sm">
                <Zap className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="font-bold text-lg">Lightning Fast</h3>
              <p className="text-zinc-500 leading-relaxed">
                Grade an entire section of 50 students in under 3 minutes. Powered by Gemini 2.5 Flash for unparalleled speed and efficiency.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-10 h-10 bg-white border border-zinc-200 rounded-lg flex items-center justify-center shadow-sm">
                <Search className="w-5 h-5 text-zinc-900" />
              </div>
              <h3 className="font-bold text-lg">Detailed Analytics</h3>
              <p className="text-zinc-500 leading-relaxed">
                Go beyond just scores. View class-wide performance distributions, identify common misconceptions, and track improvement over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white py-12 border-t border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-zinc-400">
            © 2024 edugrade.ai. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm font-medium text-zinc-500">
            <button onClick={onPrivacy} className="hover:text-black transition-colors">Privacy</button>
            <button onClick={onTerms} className="hover:text-black transition-colors">Terms</button>
            <a href="#" className="hover:text-black transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
