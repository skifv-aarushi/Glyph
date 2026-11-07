'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Code2,
  Lock,
  Layers,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'pg_tutorial_dismissed_v1';

interface TourStep {
  id: string;
  badge: string;
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'code-canvas',
    badge: '1/4',
    title: 'Code & Canvas',
    icon: Code2,
    description:
      'Monaco displays source code; Tldraw provides the visual drawing overlay. Press Alt+D to switch to Draw Mode; press Alt+C or Esc to return to Code Mode.',
  },
  {
    id: 'scroll-lock',
    badge: '2/4',
    title: 'Scroll Lock',
    icon: Lock,
    description:
      'Monaco vertical and horizontal scroll coordinates mathematically synchronize with Tldraw camera offsets at 60fps to keep drawings permanently anchored to exact code lines.',
  },
  {
    id: 'session-modes',
    badge: '3/4',
    title: 'Session Modes',
    icon: Layers,
    description:
      'Configure Open Sandbox (full write), Lecture (host broadcast), Whiteboard (open drawings, locked code), or Code Review (line annotation mode) from the top bar.',
  },
  {
    id: 'collaborative-push',
    badge: '4/4',
    title: 'Atomic Git Push',
    icon: GitBranch,
    description:
      'Commits are synchronized and guarded by a distributed Redis mutex to prevent collisions. Export to GitHub as a new repository or push changes to remote branches.',
  },
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const { palette } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const IconComponent = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono text-xs select-none animate-in fade-in duration-150"
    >
      <div
        className="w-[460px] max-w-[95vw] min-h-[220px] rounded-xl border shadow-2xl p-5 flex flex-col justify-between animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-2.5 border-b flex-none"
          style={{ borderColor: palette.surfaceBorder }}
        >
          <div className="flex items-center space-x-2">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase tabular-nums flex-none"
              style={{
                backgroundColor: `${palette.accent}20`,
                color: palette.accent,
              }}
            >
              {step.badge}
            </span>
            <span className="font-semibold text-xs tracking-wide uppercase opacity-70">
              Workspace Overview
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="w-6 h-6 rounded flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            title="Skip Guide (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body - Fixed viewport */}
        <div className="py-3 flex-1 flex flex-col justify-center">
          <div className="flex items-center space-x-2.5 mb-2">
            <div
              className="w-7 h-7 rounded-lg border flex items-center justify-center flex-none"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.accent,
              }}
            >
              <IconComponent className="w-4 h-4 flex-none" />
            </div>
            <h3 id="tutorial-modal-title" className="font-semibold text-sm truncate">
              {step.title}
            </h3>
          </div>
          <p className="text-xs leading-relaxed opacity-80 min-h-[44px]">
            {step.description}
          </p>
        </div>

        {/* Footer - Pinned Navigation */}
        <div
          className="flex items-center justify-between pt-2.5 border-t flex-none"
          style={{ borderColor: palette.surfaceBorder }}
        >
          {/* Progress Indicators */}
          <div className="flex items-center space-x-1.5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className="h-1.5 rounded-full transition-all duration-150 cursor-pointer"
                style={{
                  width: idx === currentStep ? '20px' : '6px',
                  backgroundColor: idx === currentStep ? palette.accent : palette.surfaceBorder,
                }}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="h-8 min-w-[70px] px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
                style={{
                  borderColor: palette.surfaceBorder,
                  color: palette.text,
                }}
              >
                <ArrowLeft className="w-3 h-3 flex-none" />
                <span>Prev</span>
              </button>
            )}

            {!isLast ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="h-8 min-w-[70px] px-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.isDark ? '#09090B' : '#FFFFFF',
                }}
              >
                <span>Next</span>
                <ArrowRight className="w-3 h-3 flex-none" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDismiss}
                className="h-8 min-w-[80px] px-3 rounded-lg font-semibold text-xs flex items-center justify-center gap-1 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.isDark ? '#09090B' : '#FFFFFF',
                }}
              >
                <Check className="w-3 h-3 flex-none" />
                <span>Finish</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
