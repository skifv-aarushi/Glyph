'use client';

import React, { useState } from 'react';
import { Lock, X, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface RoomPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPassword: (password: string) => void;
  roomName?: string;
  errorMessage?: string | null;
}

export const RoomPasswordModal: React.FC<RoomPasswordModalProps> = ({
  isOpen,
  onClose,
  onSubmitPassword,
  roomName,
  errorMessage,
}) => {
  const { palette } = useTheme();
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onSubmitPassword(password.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-sm rounded-xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-3 border-b flex-none"
          style={{ borderColor: palette.surfaceBorder }}
        >
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-amber-400 flex-none" />
            <h3 id="pwd-modal-title" className="font-semibold text-sm truncate">
              Protected Session
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-white/10 flex items-center justify-center flex-none text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] opacity-70 leading-relaxed">
          {roomName ? (
            <>
              Session <strong>{roomName}</strong> requires a passcode.
            </>
          ) : (
            'This session is protected. Enter the passcode to join.'
          )}
        </p>

        {errorMessage && (
          <div className="p-2.5 rounded bg-red-950/40 border border-red-500/40 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] opacity-60 uppercase mb-1">
              Passcode
            </label>
            <input
              type="password"
              placeholder="Enter passcode..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 px-3 rounded border focus:outline-none text-xs transition-colors"
              style={{
                backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                borderColor: palette.surfaceBorder,
                color: palette.text,
              }}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded border text-xs font-semibold hover:bg-white/10 transition-colors"
              style={{ borderColor: palette.surfaceBorder, color: palette.text }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password.trim()}
              className="h-8 min-w-[96px] px-3.5 rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
              style={{
                backgroundColor: palette.accent,
                color: palette.isDark ? '#09090B' : '#FFFFFF',
              }}
            >
              <KeyRound className="w-3.5 h-3.5 flex-none" />
              <span>Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoomPasswordModal;

