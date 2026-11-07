'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import {
  ArrowUpRight,
  GitBranch,
  Layers,
  Cpu,
  Palette,
  ChevronDown,
  Check,
  Github,
  LogOut,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ThemeId } from '../utils/themes';
import { CleanLandingHub } from '../components/Lobby/CleanLandingHub';
import { AuthModal } from '../components/modals/AuthModal';
import { ProgressiveStatusModal, RoomTransitionStage } from '../components/UI/Skeletons';
import { fetchAuthStatus, logoutUser } from '../lib/api';
import { AuthUser } from '@glyph/shared';
import { saveLocalWorkspace } from '../utils/localWorkspaceStore';

const ENTER_ANIMATION_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.02,
    },
  },
};

const ENTER_ANIMATION_ITEM: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

export default function LandingPage() {
  const router = useRouter();
  const { theme, setTheme, palette, allPalettes } = useTheme();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [transitionStage, setTransitionStage] = useState<RoomTransitionStage>('idle');

  useEffect(() => {
    fetchAuthStatus().then((res) => {
      setIsAuthenticated(res.authenticated);
      setAuthUser(res.user);
    });
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setIsAuthenticated(false);
    setAuthUser(null);
  };

  const handleLaunchStudio = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setTransitionStage('verifying-token');
    setTimeout(() => {
      setTransitionStage('fetching-tree');
      setTimeout(() => {
        setTransitionStage('rehydrating-crdt');
        setTimeout(() => {
          setTransitionStage('mounted');
          setTimeout(() => {
            router.push('/editor');
          }, 200);
        }, 250);
      }, 250);
    }, 250);
  };

  const handleJoinSession = (roomId: string, _repoSlug?: string, password?: string) => {
    const pwdParam = password ? `?pwd=${encodeURIComponent(password)}` : '';
    router.push(`/room/${encodeURIComponent(roomId)}${pwdParam}`);
  };

  const handleImportRepo = (
    repoSlug: string,
    branch = 'main',
    options?: { isPublic?: boolean; password?: string }
  ) => {
    const pwdParam = options?.password ? `&pwd=${encodeURIComponent(options.password)}` : '';
    const pubParam = options?.isPublic === false ? '&public=false' : '';
    router.push(
      `/editor?repo=${encodeURIComponent(repoSlug)}&branch=${encodeURIComponent(branch)}${pwdParam}${pubParam}`
    );
  };

  const handleCreateScratch = (
    name: string,
    options?: { isPublic?: boolean; password?: string }
  ) => {
    const pwdParam = options?.password ? `&pwd=${encodeURIComponent(options.password)}` : '';
    const pubParam = options?.isPublic === false ? '&public=false' : '';
    router.push(`/editor?scratch=${encodeURIComponent(name)}${pwdParam}${pubParam}`);
  };

  const handleUploadLocalFolder = async (
    folderName: string,
    files: { path: string; content: string }[],
    options?: { isPublic?: boolean; password?: string }
  ) => {
    await saveLocalWorkspace({ folderName, files, options });

    const pwdParam = options?.password ? `&pwd=${encodeURIComponent(options.password)}` : '';
    const pubParam = options?.isPublic === false ? '&public=false' : '';
    router.push(`/editor?local=${encodeURIComponent(folderName)}${pwdParam}${pubParam}`);
  };

  const darkThemes = Object.values(allPalettes).filter(
    (p, idx, arr) => p.isDark && arr.findIndex((x) => x.name === p.name) === idx
  );
  const lightThemes = Object.values(allPalettes).filter(
    (p, idx, arr) => !p.isDark && arr.findIndex((x) => x.name === p.name) === idx
  );

  return (
    <div
      className="min-h-screen w-full font-mono select-none"
      style={{
        backgroundColor: palette.background,
        color: palette.text,
      }}
    >
      <header
        className="sticky top-0 z-50 w-full h-14 border-b backdrop-blur-md"
        style={{
          backgroundColor: `${palette.background}E6`,
          borderColor: palette.surfaceBorder,
        }}
      >
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-none">
            <Link
              href="/"
              className="flex items-center gap-2.5 flex-none h-8"
              aria-label="Glyph Workspace"
            >
              <span className="font-bold tracking-tight text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                GLYPH
              </span>
              <span
                className="flex-none h-5 px-2 rounded border text-[10px] uppercase font-semibold flex items-center justify-center whitespace-nowrap"
                style={{
                  backgroundColor: `${palette.surfaceBorder}40`,
                  borderColor: palette.surfaceBorder,
                  color: palette.subtext,
                }}
              >
                v1.0.0
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs flex-none">
            <a
              href="#sessions"
              className="h-8 flex items-center px-1 text-xs opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: palette.text }}
            >
              // 01. SESSIONS
            </a>
            <a
              href="#architecture"
              className="h-8 flex items-center px-1 text-xs opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: palette.text }}
            >
              // 02. ARCHITECTURE
            </a>
            <a
              href="#runtime"
              className="h-8 flex items-center px-1 text-xs opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: palette.text }}
            >
              // 03. RUNTIME
            </a>
          </nav>

          <div className="flex items-center gap-3 flex-none">
            <div className="relative flex-none">
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex-none h-9 min-w-[130px] px-3.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
                style={{
                  borderColor: palette.surfaceBorder,
                  backgroundColor: palette.surface,
                  color: palette.text,
                }}
                title="Select Theme"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Palette className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
                  <span className="text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {palette.name}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 flex-none opacity-60" />
              </button>

              {isThemeMenuOpen && (
                <div
                  className="absolute right-0 top-11 w-52 rounded-xl border shadow-2xl z-50 p-1.5 space-y-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.surfaceBorder,
                  }}
                >
                  <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider opacity-50">
                    Dark Themes
                  </div>
                  {darkThemes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTheme(p.id as ThemeId);
                        setIsThemeMenuOpen(false);
                      }}
                      className="w-full h-8 px-2.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: theme === p.id ? (palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)') : undefined,
                        color: palette.text,
                        fontWeight: theme === p.id ? 'bold' : 'normal',
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/30 flex-none"
                          style={{ backgroundColor: p.background }}
                        />
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</span>
                      </div>
                      {theme === p.id && <Check className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />}
                    </button>
                  ))}

                  <div className="px-2 py-1 pt-2 text-[10px] uppercase font-bold tracking-wider opacity-50 border-t" style={{ borderColor: palette.surfaceBorder }}>
                    Light Themes
                  </div>
                  {lightThemes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTheme(p.id as ThemeId);
                        setIsThemeMenuOpen(false);
                      }}
                      className="w-full h-8 px-2.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: theme === p.id ? (palette.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)') : undefined,
                        color: palette.text,
                        fontWeight: theme === p.id ? 'bold' : 'normal',
                      }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/30 flex-none"
                          style={{ backgroundColor: p.background }}
                        />
                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</span>
                      </div>
                      {theme === p.id && <Check className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isAuthenticated && authUser ? (
              <div className="flex items-center gap-1.5 flex-none">
                <div
                  className="flex-none h-9 px-3 rounded-lg border text-xs flex items-center gap-2"
                  style={{
                    borderColor: palette.surfaceBorder,
                    backgroundColor: palette.surface,
                    color: palette.text,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={authUser.avatar_url}
                    alt={authUser.login}
                    className="w-4 h-4 rounded-full object-cover flex-none"
                  />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[90px]">{authUser.login}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign Out"
                  className="flex-none h-9 w-9 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
                  style={{ borderColor: palette.surfaceBorder }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex-none h-9 min-w-[100px] px-3.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                style={{
                  borderColor: palette.surfaceBorder,
                  backgroundColor: palette.surface,
                  color: palette.text,
                }}
              >
                <Github className="w-3.5 h-3.5 flex-none" />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">Sign In</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLaunchStudio}
              className="flex-none h-9 min-w-[140px] px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
              style={{
                backgroundColor: palette.accent,
                color: palette.isDark ? '#09090B' : '#FFFFFF',
              }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">Launch Studio</span>
              <ArrowUpRight className="w-3.5 h-3.5 flex-none" />
            </button>
          </div>
        </div>
      </header>

      <motion.section
        variants={ENTER_ANIMATION_CONTAINER}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-6 pt-12 pb-8 flex flex-col gap-4"
      >
        <motion.div variants={ENTER_ANIMATION_ITEM} className="flex flex-col gap-4 max-w-3xl">
          <div
            className="flex-none inline-flex items-center gap-2 h-7 px-3 rounded-full border text-[11px] self-start"
            style={{
              backgroundColor: `${palette.surfaceBorder}20`,
              borderColor: palette.surfaceBorder,
              color: palette.subtext,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse flex-none"
              style={{ backgroundColor: palette.accent }}
            />
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
              SPATIAL CODE COLLABORATION // AST MULTI-LAYER RUNTIME
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight"
            style={{ color: palette.text }}
          >
            Spatial Code Collaboration.
          </h1>

          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: palette.subtext }}
          >
            Interactive code review with mathematically synchronized visual canvas layers.
            Mount remote GitHub repositories statelessly, execute in-browser scratchpads, or join real-time CRDT sessions.
          </p>
        </motion.div>
      </motion.section>

      <motion.section
        id="sessions"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
        className="max-w-7xl mx-auto px-6 pb-20"
      >
        <div
          className="p-1.5 sm:p-4 rounded-3xl border shadow-2xl transition-colors"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: `${palette.surface}30`,
          }}
        >
          <CleanLandingHub
            onJoinSession={handleJoinSession}
            onImportRepo={handleImportRepo}
            onCreateScratch={handleCreateScratch}
            onUploadLocalFolder={handleUploadLocalFolder}
          />
        </div>
      </motion.section>

      <section
        id="architecture"
        className="max-w-7xl mx-auto px-6 py-16 border-t flex flex-col gap-8"
        style={{ borderColor: palette.surfaceBorder }}
      >
        <div className="flex flex-col gap-2 max-w-2xl">
          <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: palette.accent }}>
            // 02. ARCHITECTURE SPECIFICATION
          </span>
          <h2 className="text-2xl font-semibold tracking-tight" style={{ color: palette.text }}>
            Stateless VCS, Distributed Mutex, and 60fps Viewport Synchronization.
          </h2>
          <p className="text-xs leading-relaxed" style={{ color: palette.subtext }}>
            Built on a zero-overhead infrastructure: Next.js edge client, Express binary WebSocket relay,
            Upstash Redis distributed locks, and Supabase CRDT state persistence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className="p-5 rounded-2xl border flex flex-col justify-between gap-6"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
            }}
          >
            <div className="flex flex-col gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center border flex-none"
                style={{
                  backgroundColor: `${palette.accent}15`,
                  borderColor: `${palette.accent}30`,
                  color: palette.accent,
                }}
              >
                <GitBranch className="w-4 h-4 flex-none" />
              </div>
              <h3 className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                Stateless Git Push & Mutex
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: palette.subtext }}>
                Zero filesystem disk clones. Commits assemble statelessly through GitHub REST API v3 tree manifests.
                A Redis Mutex lock prevents concurrent tree collisions.
              </p>
            </div>
            <div
              className="pt-3 border-t text-[10px] flex items-center justify-between gap-2 opacity-60 flex-none"
              style={{ borderColor: palette.surfaceBorder }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">Concurrency Lock</span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">15s Auto-TTL</span>
            </div>
          </div>

          <div
            className="p-5 rounded-2xl border flex flex-col justify-between gap-6"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
            }}
          >
            <div className="flex flex-col gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center border flex-none"
                style={{
                  backgroundColor: `${palette.accent}15`,
                  borderColor: `${palette.accent}30`,
                  color: palette.accent,
                }}
              >
                <Layers className="w-4 h-4 flex-none" />
              </div>
              <h3 className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                Synchronized Coordinate Matrix
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: palette.subtext }}>
                Directly maps Monaco editor virtualized DOM scroll events to TLDraw 2D camera viewport translations
                in real-time without animation phase lag or frame-budget stutter.
              </p>
            </div>
            <div
              className="pt-3 border-t text-[10px] flex items-center justify-between gap-2 opacity-60 flex-none"
              style={{ borderColor: palette.surfaceBorder }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">Frame Budget</span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">16.6ms / 60fps</span>
            </div>
          </div>

          <div
            className="p-5 rounded-2xl border flex flex-col justify-between gap-6"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
            }}
          >
            <div className="flex flex-col gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center border flex-none"
                style={{
                  backgroundColor: `${palette.accent}15`,
                  borderColor: `${palette.accent}30`,
                  color: palette.accent,
                }}
              >
                <Cpu className="w-4 h-4 flex-none" />
              </div>
              <h3 className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                Isolated In-Browser Execution
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: palette.subtext }}>
                Instant TypeScript and JSX transpilation powered by Sucrase in ~1ms with CommonJS and DOM shims,
                with failover to 20+ cloud compilers for multi-language execution.
              </p>
            </div>
            <div
              className="pt-3 border-t text-[10px] flex items-center justify-between gap-2 opacity-60 flex-none"
              style={{ borderColor: palette.surfaceBorder }}
            >
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">Runtime Engine</span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">Client Worker + Cloud</span>
            </div>
          </div>
        </div>
      </section>

      <footer
        id="runtime"
        className="border-t py-10 px-6"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: palette.surface,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 flex-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-none" />
            <span className="whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: palette.subtext }}>
              ALL SYSTEMS OPERATIONAL // REAL-TIME CRDT RELAY
            </span>
          </div>

          <div className="flex items-center gap-6 text-[11px] flex-none" style={{ color: palette.subtext }}>
            <Link
              href="/editor"
              className="h-7 flex items-center opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: palette.text }}
            >
              Open Studio
            </Link>
            <a
              href="https://github.com/glyph/studio"
              target="_blank"
              rel="noreferrer"
              className="h-7 flex items-center opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
              style={{ color: palette.text }}
            >
              GitHub Repository
            </a>
            <span className="whitespace-nowrap">Glyph Studio © 2026</span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          fetchAuthStatus().then((res) => {
            setIsAuthenticated(res.authenticated);
            setAuthUser(res.user);
          });
        }}
      />

      <ProgressiveStatusModal currentStage={transitionStage} />
    </div>
  );
}
