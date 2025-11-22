import React, { useState } from 'react';
import { Plus, Folder, Trash2, Check, ChevronRight, LogOut, FolderCode } from './Icons';

const Workspaces = ({
  assignments,
  projects = [],
  onCreateNew,
  onCreateProject,
  onSelect,
  onSelectProject,
  onDelete,
  onDeleteProject,
  onLogout,
  userName,
  userImageUrl
}) => {
  const [activeTab, setActiveTab] = useState('assignments');

  return (
    <div className="min-h-screen w-full bg-zinc-50 flex flex-col relative isolate overflow-x-hidden">
      <div className="fixed inset-0 bg-zinc-50 -z-10 pointer-events-none" />

      <header className="bg-white border-b border-zinc-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 rounded-sm flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-zinc-900">grademind.ai</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {userImageUrl ? (
                <img
                  src={userImageUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover border border-zinc-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-zinc-600">
                    {userName?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
              <div className="text-sm text-zinc-600">
                Welcome, <span className="font-medium text-zinc-900">{userName || 'User'}</span>
              </div>
            </div>
            <button onClick={onLogout} className="p-2 hover:bg-zinc-100 rounded-full transition-colors" title="Logout">
              <LogOut className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 z-0">
        <div className="max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Workspaces</h1>
              <p className="text-zinc-500 mt-1">Manage your assignments and projects.</p>
            </div>
            <div className="flex items-center gap-3">
              {activeTab === 'assignments' ? (
                <button
                  onClick={onCreateNew}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  New Assignment
                </button>
              ) : (
                <button
                  onClick={onCreateProject}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'assignments'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Assignments ({assignments.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'projects'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderCode className="w-4 h-4" />
                Projects ({projects.length})
              </span>
            </button>
          </div>

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <>
              {assignments.length === 0 ? (
                <div className="border border-dashed border-zinc-300 rounded-2xl p-12 text-center bg-white shadow-sm">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Folder className="w-8 h-8 text-zinc-300" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-900">No assignments yet</h3>
                  <p className="text-zinc-500 max-w-sm mx-auto mt-2 mb-8">Create your first assignment workspace to start adding sections and grading students.</p>
                  <button
                    onClick={onCreateNew}
                    className="text-sm font-medium text-zinc-900 hover:underline decoration-zinc-300 underline-offset-4"
                  >
                    Create an assignment &rarr;
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="group bg-white border border-zinc-200 rounded-xl p-6 hover:border-zinc-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between h-64 cursor-pointer relative overflow-hidden"
                      onClick={() => onSelect(assignment.id)}
                    >
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(assignment.id); }}
                          className="p-2 hover:bg-red-50 hover:text-red-600 rounded text-zinc-400 transition-colors"
                          title="Delete Assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4 relative z-0">
                        <div className="w-10 h-10 bg-zinc-100 rounded-lg flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-zinc-900 line-clamp-1">{assignment.config.title}</h3>
                          <p className="text-sm text-zinc-500 line-clamp-2 mt-2 h-10 leading-relaxed">{assignment.config.description || "No description provided."}</p>
                        </div>
                      </div>

                      <div className="mt-auto pt-6 border-t border-zinc-100 flex justify-between items-center relative z-0">
                        <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                          <span>{assignment.sections.length} Sections</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                          <span>{assignment.sections.reduce((acc, s) => acc + s.students.length, 0)} Students</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                          <span className="font-semibold text-zinc-700">{assignment.config.totalScore || 100} Pts</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors transform group-hover:translate-x-1">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <>
              {projects.length === 0 ? (
                <div className="border border-dashed border-zinc-300 rounded-2xl p-12 text-center bg-white shadow-sm">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FolderCode className="w-8 h-8 text-zinc-300" />
                  </div>
                  <h3 className="text-lg font-medium text-zinc-900">No projects yet</h3>
                  <p className="text-zinc-500 max-w-sm mx-auto mt-2 mb-8">Create your first project to evaluate code submissions and reports.</p>
                  <button
                    onClick={onCreateProject}
                    className="text-sm font-medium text-zinc-900 hover:underline decoration-zinc-300 underline-offset-4"
                  >
                    Create a project &rarr;
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="group bg-white border border-zinc-200 rounded-xl p-6 hover:border-zinc-400 hover:shadow-lg transition-all duration-300 flex flex-col justify-between h-64 cursor-pointer relative overflow-hidden"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                          className="p-2 hover:bg-red-50 hover:text-red-600 rounded text-zinc-400 transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-4 relative z-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                          <FolderCode className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-zinc-900 line-clamp-1">{project.config.title}</h3>
                          <p className="text-sm text-zinc-500 line-clamp-2 mt-2 h-10 leading-relaxed">{project.config.description || "No description provided."}</p>
                        </div>
                      </div>

                      <div className="mt-auto pt-6 border-t border-zinc-100 flex justify-between items-center relative z-0">
                        <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                          <span className="capitalize">{project.config.projectType?.replace(/_/g, ' ')}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                          <span>{project.submissions?.length || 0} Submissions</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                          <span className="font-semibold text-zinc-700">{project.config.totalPoints || 100} Pts</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors transform group-hover:translate-x-1">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Workspaces;
