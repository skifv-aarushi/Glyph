'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PowerOff, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface SessionConcludedModalProps {
  isOpen: boolean;
  concludedBy?: string;
  reason?: string;
  onReturnToLobby?: () => void;
}

export const SessionConcludedModal: React.FC<SessionConcludedModalProps> = ({
  isOpen,
  concludedBy,
  reason,
  onReturnToLobby,
}) => {
  const { palette } = useTheme();
  const router = useRouter();

  if (!isOpen) return null;

  const handleReturn = () => {
    if (onReturnToLobby) {
      onReturnToLobby();
    } else {
      router.push('/');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="concluded-modal-title"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div
        className="w-[440px] max-w-[95vw] rounded-xl border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150 flex flex-col justify-between"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 pb-3 border-b flex-none"
          style={{ borderColor: palette.surfaceBorder }}
        >
          <div
            className="w-7 h-7 rounded-lg border flex items-center justify-center flex-none bg-red-500/10 text-red-400"
            style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <PowerOff className="w-4 h-4 flex-none" />
          </div>
          <div className="min-w-0">
            <h3 id="concluded-modal-title" className="font-semibold text-sm truncate">
              Session Concluded
            </h3>
            <p className="text-[11px] opacity-60 truncate">
              Collaborative room terminated by host
            </p>
          </div>
        </div>

        {/* Content Details */}
        <div className="space-y-3">
          <p className="text-xs leading-relaxed opacity-80">
            This collaborative session has been ended. All active synchronization streams and workspace channels have been closed.
          </p>

          <div
            className="p-3 rounded-lg border space-y-1.5 text-[11px]"
            style={{
              backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
              borderColor: palette.surfaceBorder,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="opacity-60">Terminated By:</span>
              <span className="font-semibold" style={{ color: palette.accent }}>
                {concludedBy || 'Host'}
              </span>
            </div>
            {reason && (
              <div className="flex items-center justify-between">
                <span className="opacity-60">Notice:</span>
                <span className="truncate max-w-[240px]">{reason}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="opacity-60">Status:</span>
              <span className="text-red-400 font-semibold">Disconnected</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex-none">
          <button
            type="button"
            onClick={handleReturn}
            className="w-full h-9 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
            style={{
              backgroundColor: palette.accent,
              color: palette.isDark ? '#09090B' : '#FFFFFF',
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5 flex-none" />
            <span>Return to Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
};

