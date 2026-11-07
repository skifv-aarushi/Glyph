'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  GitCommit,
  Loader2,
  LogOut,
  Github,
  Globe,
  Lock,
  Crown,
  Shield,
  HelpCircle,
  Keyboard,
  ChevronDown,
  Users,
  Copy,
  Check,
  Settings,
  Eye,
  EyeOff,
  UserCheck,
  PowerOff,
} from 'lucide-react';
import {
  AuthUser,
  PermissionRole,
  RoomRole,
  SessionMode,
  ConnectedParticipant,
} from '@glyph/shared';
import { useTheme } from '../../context/ThemeContext';
import { AuthModal } from '../modals/AuthModal';
import { ConfirmConcludeModal } from '../modals/ConfirmConcludeModal';
import { ThemeSelector } from './ThemeSelector';

export interface TopBarProps {
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  onLogin?: () => void;
  onLogout: () => void;
  onLoadRepo: (repoSlug: string) => void;
  isLoadingRepo: boolean;
  currentRepoSlug?: string;
  activeFileId?: string | null;
  isPushLocked?: boolean;
  isPushing?: boolean;
  permission?: PermissionRole;
  role?: RoomRole;
  sessionMode?: SessionMode;
  onSetSessionMode?: (mode: SessionMode) => void;
  onPushCommit?: () => void | Promise<void>;
  onOpenSessions?: () => void;
  onOpenShortcuts?: () => void;
  onOpenTutorial?: () => void;
  roomCode?: string;
  isPublic?: boolean;
  hasPassword?: boolean;
  participants?: ConnectedParticipant[];
  onSetUserRole?: (targetUserId: string, newRole: RoomRole) => void;
  onUpdateRoomSettings?: (settings: { isPublic?: boolean; password?: string; mode?: SessionMode }) => void;
  onConcludeSession?: (reason?: string) => void;
  currentUserId?: string;
}

const SESSION_MODES: { id: SessionMode; label: string }[] = [
  { id: 'open-sandbox', label: 'Open Sandbox' },
  { id: 'lecture', label: 'Lecture' },
  { id: 'whiteboard', label: 'Whiteboard' },
  { id: 'code-review', label: 'Code Review' },
];

export const TopBar: React.FC<TopBarProps> = ({
  authUser,
  isAuthenticated,
  isLoadingAuth,
  onLogout,
  onLoadRepo,
  isLoadingRepo,
  currentRepoSlug = '',
  activeFileId = null,
  isPushLocked = false,
  isPushing = false,
  permission = 'read',
  role = 'guest',
  sessionMode = 'open-sandbox',
  onSetSessionMode,
  onPushCommit,
  onOpenSessions,
  onOpenShortcuts,
  onOpenTutorial,
  roomCode,
  isPublic = true,
  hasPassword = false,
  participants = [],
  onSetUserRole,
  onUpdateRoomSettings,
  onConcludeSession,
  currentUserId,
}) => {
  const [repoInput, setRepoInput] = useState(currentRepoSlug || 'demo/starter');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfirmConcludeOpen, setIsConfirmConcludeOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Settings form states
  const [formIsPublic, setFormIsPublic] = useState(isPublic);
  const [formPassword, setFormPassword] = useState('');

  const modeMenuRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { palette } = useTheme();

  useEffect(() => {
    if (currentRepoSlug) {
      setRepoInput(currentRepoSlug);
    }
  }, [currentRepoSlug]);

  useEffect(() => {
    setFormIsPublic(isPublic);
  }, [isPublic]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeMenuOpen(false);
      }
      if (participantsRef.current && !participantsRef.current.contains(e.target as Node)) {
        setIsParticipantsOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isModeMenuOpen || isParticipantsOpen || isSettingsOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isModeMenuOpen, isParticipantsOpen, isSettingsOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput.trim()) {
      onLoadRepo(repoInput.trim());
    }
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateRoomSettings) {
      onUpdateRoomSettings({
        isPublic: formIsPublic,
        password: formPassword.trim() || undefined,
      });
    }
    setIsSettingsOpen(false);
  };

  const isCollaborator = permission === 'write';
  const isLockedOrPushing = isPushLocked || isPushing;
  const isHost = role === 'host';
  const isHostOrCoHost = role === 'host' || role === 'co-host';

  return (
    <>
      <header
        className="h-14 w-full border-b px-4 flex items-center justify-between gap-3 z-30 select-none font-mono text-xs transition-colors duration-150"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Left Section: Brand & Session Directory Button */}
        <div className="flex items-center gap-2.5 flex-none">
          <Link
            href="/"
            className="flex items-center gap-2 h-8 px-2 rounded-lg transition-all duration-100 ease-out active:scale-[0.98] hover:bg-white/5"
            aria-label="Glyph Workspace"
          >
            <span className="font-bold tracking-tight text-sm whitespace-nowrap">GLYPH</span>
            <span
              className="flex-none h-4 px-1 rounded text-[9px] uppercase font-semibold flex items-center justify-center"
              style={{
                backgroundColor: `${palette.surfaceBorder}40`,
                color: palette.subtext,
              }}
            >
              IDE
            </span>
          </Link>

          {onOpenSessions && (
            <button
              type="button"
              onClick={onOpenSessions}
              className="flex-none h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.text,
              }}
              title="Browse Collaborative Sessions"
            >
              <FolderGit2 className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
              <span className="hidden sm:inline whitespace-nowrap overflow-hidden text-ellipsis">Sessions</span>
            </button>
          )}

          {/* Room Code Badge with Copy */}
          {roomCode && (
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex-none h-8 px-2 rounded-lg border text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.accent}15`,
                color: palette.accent,
              }}
              title="Click to copy Room Code"
            >
              {hasPassword && <Lock className="w-3 h-3 flex-none opacity-80" />}
              <span className="tabular-nums tracking-wider">{roomCode}</span>
              {copiedCode ? (
                <Check className="w-3 h-3 text-emerald-400 flex-none" />
              ) : (
                <Copy className="w-3 h-3 opacity-60 flex-none" />
              )}
            </button>
          )}
        </div>

        {/* Center Section: Repository Input & Commits */}
        <div className="flex-1 max-w-md hidden md:flex items-center gap-2">
          <form onSubmit={handleSubmit} className="relative flex-1">
            <input
              type="text"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              placeholder="owner/repo"
              className="w-full h-8 pl-3 pr-8 rounded-lg border text-xs focus:outline-none transition-colors"
              style={{
                backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                borderColor: palette.surfaceBorder,
                color: palette.text,
              }}
            />
            {isLoadingRepo && (
              <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-2.5 animate-spin opacity-50" />
            )}
          </form>

          {isCollaborator && onPushCommit && (
            <button
              type="button"
              onClick={onPushCommit}
              disabled={isLockedOrPushing}
              className="flex-none h-8 min-w-[144px] px-3.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-100 ease-out active:scale-[0.98] disabled:opacity-40 cursor-pointer shadow-sm"
              style={{
                backgroundColor: isPushLocked ? '#F59E0B' : palette.accent,
                color: palette.isDark ? '#09090B' : '#FFFFFF',
              }}
              title="Push Commit"
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-none" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">Pushing...</span>
                </>
              ) : isPushLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 flex-none" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">Locked (Mutex)</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-3.5 h-3.5 flex-none" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">Push to GitHub</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Section: Roster, Settings, Role, Mode, Themes, Auth */}
        <div className="flex items-center gap-2 flex-none">
          {/* Live Participants Roster Dropdown */}
          <div ref={participantsRef} className="relative flex-none">
            <button
              type="button"
              onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
              className="flex-none h-8 px-2.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.text,
              }}
              title="Participants & Roles"
            >
              <Users className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
              <span className="font-mono tabular-nums font-semibold">
                {participants.length > 0 ? participants.length : 1}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60 flex-none" />
            </button>

            {isParticipantsOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border p-2 z-50 backdrop-blur-md shadow-xl font-mono text-xs select-none space-y-2 animate-in fade-in zoom-in-95 duration-100"
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.surfaceBorder,
                  color: palette.text,
                }}
              >
                <div
                  className="flex items-center justify-between pb-1.5 border-b text-[11px] font-semibold"
                  style={{ borderColor: palette.surfaceBorder }}
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" style={{ color: palette.accent }} />
                    <span>Session Participants</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono tabular-nums">
                    {participants.length} connected
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
                  {(participants.length > 0
                    ? participants
                    : [
                        {
                          userId: currentUserId || 'you',
                          username: authUser?.login || 'You',
                          role,
                          connectionTimestamp: Date.now(),
                        },
                      ]
                  ).map((p) => {
                    const isSelf = p.userId === currentUserId || p.username === authUser?.login;
                    return (
                      <div
                        key={p.userId}
                        className="p-1.5 rounded-lg border flex items-center justify-between gap-2"
                        style={{
                          borderColor: palette.surfaceBorder,
                          backgroundColor: `${palette.surfaceBorder}10`,
                        }}
                      >
                        <div className="min-w-0 flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                            style={{
                              backgroundColor: `${palette.accent}20`,
                              color: palette.accent,
                            }}
                          >
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs truncate font-medium">
                            {p.username} {isSelf && <span className="opacity-50">(you)</span>}
                          </span>
                        </div>

                        {/* Host controls role modification for other users */}
                        {isHost && onSetUserRole ? (
                          <select
                            value={p.role}
                            onChange={(e) => onSetUserRole(p.userId, e.target.value as RoomRole)}
                            className="h-6 px-1.5 rounded text-[10px] border font-mono focus:outline-none cursor-pointer flex-none capitalize"
                            style={{
                              backgroundColor: palette.surface,
                              borderColor: palette.surfaceBorder,
                              color: palette.text,
                            }}
                          >
                            <option value="host">Host</option>
                            <option value="co-host">Co-Host</option>
                            <option value="guest">Guest</option>
                            <option value="spectator">Spectator</option>
                          </select>
                        ) : (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold flex-none"
                            style={{
                              borderColor: palette.surfaceBorder,
                              color:
                                p.role === 'host'
                                  ? palette.accent
                                  : p.role === 'co-host'
                                  ? '#818CF8'
                                  : palette.subtext,
                            }}
                          >
                            {p.role}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Session Settings Trigger for Host */}
          {isHostOrCoHost && onUpdateRoomSettings && (
            <div ref={settingsRef} className="relative flex-none">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="flex-none h-8 w-8 rounded-lg border text-xs flex items-center justify-center transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
                style={{
                  borderColor: palette.surfaceBorder,
                  backgroundColor: `${palette.surfaceBorder}20`,
                  color: palette.text,
                }}
                title="Session Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {isSettingsOpen && (
                <form
                  onSubmit={handleSaveSettings}
                  className="absolute right-0 top-full mt-1.5 w-72 rounded-xl border p-3.5 z-50 backdrop-blur-md shadow-xl font-mono text-xs select-none space-y-3 animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 border-b font-semibold"
                    style={{ borderColor: palette.surfaceBorder }}
                  >
                    <span>Session Configuration</span>
                    {hasPassword && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                  </div>

                  {/* Visibility Setting */}
                  <div className="space-y-1">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPublic}
                        onChange={(e) => setFormIsPublic(e.target.checked)}
                        className="rounded accent-emerald-500"
                      />
                      <span className="font-semibold text-xs">Show in Public Directory</span>
                    </label>
                    <p className="text-[10px] opacity-60 leading-tight">
                      When uncheck, session is private and can only be joined via room code or direct link.
                    </p>
                  </div>

                  {/* Passcode Setting */}
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase opacity-70">
                      Session Passcode (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="Leave blank for no password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full h-8 px-2.5 rounded border text-xs focus:outline-none"
                      style={{
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full h-8 rounded-lg font-semibold text-xs flex items-center justify-center transition-opacity hover:opacity-90 cursor-pointer"
                    style={{
                      backgroundColor: palette.accent,
                      color: palette.isDark ? '#09090B' : '#FFFFFF',
                    }}
                  >
                    Apply Session Settings
                  </button>

                  {/* Host Action: Conclude / End Session */}
                  {onConcludeSession && (
                    <div
                      className="pt-2 border-t space-y-1"
                      style={{ borderColor: palette.surfaceBorder }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          setIsConfirmConcludeOpen(true);
                        }}
                        className="w-full h-8 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                      >
                        <PowerOff className="w-3.5 h-3.5 flex-none" />
                        <span>Conclude Session</span>
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}

          {/* Granular Role Badge */}
          <div
            className="hidden lg:flex items-center justify-center gap-1.5 flex-none h-8 min-w-[80px] px-2.5 rounded-lg border text-[11px] font-mono tabular-nums select-none"
            style={{
              borderColor: palette.surfaceBorder,
              backgroundColor: `${palette.surfaceBorder}20`,
            }}
          >
            {role === 'host' ? (
              <span className="flex items-center gap-1 font-semibold" style={{ color: palette.accent }}>
                <Crown className="w-3 h-3 flex-none" />
                <span>Host</span>
              </span>
            ) : role === 'co-host' ? (
              <span className="flex items-center gap-1 font-semibold text-indigo-400">
                <Shield className="w-3 h-3 flex-none" />
                <span>Co-Host</span>
              </span>
            ) : role === 'guest' ? (
              <span style={{ color: palette.subtext }}>Guest</span>
            ) : (
              <span className="flex items-center gap-1" style={{ color: palette.subtext }}>
                <Lock className="w-3 h-3 flex-none" />
                <span>Spectator</span>
              </span>
            )}
          </div>

          {/* Session Mode Selector */}
          <div ref={modeMenuRef} className="relative hidden md:block flex-none">
            <button
              type="button"
              onClick={() => {
                if (isHostOrCoHost) {
                  setIsModeMenuOpen(!isModeMenuOpen);
                }
              }}
              disabled={!isHostOrCoHost}
              className={`flex-none w-[130px] h-8 px-2.5 rounded-lg border text-xs flex items-center justify-between gap-1 transition-all duration-100 ease-out active:scale-[0.98] select-none ${
                isHostOrCoHost ? 'cursor-pointer' : 'cursor-default opacity-80'
              }`}
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.text,
              }}
              title="Session Mode"
            >
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                <span className="text-[10px] opacity-60 uppercase flex-none">M:</span>
                <span className="font-semibold truncate whitespace-nowrap overflow-hidden text-ellipsis capitalize" style={{ color: palette.accent }}>
                  {sessionMode.replace(/-/g, ' ')}
                </span>
              </div>
              {isHostOrCoHost && (
                <ChevronDown className="w-3 h-3 opacity-60 flex-none" />
              )}
            </button>

            {isModeMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border p-1 z-50 backdrop-blur-md shadow-lg transition-all duration-150 ease-out font-mono text-xs select-none"
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.surfaceBorder,
                }}
              >
                {SESSION_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      if (onSetSessionMode) onSetSessionMode(mode.id);
                      setIsModeMenuOpen(false);
                    }}
                    className="w-full h-7 px-2 rounded-lg text-left text-xs capitalize transition-all duration-100 ease-out active:scale-[0.98] flex items-center cursor-pointer"
                    style={{
                      backgroundColor: sessionMode === mode.id
                        ? (palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)')
                        : undefined,
                      color: sessionMode === mode.id ? palette.accent : palette.text,
                      fontWeight: sessionMode === mode.id ? 'bold' : 'normal',
                    }}
                  >
                    <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis">{mode.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Theme Selector */}
          <ThemeSelector />

          {/* Shortcuts Modal Trigger */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="flex-none h-8 w-8 rounded-lg border text-xs flex items-center justify-center transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.text,
              }}
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Tutorial Tour Trigger */}
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="flex-none h-8 w-8 rounded-lg border text-xs flex items-center justify-center transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.accent,
              }}
              title="Onboarding Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Authentication Section */}
          {isLoadingAuth ? (
            <div
              className="flex-none h-8 w-8 rounded-lg border flex items-center justify-center"
              style={{ borderColor: palette.surfaceBorder }}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: palette.accent }} />
            </div>
          ) : isAuthenticated && authUser ? (
            <div className="flex items-center gap-1.5 flex-none">
              <div
                className="flex-none h-8 px-2.5 rounded-lg border text-xs flex items-center gap-2 max-w-[120px]"
                style={{
                  borderColor: palette.surfaceBorder,
                  backgroundColor: `${palette.surfaceBorder}20`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={authUser.avatar_url}
                  alt={authUser.login}
                  className="w-4 h-4 rounded-full object-cover flex-none"
                />
                <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis text-[11px]">{authUser.login}</span>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                className="flex-none h-8 w-8 rounded-lg border flex items-center justify-center transition-all duration-100 ease-out active:scale-[0.98] hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                style={{ borderColor: palette.surfaceBorder }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex-none h-8 min-w-[88px] px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.surfaceBorder}20`,
                color: palette.text,
              }}
            >
              <Github className="w-3.5 h-3.5 flex-none" />
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* GitHub Authentication Dialog */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* Host Confirmation Dialog to Conclude Session */}
      <ConfirmConcludeModal
        isOpen={isConfirmConcludeOpen}
        onClose={() => setIsConfirmConcludeOpen(false)}
        onConfirm={(reason) => {
          if (onConcludeSession) {
            onConcludeSession(reason);
          }
        }}
      />
    </>
  );
};

export default TopBar;
