import React, { useState, useRef, useEffect } from 'react';
import { Upload, Users, Brain, Loader2, FileText, CheckCircle, X, BarChart3, Download, ChevronLeft, Plus, LayoutGrid, Trash2, Pencil, Cpu, Menu } from './Icons';
import api from '../utils/api';

const Dashboard = ({ assignment, onUpdateAssignment, onBack }) => {
  const [activeSectionId, setActiveSectionId] = useState(
    assignment.sections.length > 0 ? assignment.sections[0].id : null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [tempSectionName, setTempSectionName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Processing status state
  const [processingStatus, setProcessingStatus] = useState(null);
  const [showProcessedData, setShowProcessedData] = useState(false);
  const [activeDataSection, setActiveDataSection] = useState('assignment'); // 'assignment', 'rubric', 'solution'

  const fileInputRef = useRef(null);
  const activeSection = assignment.sections.find(s => s.id === activeSectionId);

  // Poll for assignment processing status
  useEffect(() => {
    if (!assignment.backendId) return;

    const pollStatus = async () => {
      try {
        const token = await window.Clerk?.session?.getToken();
        const response = await api.get(`/assignments/${assignment.backendId}/status`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        setProcessingStatus(response.data);
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    // Initial poll
    pollStatus();

    // Continue polling until all processing is truly complete
    const interval = setInterval(() => {
      // Check if all documents have finished processing (not just evaluationReadyStatus)
      const assignmentDone = processingStatus?.assignmentProcessingStatus === 'completed' ||
                             processingStatus?.assignmentProcessingStatus === 'failed';
      const rubricDone = processingStatus?.rubricProcessingStatus === 'completed' ||
                         processingStatus?.rubricProcessingStatus === 'failed' ||
                         processingStatus?.rubricProcessingStatus === 'not_applicable';
      const solutionDone = processingStatus?.solutionProcessingStatus === 'completed' ||
                           processingStatus?.solutionProcessingStatus === 'failed' ||
                           processingStatus?.solutionProcessingStatus === 'not_applicable';

      const allProcessingComplete = assignmentDone && rubricDone && solutionDone;

      if (!allProcessingComplete) {
        pollStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [assignment.backendId, processingStatus?.assignmentProcessingStatus, processingStatus?.rubricProcessingStatus, processingStatus?.solutionProcessingStatus]);

  // Fetch existing submissions from backend
  useEffect(() => {
    if (!assignment.backendId) return;

    const fetchSubmissions = async () => {
      try {
        const token = await window.Clerk?.session?.getToken();
        const response = await api.get(`/submissions/${assignment.backendId}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (response.data?.submissions && response.data.submissions.length > 0) {
          // Debug logging
          console.log('📥 Fetched submissions:', response.data.submissions.length);
          response.data.submissions.forEach((sub, i) => {
            console.log(`  [${i}] ${sub.studentName}: status=${sub.evaluationStatus}, hasResult=${!!sub.evaluationResult}`);
            if (sub.evaluationResult) {
              console.log(`      score=${sub.evaluationResult.overallGrade}, feedback=${sub.evaluationResult.feedback?.substring(0, 50)}...`);
            }
          });

          // Ensure we have at least one section to add students to
          if (assignment.sections.length === 0) {
            console.log('⏳ Waiting for sections to be initialized before loading submissions');
            return;
          }

          // Map backend submissions to student format
          const backendStudents = response.data.submissions.map(sub => ({
            id: sub._id,
            name: sub.studentName,
            content: sub.submissionFile,
            fileType: sub.fileType || 'pdf',
            status: sub.evaluationStatus === 'completed' ? 'completed' :
                    sub.evaluationStatus === 'failed' ? 'error' :
                    sub.evaluationStatus === 'processing' ? 'grading' : 'pending',
            // Transform backend evaluationResult format to frontend format
            result: sub.evaluationResult ? {
              score: sub.evaluationResult.overallGrade ?? sub.overallGrade ?? 0,
              maxScore: sub.evaluationResult.totalPossible ?? sub.totalPossible ?? 100,
              letterGrade: sub.evaluationResult.letterGrade || '',
              feedback: sub.evaluationResult.feedback || '',
              strengths: sub.evaluationResult.strengths || [],
              weaknesses: sub.evaluationResult.areasForImprovement || [],
              actionableTips: sub.evaluationResult.actionableTips || '',
              lostMarks: sub.evaluationResult.lostMarks || [],
              questionScores: sub.evaluationResult.questionScores || []
            } : null,
            backendId: sub._id
          }));

          // Add students to the first section (or default section)
          const updatedSections = assignment.sections.map((section, index) => {
            if (index === 0) {
              const existingStudents = section.students || [];

              // Create a map of backend students by name for quick lookup
              const backendStudentsByName = new Map();
              backendStudents.forEach(s => backendStudentsByName.set(s.name, s));

              // Update existing students with backend data (by name match)
              const updatedStudents = existingStudents.map(existing => {
                const backendMatch = backendStudentsByName.get(existing.name);
                if (backendMatch) {
                  // Update existing student with backend evaluation results
                  backendStudentsByName.delete(existing.name); // Remove so we don't add it again
                  return {
                    ...existing,
                    backendId: backendMatch.backendId,
                    status: backendMatch.status,
                    result: backendMatch.result || existing.result
                  };
                }
                return existing;
              });

              // Add any remaining backend students that weren't matched
              const newStudents = Array.from(backendStudentsByName.values());

              return {
                ...section,
                students: [...updatedStudents, ...newStudents]
              };
            }
            return section;
          });

          if (JSON.stringify(updatedSections) !== JSON.stringify(assignment.sections)) {
            console.log('📝 Updating assignment with students:', updatedSections[0]?.students?.length || 0);
            updatedSections[0]?.students?.forEach((s, i) => {
              console.log(`  [${i}] ${s.name}: status=${s.status}, hasResult=${!!s.result}, score=${s.result?.score}`);
            });
            onUpdateAssignment({ ...assignment, sections: updatedSections });
          }
        }
      } catch (error) {
        console.error('Error fetching submissions:', error);
      }
    };

    fetchSubmissions();
  }, [assignment.backendId, assignment.sections.length]); // Re-run when sections are created

  // Check if processing is complete - only when ALL documents are processed
  const isProcessingComplete = processingStatus?.evaluationReadyStatus === 'ready';

  useEffect(() => {
    if (assignment.sections.length === 0) {
      const defaultSection = { id: 'default', name: 'Section 1', students: [] };
      onUpdateAssignment({
        ...assignment,
        sections: [defaultSection]
      });
      setActiveSectionId('default');
    } else if (!activeSectionId) {
      setActiveSectionId(assignment.sections[0].id);
    }
  }, [assignment.id]);

  const handleAddSection = (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    const newSection = {
      id: crypto.randomUUID(),
      name: newSectionName,
      students: []
    };

    onUpdateAssignment({
      ...assignment,
      sections: [...assignment.sections, newSection]
    });
    setActiveSectionId(newSection.id);
    setNewSectionName('');
    setShowAddSection(false);
  };

  const handleDeleteSection = (sectionId, e) => {
    e.stopPropagation();
    if (assignment.sections.length <= 1) {
      alert("You must have at least one section.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this section?")) {
      const newSections = assignment.sections.filter(s => s.id !== sectionId);
      onUpdateAssignment({
        ...assignment,
        sections: newSections
      });
      if (activeSectionId === sectionId) {
        setActiveSectionId(newSections[0].id);
      }
    }
  };

  const handleRenameStart = (section, e) => {
    e.stopPropagation();
    setEditingSectionId(section.id);
    setTempSectionName(section.name);
  };

  const handleRenameSave = (e) => {
    if (e) e.preventDefault();
    if (!editingSectionId) return;

    if (tempSectionName.trim()) {
      const updatedSections = assignment.sections.map(s =>
        s.id === editingSectionId ? { ...s, name: tempSectionName.trim() } : s
      );
      onUpdateAssignment({ ...assignment, sections: updatedSections });
    }
    setEditingSectionId(null);
  };

  const handleFileUpload = async (e) => {
    if (!activeSection) return;

    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newStudents = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = file.name.split('.').pop().toLowerCase();

      // For PDFs, store the file object for later upload
      // For text files, read the content
      if (fileExtension === 'pdf') {
        newStudents.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          file: file, // Store the actual file object for PDF upload
          content: `[PDF file: ${file.name}]`,
          fileType: 'pdf',
          status: 'pending'
        });
      } else {
        // Read text files
        const reader = new FileReader();
        const content = await new Promise((resolve) => {
          reader.onload = (event) => {
            resolve(event.target.result);
          };
          reader.readAsText(file);
        });

        newStudents.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          content: content,
          fileType: 'text',
          status: 'pending'
        });
      }
    }

    const updatedSection = {
      ...activeSection,
      students: [...activeSection.students, ...newStudents]
    };

    const updatedSections = assignment.sections.map(s => s.id === activeSection.id ? updatedSection : s);
    onUpdateAssignment({ ...assignment, sections: updatedSections });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runEvaluation = async () => {
    if (!activeSection) return;
    setIsProcessing(true);
    setProgress(0);

    let processedCount = 0;
    const studentsToGrade = [...activeSection.students];

    for (let i = 0; i < studentsToGrade.length; i++) {
      if (studentsToGrade[i].status !== 'completed') {
        studentsToGrade[i].status = 'grading';

        const currentSectionState = { ...activeSection, students: [...studentsToGrade] };
        const updatedSectionsState = assignment.sections.map(s => s.id === activeSection.id ? currentSectionState : s);
        onUpdateAssignment({ ...assignment, sections: updatedSectionsState });

        try {
          let response;

          // Check if this is a PDF file that needs to be uploaded
          if (studentsToGrade[i].fileType === 'pdf' && studentsToGrade[i].file) {
            // Use FormData to upload the PDF file
            const formData = new FormData();
            formData.append('file', studentsToGrade[i].file);
            formData.append('config', JSON.stringify(assignment.config));

            console.log(`📄 Uploading PDF for evaluation: ${studentsToGrade[i].name}`);

            response = await api.post('/grademind/evaluate', formData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            });
          } else {
            // Send text content directly
            response = await api.post('/grademind/evaluate', {
              config: assignment.config,
              studentContent: studentsToGrade[i].content
            });
          }

          studentsToGrade[i].result = response.data;
          studentsToGrade[i].status = 'completed';

          // Save result to database for CSV export
          if (assignment.backendId) {
            try {
              const token = await window.Clerk?.session?.getToken();
              await api.post('/grademind/save-result', {
                assignmentId: assignment.backendId,
                studentName: studentsToGrade[i].name,
                studentId: studentsToGrade[i].name,
                evaluationResult: response.data,
                sectionName: activeSection.name
              }, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
              });
              console.log(`✅ Saved result for ${studentsToGrade[i].name} to database`);
            } catch (saveError) {
              console.error('Error saving result to database:', saveError);
              // Don't fail the evaluation if save fails
            }
          }
        } catch (error) {
          console.error('Evaluation error:', error);
          // Show error but mark as failed
          studentsToGrade[i].result = {
            score: 0,
            maxScore: assignment.config.totalScore || 100,
            letterGrade: 'F',
            feedback: `Evaluation failed: ${error.response?.data?.error || error.message}`,
            strengths: [],
            weaknesses: ['Evaluation could not be completed'],
            actionableTips: 'Please try again or contact support if the issue persists.'
          };
          studentsToGrade[i].status = 'completed';
        }

        processedCount++;
        setProgress((processedCount / studentsToGrade.length) * 100);

        const newSectionState = { ...activeSection, students: [...studentsToGrade] };
        const newSectionsState = assignment.sections.map(s => s.id === activeSection.id ? newSectionState : s);
        onUpdateAssignment({ ...assignment, sections: newSectionsState });
      }
    }

    setIsProcessing(false);
  };

  const exportCsv = async () => {
    if (!assignment.backendId) {
      alert('Assignment not yet saved to backend');
      return;
    }

    try {
      const token = await window.Clerk?.session?.getToken();
      const response = await api.get(`/submissions/${assignment.backendId}/export-csv`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'detailed_marks.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV: ' + (error.response?.data?.error || error.message));
    }
  };

  const getGradeColor = (grade) => {
    if (!grade) return 'bg-zinc-100 text-zinc-500';
    if (grade.startsWith('A')) return 'bg-zinc-900 text-white';
    if (grade.startsWith('B')) return 'bg-zinc-200 text-zinc-900';
    if (grade.startsWith('C')) return 'bg-zinc-100 text-zinc-700';
    return 'bg-red-50 text-red-600 border border-red-100';
  };

  const completedStudents = activeSection?.students?.filter(s => s.status === 'completed' && s.result) || [];
  const scores = completedStudents.map(s => s.result.score);

  const getStats = () => {
    if (scores.length === 0) return null;

    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    const high = Math.max(...scores);
    const low = Math.min(...scores);

    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    const variance = scores.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: scores.length,
      average: avg.toFixed(1),
      high,
      low,
      median,
      stdDev: stdDev.toFixed(2)
    };
  };

  const stats = getStats();

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col flex-shrink-0
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-zinc-200">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-black transition-colors mb-4"
          >
            <ChevronLeft className="w-3 h-3" /> Back to Workspaces
          </button>
          <h2 className="font-bold text-zinc-900 leading-tight line-clamp-2">{assignment.config.title}</h2>
          <div className="mt-1 text-xs text-zinc-500 font-mono">Total: {assignment.config.totalScore || 100} Pts</div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-3 mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
            <span>Sections</span>
            <button onClick={() => setShowAddSection(!showAddSection)} className="hover:bg-zinc-200 p-1 rounded transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {showAddSection && (
            <form onSubmit={handleAddSection} className="px-3 mb-3">
              <input
                autoFocus
                type="text"
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                placeholder="Section Name..."
                className="w-full text-sm p-2 border border-zinc-300 rounded shadow-sm focus:ring-1 focus:ring-black focus:border-black outline-none"
                onBlur={() => !newSectionName && setShowAddSection(false)}
              />
            </form>
          )}

          {assignment.sections.map(section => (
            <div key={section.id} className="relative group">
              {editingSectionId === section.id ? (
                <form onSubmit={handleRenameSave} className="px-3 py-1">
                  <input
                    autoFocus
                    value={tempSectionName}
                    onChange={(e) => setTempSectionName(e.target.value)}
                    onBlur={() => handleRenameSave()}
                    className="w-full text-sm px-2 py-1 border border-zinc-300 rounded shadow-sm focus:ring-1 focus:ring-black focus:border-black outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => { setActiveSectionId(section.id); setSelectedStudent(null); setSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-all ${
                    activeSectionId === section.id
                      ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 opacity-50 flex-shrink-0" />
                    <span className="truncate">{section.name}</span>
                  </div>

                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2 bg-inherit">
                    <div
                      onClick={(e) => handleRenameStart(section, e)}
                      className="p-1 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-900 rounded mr-1"
                      title="Rename"
                    >
                      <Pencil className="w-3 h-3" />
                    </div>
                    <div
                      onClick={(e) => handleDeleteSection(section.id, e)}
                      className="p-1 hover:bg-red-100 hover:text-red-600 text-zinc-400 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </div>
                  </div>

                  {!editingSectionId && activeSectionId === section.id && (
                    <span className="ml-1 text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full group-hover:hidden flex-shrink-0">
                      {(section.students || []).length}
                    </span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200">
          <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-sm">
            <div className="text-xs text-zinc-500 mb-1">Overall Progress</div>
            <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-2">
              <div
                className="bg-zinc-900 h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    (assignment.sections.flatMap(s => s.students || []).filter(s => s.status === 'completed').length /
                      Math.max(1, assignment.sections.flatMap(s => s.students || []).length)) * 100
                  }%`
                }}
              />
            </div>
            <div className="text-xs font-medium text-zinc-900 flex justify-between">
              <span>{assignment.sections.flatMap(s => s.students || []).filter(s => s.status === 'completed').length} Graded</span>
              <span>{assignment.sections.flatMap(s => s.students || []).length} Total</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-16 border-b border-zinc-100 flex items-center justify-between px-4 md:px-8 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-zinc-400 hidden md:inline">/</span>
            <h2 className="font-semibold text-zinc-900 truncate">{activeSection?.name}</h2>
          </div>

          <div className="flex items-center gap-3">
            {/* View Processed Data button */}
            {isProcessingComplete && (
              <button
                onClick={() => setShowProcessedData(!showProcessedData)}
                className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-all"
              >
                <FileText className="w-4 h-4" />
                {showProcessedData ? 'Hide Data' : 'View Data'}
              </button>
            )}

            {isProcessingComplete && activeSection?.students?.length === 0 ? (
              <label className="cursor-pointer flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-all shadow-sm hover:shadow hover:-translate-y-0.5">
                <Upload className="w-4 h-4" />
                Upload Students
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".txt,.pdf,.md"
                  onChange={handleFileUpload}
                />
              </label>
            ) : isProcessingComplete && activeSection?.students?.length > 0 ? (
              <>
                <label className="cursor-pointer flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-all">
                  <Upload className="w-4 h-4" />
                  Add More
                  <input type="file" ref={fileInputRef} className="hidden" multiple accept=".txt,.pdf,.md" onChange={handleFileUpload} />
                </label>

                {!isProcessing && activeSection?.students?.some(s => s.status === 'pending') && (
                  <button
                    onClick={runEvaluation}
                    className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-all shadow-sm hover:shadow hover:-translate-y-0.5"
                  >
                    <Brain className="w-4 h-4" />
                    Evaluate Section
                  </button>
                )}
                {activeSection?.students?.length > 0 && activeSection?.students?.every(s => s.status === 'completed') && (
                  <button
                    onClick={exportCsv}
                    className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                )}
              </>
            ) : !isProcessingComplete ? (
              <span className="text-sm text-zinc-400 font-medium">Processing...</span>
            ) : null}
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-4 md:p-8">
          {/* Show processing status if not complete */}
          {!isProcessingComplete && processingStatus && (
            <div className="h-full flex flex-col">
              <div className="bg-white rounded-xl border border-zinc-200 p-8 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-zinc-900 p-2 rounded-lg">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-zinc-900">Processing Assignment</h3>
                    <p className="text-sm text-zinc-500">Please wait while we analyze your documents...</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-zinc-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-zinc-400" />
                        <span className="font-medium">Assignment PDF</span>
                      </div>
                      <span className={`text-sm font-mono px-2 py-1 rounded ${
                        processingStatus.assignmentProcessingStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        processingStatus.assignmentProcessingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                        processingStatus.assignmentProcessingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {processingStatus.assignmentProcessingStatus}
                      </span>
                    </div>
                    {processingStatus.assignmentProcessingStatus === 'failed' && processingStatus.processingError && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{processingStatus.processingError}</p>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-zinc-400" />
                        <span className="font-medium">Rubric</span>
                      </div>
                      <span className={`text-sm font-mono px-2 py-1 rounded ${
                        processingStatus.rubricProcessingStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        processingStatus.rubricProcessingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                        processingStatus.rubricProcessingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        processingStatus.rubricProcessingStatus === 'not_applicable' ? 'bg-zinc-100 text-zinc-400' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {processingStatus.rubricProcessingStatus}
                      </span>
                    </div>
                    {processingStatus.rubricProcessingStatus === 'failed' && processingStatus.rubricProcessingError && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{processingStatus.rubricProcessingError}</p>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-zinc-400" />
                        <span className="font-medium">Solution</span>
                      </div>
                      <span className={`text-sm font-mono px-2 py-1 rounded ${
                        processingStatus.solutionProcessingStatus === 'completed' ? 'bg-green-100 text-green-700' :
                        processingStatus.solutionProcessingStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                        processingStatus.solutionProcessingStatus === 'failed' ? 'bg-red-100 text-red-700' :
                        processingStatus.solutionProcessingStatus === 'not_applicable' ? 'bg-zinc-100 text-zinc-400' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {processingStatus.solutionProcessingStatus}
                      </span>
                    </div>
                    {processingStatus.solutionProcessingStatus === 'failed' && processingStatus.solutionProcessingError && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{processingStatus.solutionProcessingError}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show processed data viewer when complete */}
          {isProcessingComplete && showProcessedData && (
            <div className="h-full flex flex-col">
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex-1 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
                  <h3 className="font-semibold text-sm text-zinc-900">Processed Data Structure</h3>
                  <button
                    onClick={() => setShowProcessedData(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-900"
                  >
                    Close
                  </button>
                </div>
                <div className="p-6 overflow-y-auto h-full">
                  <div className="space-y-3">
                    {/* Assignment Structure Accordion */}
                    {processingStatus?.processedData && (
                      <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setActiveDataSection(activeDataSection === 'assignment' ? null : 'assignment')}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                            activeDataSection === 'assignment' ? 'bg-zinc-100' : 'bg-zinc-50 hover:bg-zinc-100'
                          }`}
                        >
                          <h4 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Assignment Structure</h4>
                          <svg
                            className={`w-4 h-4 text-zinc-400 transition-transform ${activeDataSection === 'assignment' ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {activeDataSection === 'assignment' && (
                          <div className="p-4 border-t border-zinc-200">
                            <pre className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 text-xs font-mono text-zinc-700 overflow-x-auto max-h-96">
                              {JSON.stringify(processingStatus.processedData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rubric Criteria Accordion */}
                    {processingStatus?.processedRubric && (
                      <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setActiveDataSection(activeDataSection === 'rubric' ? null : 'rubric')}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                            activeDataSection === 'rubric' ? 'bg-zinc-100' : 'bg-zinc-50 hover:bg-zinc-100'
                          }`}
                        >
                          <h4 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Rubric Criteria</h4>
                          <svg
                            className={`w-4 h-4 text-zinc-400 transition-transform ${activeDataSection === 'rubric' ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {activeDataSection === 'rubric' && (
                          <div className="p-4 border-t border-zinc-200">
                            <pre className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 text-xs font-mono text-zinc-700 overflow-x-auto max-h-96">
                              {JSON.stringify(processingStatus.processedRubric, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Solution Key Accordion */}
                    {processingStatus?.processedSolution && (
                      <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setActiveDataSection(activeDataSection === 'solution' ? null : 'solution')}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                            activeDataSection === 'solution' ? 'bg-zinc-100' : 'bg-zinc-50 hover:bg-zinc-100'
                          }`}
                        >
                          <h4 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Solution Key</h4>
                          <svg
                            className={`w-4 h-4 text-zinc-400 transition-transform ${activeDataSection === 'solution' ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {activeDataSection === 'solution' && (
                          <div className="p-4 border-t border-zinc-200">
                            <pre className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 text-xs font-mono text-zinc-700 overflow-x-auto max-h-96">
                              {JSON.stringify(processingStatus.processedSolution, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show student upload section only when processing is complete and not viewing processed data */}
          {isProcessingComplete && !showProcessedData && !activeSection?.students?.length ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-100 rounded-2xl">
              <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-lg font-medium text-zinc-900">Assignment Ready</p>
              <p className="text-sm max-w-sm text-center mt-2 mb-4">Processing complete. You can now upload student submissions.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowProcessedData(true)}
                  className="flex items-center gap-2 text-zinc-600 border border-zinc-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-50"
                >
                  <FileText className="w-4 h-4" /> View Processed Data
                </button>
                <label className="cursor-pointer flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">
                  <Upload className="w-4 h-4" /> Upload Students
                  <input type="file" ref={fileInputRef} className="hidden" multiple accept=".txt,.pdf,.md" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          ) : isProcessingComplete && !showProcessedData && activeSection?.students?.length > 0 ? (
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full overflow-auto lg:overflow-hidden">
              <div className="lg:flex-1 bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col shadow-sm min-h-[300px] lg:min-h-0">
                <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/30">
                  <h3 className="font-semibold text-sm text-zinc-900">Students ({activeSection.students.length})</h3>
                  {isProcessing && (
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {Math.round(progress)}%
                    </div>
                  )}
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-sm text-left min-w-[400px]">
                    <thead className="text-xs text-zinc-400 uppercase bg-white sticky top-0 border-b border-zinc-100">
                      <tr>
                        <th className="px-4 md:px-6 py-3 font-medium">Name</th>
                        <th className="px-4 md:px-6 py-3 font-medium">Status</th>
                        <th className="px-4 md:px-6 py-3 font-medium text-right">Score (/{assignment.config.totalScore || 100})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {activeSection.students.map((student) => (
                        <tr
                          key={student.id}
                          onClick={() => setSelectedStudent(student)}
                          className={`cursor-pointer transition-colors ${selectedStudent?.id === student.id ? 'bg-zinc-50' : 'hover:bg-zinc-50'}`}
                        >
                          <td className="px-4 md:px-6 py-4 font-medium text-zinc-900">{student.name}</td>
                          <td className="px-4 md:px-6 py-4">
                            {student.status === 'pending' && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400"><div className="w-1.5 h-1.5 rounded-full bg-zinc-300" /> Pending</span>}
                            {student.status === 'grading' && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600"><Loader2 className="w-3 h-3 animate-spin" /> Evaluating</span>}
                            {student.status === 'completed' && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600"><CheckCircle className="w-3 h-3" /> Done</span>}
                            {student.status === 'error' && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600"><X className="w-3 h-3" /> Error</span>}
                          </td>
                          <td className="px-4 md:px-6 py-4 text-right font-mono text-zinc-600">
                            {student.result ? student.result.score : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:flex-[1.3] flex flex-col gap-4 lg:gap-6 lg:h-full lg:overflow-hidden">
                {stats && !selectedStudent && (
                  <div className="bg-white rounded-xl border border-zinc-200 p-8 shadow-sm flex-shrink-0 animate-in fade-in">
                    <h3 className="font-semibold text-sm text-zinc-900 mb-6 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Section Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 flex flex-col">
                        <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Mean Score</div>
                        <div className="text-3xl font-bold text-zinc-900 mt-auto">{stats.average}</div>
                      </div>
                      <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 flex flex-col">
                        <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Median Score</div>
                        <div className="text-3xl font-bold text-zinc-900 mt-auto">{stats.median}</div>
                      </div>
                      <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 flex flex-col">
                        <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Std Dev</div>
                        <div className="text-3xl font-bold text-zinc-900 mt-auto">{stats.stdDev}</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-100 flex flex-col">
                        <div className="text-green-600 text-[10px] font-bold uppercase tracking-widest mb-2">Highest</div>
                        <div className="text-3xl font-bold text-green-700 mt-auto">{stats.high}</div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col">
                        <div className="text-red-600 text-[10px] font-bold uppercase tracking-widest mb-2">Lowest</div>
                        <div className="text-3xl font-bold text-red-700 mt-auto">{stats.low}</div>
                      </div>
                      <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 flex flex-col">
                        <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-2">Count</div>
                        <div className="text-3xl font-bold text-zinc-900 mt-auto">{stats.count}</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedStudent ? (
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
                    {selectedStudent.status === 'completed' && selectedStudent.result ? (
                      <>
                        <div className="p-8 border-b border-zinc-100 flex justify-between items-start">
                          <div>
                            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{selectedStudent.name}</h2>
                            <p className="text-sm text-zinc-400 mt-1 font-mono">ID: {selectedStudent.id.substring(0, 8)}</p>
                          </div>
                          <div className="px-5 py-3 rounded-xl bg-zinc-100 text-zinc-900 flex flex-col items-center min-w-[80px]">
                            <div className="text-3xl font-bold leading-none">{selectedStudent.result.score}</div>
                            <div className="text-xs font-semibold mt-1 opacity-80">/ {selectedStudent.result.maxScore}</div>
                          </div>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-8">
                          <div>
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Evaluation Summary</h4>
                            <p className="text-sm text-zinc-700 leading-7">
                              {selectedStudent.result.feedback}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-8">
                            <div className="bg-green-50/50 p-4 rounded-lg border border-green-100/50">
                              <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" /> Strengths
                              </h4>
                              <ul className="space-y-2">
                                {selectedStudent.result.strengths.map((s, i) => (
                                  <li key={i} className="text-sm text-zinc-700 leading-snug">
                                    • {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-red-50/50 p-4 rounded-lg border border-red-100/50">
                              <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <X className="w-3 h-3" /> Areas for Improvement
                              </h4>
                              <ul className="space-y-2">
                                {selectedStudent.result.weaknesses.map((w, i) => (
                                  <li key={i} className="text-sm text-zinc-700 leading-snug">
                                    • {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <Brain className="w-3 h-3" /> Actionable Tip
                            </h4>
                            <p className="text-sm text-blue-900 font-medium">
                              {selectedStudent.result.actionableTips}
                            </p>
                          </div>

                          {selectedStudent.result.modelScores && Object.keys(selectedStudent.result.modelScores).length > 1 && (
                            <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100/50">
                              <h4 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Cpu className="w-3 h-3" /> Model Scores (Average: {selectedStudent.result.score})
                              </h4>
                              <div className="grid grid-cols-3 gap-3">
                                {Object.entries(selectedStudent.result.modelScores).map(([model, score]) => (
                                  <div key={model} className="bg-white p-3 rounded border border-purple-100 text-center">
                                    <div className="text-lg font-bold text-zinc-900">{score}</div>
                                    <div className="text-xs text-zinc-500 truncate" title={model}>
                                      {model.replace('gemini-', '').replace('-latest', '')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="pt-8 border-t border-zinc-100">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Submission Excerpt</h4>
                            <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 text-xs font-mono text-zinc-500 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                              {selectedStudent.content.substring(0, 500)}...
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-8 text-center">
                        {selectedStudent.status === 'pending' && <FileText className="w-12 h-12 text-zinc-200 mb-4" />}
                        {selectedStudent.status === 'grading' && <Loader2 className="w-12 h-12 text-zinc-900 animate-spin mb-4" />}
                        <p className="font-medium text-zinc-900">
                          {selectedStudent.status === 'pending' ? 'Evaluation pending' : 'Analyzing submission...'}
                        </p>
                        {selectedStudent.status === 'pending' && <p className="text-sm mt-2">Select "Evaluate Section" to process this student.</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-zinc-50/50 border border-dashed border-zinc-200 rounded-xl text-zinc-400">
                    <div className="text-center">
                      {!stats ? (
                        <>
                          <LayoutGrid className="w-8 h-8 mx-auto mb-3 opacity-20" />
                          <p>Evaluate students to view statistics & reports</p>
                        </>
                      ) : (
                        <>
                          <LayoutGrid className="w-8 h-8 mx-auto mb-3 opacity-20" />
                          <p>Select a student to view detailed report</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
