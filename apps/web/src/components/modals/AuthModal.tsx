'use client';

import React, { useState } from 'react';
import {
  Github,
  KeyRound,
  UserCheck,
  X,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getGitHubLoginUrl, loginWithToken, loginAsGuest } from '../../lib/api';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { palette } = useTheme();
  const [authMode, setAuthMode] = useState<'oauth' | 'pat' | 'guest'>('oauth');
  const [tokenInput, setTokenInput] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleOAuthLogin = () => {
    setIsLoading(true);
    window.location.href = getGitHubLoginUrl();
  };

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMsg('GitHub Personal Access Token required.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await loginWithToken(tokenInput.trim());
      if (res.error || !res.success) {
        setErrorMsg(res.error || 'Token authentication failed.');
      } else {
        setSuccessMsg(`Authenticated as ${res.user?.login || 'User'}`);
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
          window.location.reload();
        }, 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Token verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await loginAsGuest(guestName.trim() || undefined);
      if (res.error || !res.success) {
        setErrorMsg(res.error || 'Guest session initialization failed.');
      } else {
        setSuccessMsg(`Guest session initialized (${res.user?.name || 'Guest'})`);
        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
          window.location.reload();
        }, 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize guest session.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-xl p-6 space-y-4 animate-in zoom-in-95 duration-150 flex flex-col"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Header: Fixed height & stationary elements */}
        <div
          className="h-9 flex items-center justify-between pb-3 border-b flex-none"
          style={{ borderColor: palette.surfaceBorder }}
        >
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
            <h3 id="auth-modal-title" className="font-semibold text-sm truncate">
              Authentication
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center flex-none transition-colors opacity-70 hover:opacity-100 btn-tactile"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Auth Method Selector: Fixed row height with stationary flex-1 leaf nodes */}
        <div
          className="h-9 flex items-center rounded-lg border p-0.5 space-x-1 flex-none"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: `${palette.background}80`,
          }}
        >
          {(['oauth', 'pat', 'guest'] as const).map((mode) => {
            const label = mode === 'oauth' ? 'GitHub OAuth' : mode === 'pat' ? 'Personal Token' : 'Guest';
            const isActive = authMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAuthMode(mode);
                  setErrorMsg('');
                }}
                className={`flex-1 h-7 rounded flex items-center justify-center text-center transition-colors font-medium text-[11px] truncate btn-tactile ${
                  isActive
                    ? palette.isDark ? 'bg-white/15 font-semibold' : 'bg-black/10 font-semibold'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{ color: palette.text }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Error / Success Feedback: Stationary alert boxes */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg border border-red-500/40 bg-red-950/30 text-red-400 text-xs flex items-center space-x-2 flex-none">
            <AlertCircle className="w-4 h-4 flex-none" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-400 text-xs flex items-center space-x-2 flex-none">
            <CheckCircle2 className="w-4 h-4 flex-none" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}

        {/* Stationary Tab Body: Min-height anchor prevents layout jumping between tabs */}
        <div className="min-h-[160px] flex flex-col justify-between pt-1">
          {/* Method 1: GitHub OAuth */}
          {authMode === 'oauth' && (
            <div className="flex flex-col justify-between h-full space-y-4">
              <p className="text-xs opacity-70 leading-relaxed">
                Standard GitHub OAuth authorization with direct repository write access.
              </p>

              <button
                type="button"
                onClick={handleOAuthLogin}
                disabled={isLoading}
                className="w-full h-10 flex-none rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer btn-tactile"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.isDark ? '#09090B' : '#FFFFFF',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin flex-none" />
                    <span className="truncate">Redirecting to GitHub...</span>
                  </>
                ) : (
                  <>
                    <Github className="w-4 h-4 flex-none" />
                    <span className="truncate">Authorize with GitHub</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Method 2: Personal Access Token (PAT) */}
          {authMode === 'pat' && (
            <form onSubmit={handleTokenLogin} className="flex flex-col justify-between h-full space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] opacity-70">
                  GitHub Personal Access Token (<code className="text-[10px]">ghp_...</code>)
                </label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border focus:outline-none text-xs transition-colors flex-none"
                  style={{
                    backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                  autoFocus
                />
                <span className="text-[10px] opacity-50 block truncate">
                  Requires <code>repo</code> scope. Validated server-side over HTTPS.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !tokenInput.trim()}
                className="w-full h-10 flex-none rounded-lg font-semibold text-xs flex items-center justify-center space-x-2 transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer btn-tactile"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.isDark ? '#09090B' : '#FFFFFF',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin flex-none" />
                    <span className="truncate">Verifying Token...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 flex-none" />
                    <span className="truncate">Authenticate with Token</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Method 3: Instant Guest Session */}
          {authMode === 'guest' && (
            <form onSubmit={handleGuestLogin} className="flex flex-col justify-between h-full space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] opacity-70">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Engineer"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border focus:outline-none text-xs transition-colors flex-none"
                  style={{
                    backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                />
                <span className="text-[10px] opacity-50 block truncate">
                  Anonymous session with read, draw, and sandbox execution permissions.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full h-10 flex-none rounded-lg border font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer btn-tactile ${
                  palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
                style={{
                  borderColor: palette.surfaceBorder,
                  color: palette.text,
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin flex-none" />
                    <span className="truncate">Initializing Session...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 flex-none" />
                    <span className="truncate">Enter as Guest</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
