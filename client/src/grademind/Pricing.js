import React from 'react';
import { Check, Zap, Shield, ArrowRight, ChevronLeft, Sparkles } from './Icons';

const Pricing = ({ onSelectPlan, onBack }) => {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white flex flex-col">
      <nav className="w-full p-6 flex justify-between items-center max-w-7xl mx-auto">
        <button
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onBack}
        >
          <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight">grademind.ai</span>
        </button>
        <button onClick={onBack} className="text-sm font-medium text-zinc-500 hover:text-black transition-colors flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="text-center max-w-3xl mb-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-zinc-900">Simple, transparent pricing.</h1>
          <p className="text-xl text-zinc-500">Choose the plan that fits your classroom needs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
          {/* Starter Plan */}
          <div className="flex flex-col p-8 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-all bg-white">
            <div className="mb-4">
              <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold">Starter</h3>
              <p className="text-sm text-zinc-500 mt-1">For individual teachers trying out AI.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-zinc-500">/mo</span>
            </div>
            <button
              onClick={() => onSelectPlan('Starter')}
              className="w-full py-3 rounded-lg border border-zinc-200 text-zinc-900 font-medium hover:bg-zinc-50 transition-colors mb-8"
            >
              Get Started
            </button>
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> 1 Active Workspace
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Up to 30 Students
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Basic AI Grading
              </div>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="flex flex-col p-8 rounded-2xl border-2 border-zinc-900 bg-zinc-50 relative transform md:-translate-y-4 shadow-xl">
            <div className="absolute top-0 right-0 bg-zinc-900 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg uppercase tracking-wider">
              Most Popular
            </div>
            <div className="mb-4">
              <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-xl font-bold">Pro Educator</h3>
              <p className="text-sm text-zinc-500 mt-1">Power features for heavy grading loads.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">$19</span>
              <span className="text-zinc-500">/mo</span>
            </div>
            <button
              onClick={() => onSelectPlan('Pro')}
              className="w-full py-3 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-800 hover:shadow-lg transition-all mb-8 flex items-center justify-center gap-2"
            >
              Upgrade Now <ArrowRight className="w-4 h-4" />
            </button>
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Unlimited Workspaces
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Unlimited Students
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Priority AI Processing
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Advanced Analytics
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> PDF & File Uploads
              </div>
            </div>
          </div>

          {/* Institution Plan */}
          <div className="flex flex-col p-8 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-all bg-white">
            <div className="mb-4">
              <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold">Institution</h3>
              <p className="text-sm text-zinc-500 mt-1">For departments and schools.</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">Custom</span>
            </div>
            <button
              onClick={() => onSelectPlan('Institution')}
              className="w-full py-3 rounded-lg border border-zinc-200 text-zinc-900 font-medium hover:bg-zinc-50 transition-colors mb-8"
            >
              Contact Sales
            </button>
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> SSO Integration
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Admin Dashboard
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Custom Rubric Templates
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-700">
                <Check className="w-4 h-4 text-zinc-900" /> Dedicated Support
              </div>
            </div>
          </div>
        </div>

        <p className="mt-12 text-sm text-zinc-400">
          14-day money-back guarantee. Cancel anytime.
        </p>
      </div>
    </div>
  );
};

export default Pricing;
