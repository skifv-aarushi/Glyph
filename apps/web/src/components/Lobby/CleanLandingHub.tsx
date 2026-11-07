'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2,
  Users,
  Plus,
  ArrowRight,
  Search,
  RefreshCw,
  Upload,
  GitBranch,
  Code2,
  Lock,
  Globe,
  KeyRound,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  Layers,
} from 'lucide-react';
import { fetchActiveRooms, ActiveRoomSummary } from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { CardSkeleton, ProgressiveStatusModal, RoomTransitionStage } from '../UI/Skeletons';
import { RoomPasswordModal } from '../modals/RoomPasswordModal';
import { saveLocalWorkspace } from '../../utils/localWorkspaceStore';

export interface CleanLandingHubProps {
  onJoinSession: (roomId: string, repoSlug?: string, password?: string) => void;
  onImportRepo: (
    repoSlug: string,
    branch?: string,
    options?: { isPublic?: boolean; password?: string }
  ) => void;
  onCreateScratch: (
    name: string,
    options?: { isPublic?: boolean; password?: string }
  ) => void;
  onUploadLocalFolder?: (
    folderName: string,
    files: { path: string; content: string }[],
    options?: { isPublic?: boolean; password?: string }
  ) => void;
  onDropLocalFiles?: (files: FileList) => void;
}

export const CleanLandingHub: React.FC<CleanLandingHubProps> = ({
  onJoinSession,
  onImportRepo,
  onCreateScratch,
  onUploadLocalFolder,
  onDropLocalFiles,
}) => {
  const { palette } = useTheme();

  // Active rooms state
  const [activeRooms, setActiveRooms] = useState<ActiveRoomSummary[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Form states (Card 1)
  const [createMode, setCreateMode] = useState<'github' | 'scratch' | 'local'>('github');
  const [repoInput, setRepoInput] = useState('');
  const [branchInput, setBranchInput] = useState('main');
  const [scratchName, setScratchName] = useState('scratch-workspace');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  // Session Settings for created rooms
  const [sessionIsPublic, setSessionIsPublic] = useState(true);
  const [sessionPassword, setSessionPassword] = useState('');
  const [showSessionOptions, setShowSessionOptions] = useState(false);

  // Local uploaded files state
  const [uploadedFolderName, setUploadedFolderName] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<{ path: string; content: string }[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isProjectMounted, setIsProjectMounted] = useState(false);
  const [isMounting, setIsMounting] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Direct Join by Code / Password State (Card 2)
  const [codeJoinInput, setCodeJoinInput] = useState('');
  const [isResolvingCode, setIsResolvingCode] = useState(false);
  const [codeJoinError, setCodeJoinError] = useState<string | null>(null);

  // Password Modal state for joining password-protected rooms
  const [pendingPasswordRoom, setPendingPasswordRoom] = useState<{
    roomId: string;
    name?: string;
  } | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Progressive Loading Modal state
  const [transitionStage, setTransitionStage] = useState<RoomTransitionStage>('idle');

  const loadRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const rooms = await fetchActiveRooms();
      setActiveRooms(rooms);
    } catch {
      setActiveRooms([]);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 15000);
    return () => clearInterval(interval);
  }, []);

  const triggerProgressiveTransition = (onFinish: () => void) => {
    setTransitionStage('verifying-token');
    setTimeout(() => {
      setTransitionStage('fetching-tree');
      setTimeout(() => {
        setTransitionStage('rehydrating-crdt');
        setTimeout(() => {
          setTransitionStage('mounted');
          setTimeout(() => {
            setTransitionStage('idle');
            onFinish();
          }, 250);
        }, 350);
      }, 350);
    }, 350);
  };

  const handleGitHubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) return;
    const cleanRepo = repoInput
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '');
    const cleanBranch = branchInput.trim() || 'main';

    triggerProgressiveTransition(() => {
      onImportRepo(cleanRepo, cleanBranch, {
        isPublic: sessionIsPublic,
        password: sessionPassword.trim() || undefined,
      });
    });
  };

  const handleScratchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = scratchName.trim() || 'scratch-workspace';
    triggerProgressiveTransition(() => {
      onCreateScratch(name, {
        isPublic: sessionIsPublic,
        password: sessionPassword.trim() || undefined,
      });
    });
  };

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svgz',
  'exe', 'dll', 'so', 'dylib', 'o', 'obj', 'a', 'lib', 'bin', 'out',
  'zip', 'tar', 'gz', '7z', 'rar', 'pdf', 'wasm', 'pyc', 'class',
  'mp3', 'mp4', 'wav', 'mov', 'avi'
]);

const IGNORE_PATTERNS = [
  'node_modules/',
  '.git/',
  '.next/',
  '.turbo/',
  '__pycache__/',
  '.vscode/',
  '.idea/'
];

function detectLanguages(files: { path: string }[]): string[] {
  const languages = new Set<string>();
  for (const f of files) {
    const ext = f.path.split('.').pop()?.toLowerCase() || '';
    const base = f.path.split('/').pop()?.toLowerCase() || '';
    if (ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'hpp' || ext === 'hh' || ext === 'hxx' || ext === 'inl') {
      languages.add('C++');
    } else if (ext === 'c' || ext === 'h') {
      languages.add('C');
    } else if (ext === 'ts' || ext === 'tsx') {
      languages.add('TypeScript');
    } else if (ext === 'js' || ext === 'jsx' || ext === 'mjs') {
      languages.add('JavaScript');
    } else if (ext === 'py') {
      languages.add('Python');
    } else if (ext === 'rs') {
      languages.add('Rust');
    } else if (ext === 'go') {
      languages.add('Go');
    } else if (ext === 'java') {
      languages.add('Java');
    } else if (ext === 'cs') {
      languages.add('C#');
    } else if (ext === 'php') {
      languages.add('PHP');
    } else if (ext === 'rb') {
      languages.add('Ruby');
    } else if (ext === 'swift') {
      languages.add('Swift');
    } else if (ext === 'kt') {
      languages.add('Kotlin');
    } else if (base === 'cmakelists.txt' || ext === 'cmake') {
      languages.add('CMake');
    } else if (base === 'makefile' || ext === 'mk') {
      languages.add('Makefile');
    }
  }
  return Array.from(languages);
}

async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<{ path: string; file: File }[]> {
  const result: { path: string; file: File }[] = [];
  const items = dataTransfer.items;

  const traverseEntry = async (entry: any, curPath: string): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            result.push({ path: curPath ? `${curPath}/${file.name}` : file.name, file });
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const readBatch = async (): Promise<any[]> => {
        return new Promise((resolve) => {
          reader.readEntries(
            (entries: any[]) => resolve(entries || []),
            () => resolve([])
          );
        });
      };

      const nextDirPath = curPath ? `${curPath}/${entry.name}` : entry.name;
      let batch: any[];
      do {
        batch = await readBatch();
        for (const child of batch) {
          await traverseEntry(child, nextDirPath);
        }
      } while (batch.length > 0);
    }
  };

  if (items && items.length > 0) {
    const rootEntries: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          rootEntries.push(entry);
        } else {
          const file = item.getAsFile();
          if (file) result.push({ path: file.name, file });
        }
      }
    }

    if (rootEntries.length > 0) {
      for (const entry of rootEntries) {
        await traverseEntry(entry, '');
      }
      return result;
    }
  }

  // Fallback to dataTransfer.files
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const f = dataTransfer.files[i];
    result.push({ path: (f as any).webkitRelativePath || f.name, file: f });
  }
  return result;
}

  const processFileEntries = async (entries: { path: string; file: File }[]) => {
    setIsReadingFiles(true);
    setIsProjectMounted(false);
    try {
      // Find common root folder prefix if present
      let detectedRoot = '';
      for (const item of entries) {
        const normalized = item.path.replace(/\\/g, '/');
        if (normalized.includes('/')) {
          const first = normalized.split('/')[0];
          if (!detectedRoot) detectedRoot = first;
          else if (detectedRoot !== first) {
            detectedRoot = '';
            break;
          }
        }
      }

      const readPromises: Promise<{ path: string; content: string } | null>[] = [];

      for (const item of entries) {
        const relPath = item.path.replace(/\\/g, '/');
        const ext = relPath.split('.').pop()?.toLowerCase() || '';

        // Filter binary artifacts and ignore directories
        if (
          BINARY_EXTENSIONS.has(ext) ||
          IGNORE_PATTERNS.some((p) => relPath.includes(p)) ||
          item.file.size > 10 * 1024 * 1024 // 10MB limit
        ) {
          continue;
        }

        const cleanRelPath =
          detectedRoot && relPath.startsWith(`${detectedRoot}/`)
            ? relPath.slice(detectedRoot.length + 1)
            : relPath;

        readPromises.push(
          item.file.text().then(
            (content) => ({
              path: cleanRelPath,
              content,
            }),
            () => null
          )
        );
      }

      const results = await Promise.all(readPromises);
      const valid = results.filter((r): r is { path: string; content: string } => Boolean(r));
      const folderName = detectedRoot || 'local-workspace';

      setUploadedFolderName(folderName);
      setUploadedFiles(valid);
    } catch (err) {
      console.error('[CleanLandingHub] Error reading local files:', err);
    } finally {
      setIsReadingFiles(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer) {
      if (onDropLocalFiles && e.dataTransfer.files) {
        onDropLocalFiles(e.dataTransfer.files);
      }
      const entries = await extractFilesFromDataTransfer(e.dataTransfer);
      if (entries.length > 0) {
        await processFileEntries(entries);
      }
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (onDropLocalFiles) {
        onDropLocalFiles(e.target.files);
      }
      const entries: { path: string; file: File }[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        entries.push({
          path: (file as any).webkitRelativePath || file.name,
          file,
        });
      }
      await processFileEntries(entries);
    }
  };

  const handleMountLocalFolder = async () => {
    if (uploadedFiles.length === 0) return;
    setIsMounting(true);
    try {
      await saveLocalWorkspace({
        folderName: uploadedFolderName || 'local-workspace',
        files: uploadedFiles,
        options: {
          isPublic: sessionIsPublic,
          password: sessionPassword.trim() || undefined,
        },
      });
      setIsProjectMounted(true);
    } catch (err) {
      console.error('[CleanLandingHub] Error mounting local folder:', err);
    } finally {
      setIsMounting(false);
    }
  };

  const handleLaunchMountedProject = () => {
    if (uploadedFiles.length === 0) return;
    triggerProgressiveTransition(() => {
      if (onUploadLocalFolder) {
        onUploadLocalFolder(uploadedFolderName || 'local-workspace', uploadedFiles, {
          isPublic: sessionIsPublic,
          password: sessionPassword.trim() || undefined,
        });
      } else {
        onCreateScratch(uploadedFolderName || 'local-workspace', {
          isPublic: sessionIsPublic,
          password: sessionPassword.trim() || undefined,
        });
      }
    });
  };

  const handleUnmountProject = () => {
    setIsProjectMounted(false);
    setUploadedFiles([]);
    setUploadedFolderName('');
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  // Join Room by Code or Direct ID
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = codeJoinInput.trim();
    if (!raw) return;
    setIsResolvingCode(true);
    setCodeJoinError(null);

    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';
      const res = await fetch(`${serverUrl}/api/rooms/resolve/${encodeURIComponent(raw)}`);
      const data = await res.json();

      if (data.roomId) {
        if (data.hasPassword) {
          setPendingPasswordRoom({ roomId: data.roomId, name: data.name || data.code || raw });
        } else {
          triggerProgressiveTransition(() => {
            onJoinSession(data.roomId, data.name);
          });
        }
      } else {
        triggerProgressiveTransition(() => {
          onJoinSession(raw);
        });
      }
    } catch {
      triggerProgressiveTransition(() => {
        onJoinSession(raw);
      });
    } finally {
      setIsResolvingCode(false);
    }
  };

  const handlePasswordModalSubmit = async (password: string) => {
    if (!pendingPasswordRoom) return;
    setPasswordError(null);

    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';
      const res = await fetch(`${serverUrl}/api/rooms/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: pendingPasswordRoom.roomId, password }),
      });
      const data = await res.json();
      if (data.valid === false) {
        setPasswordError('Incorrect passcode.');
        return;
      }

      const target = pendingPasswordRoom;
      setPendingPasswordRoom(null);
      triggerProgressiveTransition(() => {
        onJoinSession(target.roomId, target.name, password);
      });
    } catch {
      const target = pendingPasswordRoom;
      setPendingPasswordRoom(null);
      triggerProgressiveTransition(() => {
        onJoinSession(target.roomId, target.name, password);
      });
    }
  };

  const filteredRooms = activeRooms.filter(
    (r) =>
      r.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.hostUsername.toLowerCase().includes(searchFilter.toLowerCase()) ||
      r.roomId.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (r.code && r.code.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 font-mono text-xs select-none">
      {/* Progressive Stage Transition Modal */}
      <ProgressiveStatusModal
        currentStage={transitionStage}
        onCancel={() => setTransitionStage('idle')}
      />

      {/* Password Prompt Modal for Protected Rooms */}
      <RoomPasswordModal
        isOpen={Boolean(pendingPasswordRoom)}
        onClose={() => {
          setPendingPasswordRoom(null);
          setPasswordError(null);
        }}
        onSubmitPassword={handlePasswordModalSubmit}
        roomName={pendingPasswordRoom?.name}
        errorMessage={passwordError}
      />

      {/* Main Two-Card Grid with Micro-Animations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ======================================================== */}
        {/* CARD 1: CREATE / CONNECT REPOSITORY (Span 5)             */}
        {/* ======================================================== */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="lg:col-span-5 p-6 rounded-2xl border flex flex-col justify-between shadow-xl backdrop-blur-md transition-colors duration-200"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.surfaceBorder,
            color: palette.text,
          }}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
                <h3 className="font-semibold text-sm">Spatial Code Collaboration</h3>
              </div>
              <p className="text-[11px] opacity-70 leading-relaxed">
                Connect remote repository, upload a local codebase, or start an empty scratchpad.
              </p>
            </div>

            {/* Sub-Tabs: GitHub / Scratchpad / Local Drop */}
            <div
              className="h-9 flex items-center rounded-xl border p-1 space-x-1 relative flex-none"
              style={{
                borderColor: palette.surfaceBorder,
                backgroundColor: `${palette.background}80`,
              }}
            >
              {(['github', 'scratch', 'local'] as const).map((mode) => {
                const label = mode === 'github' ? 'GitHub Repo' : mode === 'scratch' ? 'Scratchpad' : 'Local Folder';
                const isSelected = createMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCreateMode(mode)}
                    className={`relative flex-1 h-7 rounded-lg text-center flex items-center justify-center transition-colors font-medium text-[11px] z-10 btn-tactile ${
                      isSelected ? 'font-semibold' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      color: isSelected ? (palette.isDark ? '#FFFFFF' : '#09090B') : palette.subtext,
                    }}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeSubTab"
                        className="absolute inset-0 rounded-lg -z-10 shadow-sm border"
                        style={{
                          backgroundColor: palette.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                          borderColor: palette.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Animated Tab Content */}
            <AnimatePresence mode="wait">
              {/* Mode 1: GitHub Repo Import */}
              {createMode === 'github' && (
                <motion.form
                  key="github-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleGitHubSubmit}
                  className="space-y-3 pt-1"
                >
                  <div>
                    <label className="block text-[10px] opacity-60 uppercase mb-1">
                      Repository Identifier / URL
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. vercel/next.js or owner/repo"
                      value={repoInput}
                      onChange={(e) => setRepoInput(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border focus:outline-none text-xs transition-colors flex-none"
                      style={{
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] opacity-60 uppercase mb-1">
                      Branch Identifier
                    </label>
                    <div className="relative">
                      <GitBranch className="w-3.5 h-3.5 absolute left-3 top-3 opacity-50 flex-none" />
                      <input
                        type="text"
                        placeholder="main"
                        value={branchInput}
                        onChange={(e) => setBranchInput(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 rounded-xl border focus:outline-none text-xs transition-colors flex-none"
                        style={{
                          backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                          borderColor: palette.surfaceBorder,
                          color: palette.text,
                        }}
                      />
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!repoInput.trim()}
                    className="w-full h-10 flex-none rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition-all hover:opacity-90 disabled:opacity-40 cursor-pointer shadow-sm btn-tactile"
                    style={{
                      backgroundColor: palette.accent,
                      color: palette.isDark ? '#09090B' : '#FFFFFF',
                    }}
                  >
                    <span className="truncate">Connect to Repository</span>
                    <ArrowRight className="w-3.5 h-3.5 flex-none" />
                  </motion.button>
                </motion.form>
              )}

              {/* Mode 2: Empty Scratchpad Workspace */}
              {createMode === 'scratch' && (
                <motion.form
                  key="scratch-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  onSubmit={handleScratchSubmit}
                  className="space-y-3 pt-1"
                >
                  <div>
                    <label className="block text-[10px] opacity-60 uppercase mb-1">
                      Workspace Identifier
                    </label>
                    <input
                      type="text"
                      placeholder="scratch-workspace"
                      value={scratchName}
                      onChange={(e) => setScratchName(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border focus:outline-none text-xs transition-colors flex-none"
                      style={{
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                    />
                  </div>

                  <div
                    className="p-3 rounded-xl border space-y-1"
                    style={{
                      borderColor: palette.surfaceBorder,
                      backgroundColor: palette.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                    }}
                  >
                    <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wider block">
                      Configuration
                    </span>
                    <p className="text-[11px] opacity-60 leading-relaxed">
                      Instant in-memory synchronization, isolated Web Worker sandbox execution, and multiplayer CRDT relay.
                    </p>
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full h-10 flex-none rounded-xl border font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer btn-tactile ${
                      palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                    }`}
                    style={{
                      borderColor: palette.surfaceBorder,
                      color: palette.text,
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 flex-none" />
                    <span className="truncate">Initialize Scratchpad</span>
                  </motion.button>
                </motion.form>
              )}

              {/* Mode 3: Local Files / Folder Upload */}
              {createMode === 'local' && (
                <motion.div
                  key="local-form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3 pt-1"
                >
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore: standard browser webkitdirectory folder attribute
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={handleFolderInputChange}
                  />

                  {isProjectMounted ? (
                    /* Project Mounted State: Gives the option to launch in Studio right in this spot */
                    <div
                      className="p-4 rounded-xl border space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
                      style={{
                        borderColor: palette.surfaceBorder,
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Mounted Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                            Mounted & Ready
                          </span>
                        </div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded border font-mono"
                          style={{ borderColor: palette.surfaceBorder, color: palette.subtext }}
                        >
                          {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Project Details */}
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
                          <span className="font-semibold text-xs truncate" style={{ color: palette.text }}>
                            {uploadedFolderName}
                          </span>
                        </div>

                        {/* Detected Language Badges (C++, C, CMake, Python, etc.) */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {detectLanguages(uploadedFiles).map((lang) => (
                            <span
                              key={lang}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                              style={{
                                backgroundColor: `${palette.accent}15`,
                                borderColor: `${palette.accent}30`,
                                color: palette.accent,
                              }}
                            >
                              {lang}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* File Preview Snippet */}
                      <div
                        className="max-h-24 overflow-y-auto rounded-lg p-2 text-[10px] font-mono space-y-1 border"
                        style={{
                          borderColor: palette.surfaceBorder,
                          backgroundColor: palette.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)',
                        }}
                      >
                        {uploadedFiles.slice(0, 4).map((f) => (
                          <div key={f.path} className="truncate opacity-75 flex items-center space-x-1.5">
                            <span className="opacity-40">├</span>
                            <span>{f.path}</span>
                          </div>
                        ))}
                        {uploadedFiles.length > 4 && (
                          <div className="opacity-50 italic pl-3">
                            + {uploadedFiles.length - 4} more files...
                          </div>
                        )}
                      </div>

                      {/* Launch Project in Studio Button (In this spot only) */}
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleLaunchMountedProject}
                        className="w-full h-10 flex-none rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition-all hover:opacity-90 cursor-pointer shadow-sm btn-tactile"
                        style={{
                          backgroundColor: palette.accent,
                          color: palette.isDark ? '#09090B' : '#FFFFFF',
                        }}
                      >
                        <Code2 className="w-4 h-4 flex-none" />
                        <span className="truncate">Launch in Studio</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-none" />
                      </motion.button>

                      {/* Secondary Action: Unmount / Choose Another Folder */}
                      <button
                        type="button"
                        onClick={handleUnmountProject}
                        className="w-full text-center text-[11px] opacity-60 hover:opacity-100 transition-opacity py-0.5 flex items-center justify-center space-x-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Unmount / Select Different Folder</span>
                      </button>
                    </div>
                  ) : (
                    /* Initial Unmounted Upload Dropzone State */
                    <>
                      <div
                        onClick={() => folderInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingFiles(true);
                        }}
                        onDragLeave={() => setIsDraggingFiles(false)}
                        onDrop={handleDrop}
                        className={`p-6 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center space-y-2.5 transition-all cursor-pointer ${
                          isDraggingFiles ? 'scale-[1.01]' : ''
                        } ${palette.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
                        style={{
                          borderColor: isDraggingFiles ? palette.accent : palette.surfaceBorder,
                          backgroundColor: isDraggingFiles
                            ? `${palette.accent}15`
                            : palette.isDark
                            ? 'rgba(0,0,0,0.2)'
                            : 'rgba(0,0,0,0.02)',
                        }}
                      >
                        {isReadingFiles ? (
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-400 flex-none" />
                        ) : uploadedFiles.length > 0 ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-none" />
                        ) : (
                          <Upload className="w-6 h-6 opacity-60 flex-none" style={{ color: palette.accent }} />
                        )}

                        <div className="space-y-1">
                          {uploadedFiles.length > 0 ? (
                            <>
                              <span className="font-semibold text-xs block text-emerald-400">
                                Folder Ready: &quot;{uploadedFolderName}&quot;
                              </span>
                              <p className="text-[10px] opacity-60">
                                {uploadedFiles.length} file{uploadedFiles.length === 1 ? '' : 's'} parsed. Click to re-select folder.
                              </p>
                            </>
                          ) : (
                            <>
                              <span className="font-semibold text-xs block">
                                Drop folder or click to browse
                              </span>
                              <p className="text-[10px] opacity-60 max-w-[220px]">
                                Upload C/C++, TypeScript, or any codebase directory into browser memory.
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {uploadedFiles.length > 0 && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleMountLocalFolder}
                          disabled={isMounting}
                          className="w-full h-10 flex-none rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 transition-all hover:opacity-90 cursor-pointer shadow-sm btn-tactile"
                          style={{
                            backgroundColor: palette.accent,
                            color: palette.isDark ? '#09090B' : '#FFFFFF',
                          }}
                        >
                          {isMounting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin flex-none" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5 flex-none" />
                          )}
                          <span className="truncate">
                            {isMounting
                              ? 'Mounting Workspace...'
                              : `Mount Local Workspace (${uploadedFiles.length} files)`}
                          </span>
                        </motion.button>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Session Settings Accordion (Visibility & Passcode) */}
            <div
              className="pt-2 border-t"
              style={{ borderColor: palette.surfaceBorder }}
            >
              <button
                type="button"
                onClick={() => setShowSessionOptions(!showSessionOptions)}
                className="text-[10px] opacity-70 hover:opacity-100 flex items-center justify-between w-full py-1"
              >
                <span className="uppercase tracking-wider font-semibold">
                  Session Settings ({sessionIsPublic ? 'Public' : 'Private'}
                  {sessionPassword ? ', Protected' : ''})
                </span>
                <span>{showSessionOptions ? '−' : '+'}</span>
              </button>

              {showSessionOptions && (
                <div
                  className="p-3 mt-1.5 rounded-xl border space-y-2.5 animate-in fade-in duration-150"
                  style={{
                    borderColor: palette.surfaceBorder,
                    backgroundColor: `${palette.background}40`,
                  }}
                >
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sessionIsPublic}
                      onChange={(e) => setSessionIsPublic(e.target.checked)}
                      className="rounded accent-emerald-500"
                    />
                    <div className="flex items-center space-x-1.5">
                      <Globe className="w-3.5 h-3.5 opacity-70 flex-none" />
                      <span className="text-[11px] font-semibold">Show in Public Directory</span>
                    </div>
                  </label>

                  <div>
                    <label className="block text-[10px] opacity-60 uppercase mb-1">
                      Session Passcode (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="Leave blank for open access..."
                      value={sessionPassword}
                      onChange={(e) => setSessionPassword(e.target.value)}
                      className="w-full h-8 px-2.5 rounded border focus:outline-none text-xs"
                      style={{
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Preset Samples */}
          <div className="pt-3 mt-3 border-t text-[10px] space-y-1.5 flex-none" style={{ borderColor: palette.surfaceBorder }}>
            <span className="opacity-50 uppercase tracking-wider block">Quick Presets</span>
            <div className="flex flex-wrap gap-1.5">
              {['facebook/react', 'vercel/next.js', 'torvalds/linux'].map((slug) => (
                <motion.button
                  key={slug}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setCreateMode('github');
                    setRepoInput(slug);
                    setBranchInput('main');
                  }}
                  className={`h-6 px-2 rounded-md border flex items-center justify-center transition-colors opacity-70 hover:opacity-100 cursor-pointer btn-tactile ${
                    palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                  }`}
                  style={{ borderColor: palette.surfaceBorder }}
                >
                  {slug}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ======================================================== */}
        {/* CARD 2: ACTIVE SESSIONS DIRECTORY (Span 7)               */}
        {/* ======================================================== */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: 'easeOut' }}
          className="lg:col-span-7 p-6 rounded-2xl border flex flex-col justify-between shadow-xl backdrop-blur-md transition-colors duration-200"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.surfaceBorder,
            color: palette.text,
          }}
        >
          <div className="space-y-4">
            {/* Header & Refresh */}
            <div className="flex items-center justify-between flex-none">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 flex-none" style={{ color: palette.accent }} />
                <h3 className="font-semibold text-sm">Active Sessions</h3>
                <span
                  className="text-[10px] font-bold font-mono tabular-nums px-2 py-0.5 rounded-full flex-none"
                  style={{
                    backgroundColor: `${palette.accent}20`,
                    color: palette.accent,
                  }}
                >
                  {activeRooms.length}
                </span>
              </div>

              <motion.button
                type="button"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={loadRooms}
                disabled={isLoadingRooms}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors flex-none btn-tactile ${
                  palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
                style={{ borderColor: palette.surfaceBorder }}
                title="Refresh Active Rooms"
                aria-label="Refresh Active Rooms"
              >
                <RefreshCw className={`w-3.5 h-3.5 flex-none ${isLoadingRooms ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>

            {/* Direct Join by Code / Passcode Bar */}
            <form onSubmit={handleJoinByCode} className="flex items-center gap-2 flex-none">
              <div className="relative flex-1">
                <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-50 flex-none" />
                <input
                  type="text"
                  placeholder="Enter Session Code (e.g. PG-4821 or room ID)..."
                  value={codeJoinInput}
                  onChange={(e) => setCodeJoinInput(e.target.value)}
                  className="w-full h-8 pl-9 pr-3 rounded-xl border text-xs focus:outline-none transition-colors uppercase font-mono"
                  style={{
                    backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!codeJoinInput.trim() || isResolvingCode}
                className="h-8 px-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-40 cursor-pointer flex-none btn-tactile"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.isDark ? '#09090B' : '#FFFFFF',
                }}
              >
                {isResolvingCode ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin flex-none" />
                ) : (
                  <span>Join Code</span>
                )}
              </button>
            </form>

            {codeJoinError && (
              <div className="p-2 rounded bg-red-950/40 border border-red-500/40 text-red-400 text-[11px] flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{codeJoinError}</span>
              </div>
            )}

            {/* Filter Input */}
            <div className="relative flex-none">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-50 flex-none" />
              <input
                type="text"
                placeholder="Filter by repository, host, or code..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-8 pl-9 pr-3 rounded-xl border text-xs focus:outline-none transition-colors"
                style={{
                  backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
                  borderColor: palette.surfaceBorder,
                  color: palette.text,
                }}
              />
            </div>

            {/* Room List with Staggered Entrance */}
            {isLoadingRooms ? (
              <CardSkeleton count={4} />
            ) : filteredRooms.length === 0 ? (
              <div
                className="py-12 rounded-xl border text-center space-y-3 p-6"
                style={{
                  borderColor: palette.surfaceBorder,
                  backgroundColor: `${palette.background}40`,
                }}
              >
                <FolderGit2 className="w-8 h-8 mx-auto opacity-30 flex-none" />
                <p className="text-xs opacity-70">No active rooms match filter.</p>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCreateMode('scratch');
                    setScratchName('new-collaborative-session');
                  }}
                  className="h-8 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center space-x-1.5 flex-none btn-tactile"
                  style={{
                    backgroundColor: palette.accent,
                    color: palette.isDark ? '#09090B' : '#FFFFFF',
                  }}
                >
                  <Plus className="w-3.5 h-3.5 flex-none" />
                  <span className="truncate">Create Session</span>
                </motion.button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredRooms.map((room) => {
                  const modeTag = (room.mode || 'SANDBOX').replace(/_/g, ' ');

                  return (
                    <motion.div
                      key={room.roomId}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all shadow-sm ${
                        palette.isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                      }`}
                      style={{
                        borderColor: palette.surfaceBorder,
                        backgroundColor: `${palette.background}60`,
                      }}
                    >
                      <div className="space-y-1.5 min-w-0 pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-xs truncate">
                            {room.name}
                          </span>
                          <span
                            className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md border font-semibold flex-none"
                            style={{
                              borderColor: palette.surfaceBorder,
                              backgroundColor: `${palette.surfaceBorder}40`,
                              color: palette.accent,
                            }}
                          >
                            {modeTag}
                          </span>
                          {room.code && (
                            <span
                              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border flex-none"
                              style={{
                                borderColor: `${palette.accent}40`,
                                color: palette.accent,
                                backgroundColor: `${palette.accent}15`,
                              }}
                            >
                              {room.code}
                            </span>
                          )}
                          {room.hasPassword && (
                            <span
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/30 flex items-center gap-1 flex-none"
                              title="Password Protected"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span>Passcode</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 text-[10px] opacity-60">
                          <span className="truncate">Host: <strong>{room.hostUsername || 'anonymous'}</strong></span>
                          <span>•</span>
                          <span className="flex items-center space-x-1 tabular-nums font-mono flex-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-none" />
                            <span>{room.participantCount || 1} participant{room.participantCount === 1 ? '' : 's'}</span>
                          </span>
                          <span>•</span>
                          <span className="truncate opacity-50">ID: {room.roomId}</span>
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (room.hasPassword) {
                            setPendingPasswordRoom({ roomId: room.roomId, name: room.name });
                          } else {
                            triggerProgressiveTransition(() => {
                              onJoinSession(room.roomId, `${room.owner}/${room.repo}`);
                            });
                          }
                        }}
                        className="h-8 min-w-[124px] px-3.5 rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 transition-all hover:opacity-90 shrink-0 cursor-pointer shadow-sm flex-none btn-tactile"
                        style={{
                          backgroundColor: palette.accent,
                          color: palette.isDark ? '#09090B' : '#FFFFFF',
                        }}
                      >
                        {room.hasPassword && <Lock className="w-3 h-3 flex-none" />}
                        <span className="truncate">Join Session</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-none" />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Directory Footer */}
          <div
            className="pt-3 mt-4 border-t flex items-center justify-between text-[10px] opacity-60 flex-none"
            style={{ borderColor: palette.surfaceBorder }}
          >
            <span className="truncate">Index: <code>active_rooms:*</code></span>
            <span className="truncate">Live Yjs Relay</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CleanLandingHub;
