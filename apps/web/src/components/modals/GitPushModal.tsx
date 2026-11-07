'use client';

import React, { useState } from 'react';
import {
  GitCommit,
  GitBranch,
  FolderPlus,
  Lock,
  Globe,
  Loader2,
  X,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface GitPushModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPush: (options: {
    message: string;
    branch?: string;
    createNewBranch?: boolean;
    repoName?: string;
    isPrivate?: boolean;
  }) => Promise<void>;
  isLocalOrigin: boolean;
  defaultBranch?: string;
  defaultRepoName?: string;
  activeFilePath?: string | null;
  isPushLocked?: boolean;
  isPushing?: boolean;
}

export const GitPushModal: React.FC<GitPushModalProps> = ({
  isOpen,
  onClose,
  onConfirmPush,
  isLocalOrigin,
  defaultBranch = 'main',
  defaultRepoName = 'spatial-workspace',
  activeFilePath,
  isPushLocked = false,
  isPushing = false,
}) => {
  const { palette } = useTheme();

  // Local Origin state
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [isPrivate, setIsPrivate] = useState(false);

  // GitHub Origin state
  const [branchMode, setBranchMode] = useState<'current' | 'new'>('current');
  const [newBranchName, setNewBranchName] = useState('');

  // Commit message state
  const [commitMessage, setCommitMessage] = useState(
    isLocalOrigin
      ? 'Initial commit via Glyph'
      : `Update ${activeFilePath || 'workspace'}`
  );
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPushLocked || isPushing) return;
    setErrorMessage('');

    if (isLocalOrigin) {
      if (!repoName.trim()) {
        setErrorMessage('Repository identifier required.');
        return;
      }
    } else {
      if (branchMode === 'new' && !newBranchName.trim()) {
        setErrorMessage('Branch identifier required.');
        return;
      }
    }

    try {
      await onConfirmPush({
        message: commitMessage.trim() || 'Update via Glyph',
        branch: branchMode === 'new' ? newBranchName.trim() : defaultBranch,
        createNewBranch: branchMode === 'new',
        repoName: isLocalOrigin ? repoName.trim() : undefined,
        isPrivate: isLocalOrigin ? isPrivate : undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Push operation failed');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="git-push-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-lg rounded-xl border shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Header: Stationary height */}
        <div
          className="h-12 px-5 flex items-center justify-between border-b flex-none"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: `${palette.surface}80`,
          }}
        >
          <div className="flex items-center space-x-2.5">
            <GitCommit className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
            <h3 id="git-push-title" className="font-semibold text-sm truncate">
              {isLocalOrigin ? 'Create GitHub Repository' : 'Git Commit & Push'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPushing}
            className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center flex-none text-gray-400 hover:text-white transition-colors disabled:opacity-40 btn-tactile"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mutex Lock Banner if locked */}
        {isPushLocked && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center space-x-2 text-amber-400 text-xs flex-none">
            <Lock className="w-4 h-4 shrink-0" />
            <span className="truncate">
              <strong>Mutex Active:</strong> Concurrent push locked by another collaborator.
            </span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Section 1: Origin Branching */}
          {isLocalOrigin ? (
            <div
              className="p-3.5 rounded-lg border space-y-3"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.background}60`,
              }}
            >
              <div className="flex items-center space-x-2 font-semibold">
                <FolderPlus className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
                <span>Initialize Remote Repository</span>
              </div>
              <p className="text-[11px] opacity-70 leading-relaxed">
                Initializes repository and commits workspace files via GitHub API.
              </p>

              <div>
                <label className="block text-[10px] opacity-60 uppercase mb-1">
                  Repository Identifier
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-workspace"
                  className="w-full h-8 px-3 rounded border focus:outline-none text-xs transition-colors flex-none"
                  style={{
                    backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                  disabled={isPushing || isPushLocked}
                />
              </div>

              {/* Visibility Options */}
              <div className="flex items-center space-x-4 pt-1">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    className="accent-emerald-500"
                    disabled={isPushing || isPushLocked}
                  />
                  <Globe className="w-3.5 h-3.5 opacity-70 flex-none" />
                  <span>Public</span>
                </label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    className="accent-emerald-500"
                    disabled={isPushing || isPushLocked}
                  />
                  <Lock className="w-3.5 h-3.5 opacity-70 flex-none" />
                  <span>Private</span>
                </label>
              </div>
            </div>
          ) : (
            <div
              className="p-3.5 rounded-lg border space-y-3"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.background}60`,
              }}
            >
              <div className="flex items-center space-x-2 font-semibold">
                <GitBranch className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
                <span>Target Branch</span>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="branchMode"
                    checked={branchMode === 'current'}
                    onChange={() => setBranchMode('current')}
                    className="accent-blue-500"
                    disabled={isPushing || isPushLocked}
                  />
                  <span className="truncate">Current branch: <strong>{defaultBranch}</strong></span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="branchMode"
                    checked={branchMode === 'new'}
                    onChange={() => setBranchMode('new')}
                    className="accent-blue-500"
                    disabled={isPushing || isPushLocked}
                  />
                  <span>Create new branch</span>
                </label>

                {branchMode === 'new' && (
                  <div className="pl-6 pt-1">
                    <input
                      type="text"
                      placeholder="feature/branch-name"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="w-full h-8 px-3 rounded border focus:outline-none text-xs transition-colors flex-none"
                      style={{
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                      disabled={isPushing || isPushLocked}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: Commit Message */}
          <div>
            <label className="block text-[10px] opacity-60 uppercase mb-1">
              Commit Message
            </label>
            <textarea
              rows={2}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full px-3 py-2 rounded border focus:outline-none text-xs resize-none transition-colors"
              style={{
                backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                borderColor: palette.surfaceBorder,
                color: palette.text,
              }}
              disabled={isPushing || isPushLocked}
            />
          </div>

          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-2.5 rounded bg-red-950/40 border border-red-500/40 text-red-400 text-[11px] flex items-center space-x-2 flex-none">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {/* Actions Bar: Strictly fixed-width action targets to prevent reflow on label swap */}
          <div
            className="pt-3 border-t flex items-center justify-end space-x-2 flex-none"
            style={{ borderColor: palette.surfaceBorder }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPushing}
              className={`h-8 min-w-[72px] px-3.5 rounded border transition-colors text-xs font-semibold flex items-center justify-center flex-none disabled:opacity-40 btn-tactile ${
                palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
              style={{ borderColor: palette.surfaceBorder, color: palette.text }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isPushing || isPushLocked}
              className="h-8 min-w-[144px] px-4 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all hover:opacity-90 disabled:opacity-40 cursor-pointer flex-none btn-tactile"
              style={{
                backgroundColor: palette.accent,
                color: palette.isDark ? '#09090B' : '#FFFFFF',
              }}
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-none" />
                  <span className="truncate">Pushing Commit...</span>
                </>
              ) : (
                <>
                  <span className="truncate">Confirm & Push</span>
                  <ArrowRight className="w-3.5 h-3.5 flex-none" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GitPushModal;
