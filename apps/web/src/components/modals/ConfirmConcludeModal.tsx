'use client';

import React, { useState } from 'react';
import { AlertTriangle, PowerOff, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface ConfirmConcludeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

export const ConfirmConcludeModal: React.FC<ConfirmConcludeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { palette } = useTheme();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    setIsSubmitting(true);
    onConfirm(reason.trim() || undefined);
    onClose();
    setIsSubmitting(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-conclude-title"
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div
        className="w-[420px] max-w-[95vw] rounded-xl border shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
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
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border flex items-center justify-center border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-none" />
            </div>
            <h3 id="confirm-conclude-title" className="font-semibold text-sm truncate">
              Conclude Session
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Warning text */}
        <div className="space-y-2">
          <p className="text-xs leading-relaxed opacity-90">
            Are you sure you want to conclude this collaborative session?
          </p>
          <p className="text-[11px] opacity-60 leading-normal">
            This will disconnect all connected participants, remove the room code from the public index, and terminate real-time synchronization.
          </p>

          <div className="pt-2 space-y-1">
            <label className="block text-[10px] uppercase opacity-70">
              Notice / Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Code review completed"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-8 px-2.5 rounded border text-xs focus:outline-none"
              style={{
                backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                borderColor: palette.surfaceBorder,
                color: palette.text,
              }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t flex-none" style={{ borderColor: palette.surfaceBorder }}>
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-lg border font-medium text-xs transition-opacity hover:opacity-80 cursor-pointer"
            style={{
              borderColor: palette.surfaceBorder,
              color: palette.subtext,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-8 px-3 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer bg-red-600 hover:bg-red-700 text-white"
          >
            <PowerOff className="w-3.5 h-3.5 flex-none" />
            <span>End Session Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

