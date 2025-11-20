import React from 'react';
import { Check, ChevronLeft } from './Icons';

const Privacy = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-zinc-900 selection:text-white flex flex-col">
      <nav className="w-full px-6 py-4 border-b border-zinc-200 sticky top-0 bg-white/80 backdrop-blur-sm z-20">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
            <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-black">edugrade.ai</span>
          </div>
          <button onClick={onBack} className="text-sm font-medium text-zinc-500 hover:text-black flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-zinc-500">Last updated: March 15, 2024</p>
        </div>

        <div className="prose prose-zinc max-w-none space-y-12">
          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-4">1. Introduction</h2>
            <p className="text-zinc-600 leading-relaxed">
              EduGrade ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our automated grading services.
              <br /><br />
              We take student data privacy seriously and comply with applicable educational privacy laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-4">2. Information We Collect</h2>
            <div className="space-y-4 text-zinc-600">
              <p><strong>Personal Data:</strong> We collect personally identifiable information such as your name, email address, and institutional affiliation when you register for an account.</p>
              <p><strong>Student Data:</strong> We process student submission data (text, documents) strictly for the purpose of providing grading services. We do not own this data.</p>
              <p><strong>Usage Data:</strong> We automatically collect information about how you interact with our services, such as access times, pages viewed, and IP addresses.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-zinc-600 leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 text-zinc-600">
              <li>Provide, operate, and maintain our services.</li>
              <li>Improve, personalize, and expand our services.</li>
              <li>Process transactions and send related information.</li>
              <li>Send you emails, newsletters, and support messages.</li>
              <li>Detect and prevent fraud.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-4">4. AI Processing & Data Security</h2>
            <p className="text-zinc-600 leading-relaxed">
              <strong>AI Models:</strong> Student submissions are processed using Google's Gemini API. Data sent to the API is used for the purpose of generating content and is not used to train Google's foundation models without permission.
              <br /><br />
              <strong>Data Retention:</strong> We retain student data only for as long as necessary to fulfill the purposes outlined in this policy. You may delete assignments and student data from your workspace at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-4">5. Contact Us</h2>
            <p className="text-zinc-600 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
              <br />
              <a href="mailto:privacy@edugrade.ai" className="text-black font-medium underline">privacy@edugrade.ai</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
