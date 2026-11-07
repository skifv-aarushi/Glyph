'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type * as monaco from 'monaco-editor';
import type { Editor as TldrawEditor } from '@tldraw/tldraw';
import { MonacoBinding } from 'y-monaco';
import { TopBar } from '../TopBar/TopBar';
import { FileExplorer } from '../explorer/FileExplorer';
import { EditorSkeleton } from './EditorSkeleton';
import { ModeToggle, InteractionMode } from '../toolbar/ModeToggle';
import { CanvasFloatingHUD } from '../Canvas/CanvasFloatingHUD';
import { StickerDrawer } from '../Canvas/StickerDrawer';
import { LayerManager } from '../Canvas/LayerManager';
import { CleanLandingHub } from '../Lobby/CleanLandingHub';
import { GitPushModal } from '../modals/GitPushModal';
import { ShortcutsModal } from '../modals/ShortcutsModal';
import { TutorialModal } from '../modals/TutorialModal';
import { WorkspaceLoadingScreen } from '../UI/WorkspaceLoadingScreen';
import { ArchitectureSticker } from '../stickers/stickersData';
import { getFileExtensionTemplate } from '../../utils/fileTemplates';
import { useGitHubApi, localFileContentMap } from '../../hooks/useGitHubApi';
import { loadLocalWorkspace } from '../../utils/localWorkspaceStore';
import { useYjsSync } from '../../hooks/useYjsSync';
import { useSearchParams } from 'next/navigation';
import { RoomPasswordModal } from '../modals/RoomPasswordModal';
import { SessionConcludedModal } from '../modals/SessionConcludedModal';
import { YjsContextProvider } from '../../context/YjsContext';
import { useTheme } from '../../context/ThemeContext';
import { registerMonacoThemes } from '../../utils/themes';
import { bindMonacoToTldrawScroll, ScrollBindingInstance, getSpatialCanvasStyles } from '../../utils/scrollBinding';
import { bindTldrawToYjs } from '../../utils/tldrawYjsBinding';
import { pushRepoCommit } from '../../lib/api';
import { executeCodeInSandbox } from '../../services/codeExecution';
import { GitHubTreeItem } from '@glyph/shared';
import type { TLImageAsset } from '@tldraw/tldraw';
import {
  Layers,
  Terminal,
  Loader2,
  FileCode,
  Wifi,
  WifiOff,
  CheckCircle2,
  PenTool,
  Code2,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Play,
  X,
} from 'lucide-react';

// Dynamic import for Monaco to prevent SSR window reference issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

// Dynamic import for Tldraw to prevent SSR window reference issues
const TldrawCanvas = dynamic(
  () => import('@tldraw/tldraw').then((mod) => mod.Tldraw),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center pointer-events-none" />
    ),
  }
);

export function getMonacoLanguage(filePath: string): string {
  const clean = filePath.replace(/^\/+/, '');
  const fileName = clean.split('/').pop()?.toLowerCase() || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Specific configuration / build filenames
  if (fileName === 'cmakelists.txt' || ext === 'cmake') return 'cmake';
  if (fileName === 'makefile' || fileName === 'gnumakefile' || ext === 'mk') return 'makefile';
  if (fileName === 'dockerfile' || ext === 'dockerfile') return 'dockerfile';

  switch (ext) {
    // C and C++
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c++':
    case 'hpp':
    case 'hh':
    case 'hxx':
    case 'h++':
    case 'inl':
    case 'tpp':
    case 'ipp':
    case 'cu':
    case 'cuh':
      return 'cpp';
    case 'c':
    case 'h':
      return 'c';

    // TypeScript / JavaScript
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';

    // Python
    case 'py':
    case 'pyw':
    case 'rpy':
      return 'python';

    // Rust
    case 'rs':
      return 'rust';

    // Go
    case 'go':
      return 'go';

    // Java
    case 'java':
      return 'java';

    // C#
    case 'cs':
    case 'csx':
      return 'csharp';

    // PHP
    case 'php':
    case 'phtml':
      return 'php';

    // Ruby
    case 'rb':
    case 'erb':
    case 'rake':
      return 'ruby';

    // Kotlin
    case 'kt':
    case 'kts':
      return 'kotlin';

    // Swift
    case 'swift':
      return 'swift';

    // Dart
    case 'dart':
      return 'dart';

    // Lua
    case 'lua':
      return 'lua';

    // R
    case 'r':
      return 'r';

    // Scala
    case 'scala':
    case 'sc':
      return 'scala';

    // Perl
    case 'pl':
    case 'pm':
      return 'perl';

    // Zig
    case 'zig':
      return 'zig';

    // Web & Styles
    case 'html':
    case 'htm':
    case 'xhtml':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
      return 'scss';
    case 'less':
      return 'less';

    // Data & Config
    case 'json':
      return 'json';
    case 'xml':
    case 'svg':
    case 'plist':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
    case 'ini':
    case 'conf':
    case 'cfg':
    case 'env':
      return 'ini';

    // SQL
    case 'sql':
      return 'sql';

    // Shell & Scripts
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return 'shell';
    case 'bat':
    case 'cmd':
      return 'bat';
    case 'ps1':
    case 'psm1':
      return 'powershell';

    // Documentation
    case 'md':
    case 'markdown':
      return 'markdown';

    default:
      return 'plaintext';
  }
}

export interface EditorShellProps {
  initialRoomId?: string;
}

export const EditorShell: React.FC<EditorShellProps> = ({ initialRoomId }) => {
  const {
    authUser,
    isAuthenticated,
    isLoadingAuth,
    loginWithGitHub,
    logout,
    activeRepo,
    isLoadingRepo,
    repoError,
    treeCache,
    loadingShas,
    loadRepository,
    fetchFolderTree,
    addVirtualFile,
    addVirtualFolder,
    deleteVirtualItem,
    renameVirtualItem,
    createScratchWorkspace,
    importLocalFolder,
  } = useGitHubApi();

  const searchParams = useSearchParams();
  const [roomPassword, setRoomPassword] = useState<string | undefined>(
    searchParams?.get('pwd') || undefined
  );
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Active file tracking
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Interaction Mode: 'code' (Monaco gets clicks) vs 'draw' (Tldraw gets clicks)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('code');

  // Global Solid Theme Engine
  const { theme, palette } = useTheme();
  const [isStickersOpen, setIsStickersOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isSessionBrowserOpen, setIsSessionBrowserOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);
  const [activeLayerId, setActiveLayerId] = useState('layer-base');
  const activeLayerIdRef = useRef(activeLayerId);
  const activeFilePathRef = useRef(activeFilePath);

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId;
  }, [activeLayerId]);

  useEffect(() => {
    activeFilePathRef.current = activeFilePath;
  }, [activeFilePath]);

  // Sidebar drag-to-resize listener
  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const clamped = Math.min(Math.max(e.clientX, 180), 550);
      setSidebarWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      monacoEditorRef.current?.layout();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar]);

  // Auto-deselect shapes in canvas when switching to code mode to eliminate lingering selection boxes
  useEffect(() => {
    if (interactionMode === 'code') {
      tldrawEditorRef.current?.selectNone();
    }
  }, [interactionMode]);

  // Check if first-time visitor for tutorial modal
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem('pg_tutorial_dismissed_v1');
      if (!dismissed) {
        setIsTutorialOpen(true);
      }
    } catch {}
  }, []);

  const monacoInstanceRef = useRef<typeof import('monaco-editor') | null>(null);

  // Real-time Yjs CRDT WebSocket synchronization hook with RBAC & Offline Sync
  const {
    doc,
    provider,
    connectionStatus,
    isSynced,
    permission,
    role,
    sessionMode,
    canWriteMonaco,
    canWriteTldraw,
    setSessionMode,
    isOnline,
    isPushLocked,
    isDraftRestored,
    draftRestoredMessage,
    yText,
    participants,
    roomCode,
    isPublic,
    hasPassword,
    authError,
    isSessionConcluded,
    sessionConcludedInfo,
    concludeSession,
    setUserRole,
    updateRoomSettings,
  } = useYjsSync(activeFileId, roomPassword);

  useEffect(() => {
    if (authError && (authError.toLowerCase().includes('password') || authError.includes('4403'))) {
      setIsPasswordModalOpen(true);
    }
  }, [authError]);

  const isReadOnly = !canWriteMonaco;
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushToast, setPushToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [draftToast, setDraftToast] = useState<string | null>(null);

  // In-Browser & Ephemeral Sandbox Execution State
  const [isRunningCode, setIsRunningCode] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false);

  const handleRunCode = async () => {
    if (!monacoEditorRef.current || isRunningCode) return;
    const code = monacoEditorRef.current.getValue();
    setIsRunningCode(true);
    setIsTerminalOpen(true);
    setTerminalOutput('');

    try {
      await executeCodeInSandbox({
        code,
        filePath: activeFilePath || 'main.ts',
        ydoc: doc,
        monacoEditor: monacoEditorRef.current,
        tldrawEditor: tldrawEditorRef.current,
        monacoInstance: monacoInstanceRef.current,
        onOutputChunk: (chunk) => {
          setTerminalOutput((prev) => prev + chunk);
        },
      });
    } finally {
      setIsRunningCode(false);
    }
  };

  // Workspace Initialization based on URL parameters, local folder upload, or scratchpad
  useEffect(() => {
    const localName = searchParams?.get('local');
    if (localName) {
      loadLocalWorkspace()
        .then((payload) => {
          if (payload && payload.files && payload.files.length > 0) {
            importLocalFolder(payload.folderName || localName, payload.files);
          } else {
            loadRepository('demo/starter');
          }
        })
        .catch((e) => {
          console.warn('[EditorShell] Error loading local workspace payload:', e);
          loadRepository('demo/starter');
        });
      return;
    }

    const scratchName = searchParams?.get('scratch');
    if (scratchName) {
      createScratchWorkspace(scratchName);
      return;
    }

    const repoSlug = searchParams?.get('repo');
    if (repoSlug) {
      loadRepository(repoSlug);
      return;
    }

    if (initialRoomId) {
      return; // Handled by initialRoomId effect
    }

    // Default fallback starter demo workspace
    loadRepository('demo/starter');
  }, [loadRepository, createScratchWorkspace, importLocalFolder, searchParams, initialRoomId]);

  // Synchronize Monaco theme dynamically when user selects from theme dropdown
  useEffect(() => {
    if (monacoInstanceRef.current) {
      monacoInstanceRef.current.editor.setTheme(theme);
    }
  }, [theme]);

  // Synchronize Tldraw colorScheme preference when switching between dark and light themes
  useEffect(() => {
    if (tldrawEditorRef.current) {
      const colorScheme = palette.isDark ? 'dark' : 'light';
      tldrawEditorRef.current.user.updateUserPreferences({ colorScheme });
    }
  }, [palette]);

  // Surface draft restoration notification when WIP state is rehydrated from Supabase
  useEffect(() => {
    if (isDraftRestored) {
      setDraftToast(draftRestoredMessage || 'Restored unsaved workspace draft.');
      const timer = setTimeout(() => {
        setDraftToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isDraftRestored, draftRestoredMessage]);

  // Stateless Git Commit & Push action under Redis Mutex Lock with Origin Pipeline
  const handleOpenPushModal = () => {
    if (!activeFileId || !activeRepo) return;
    if (permission !== 'write' || (!canWriteMonaco && !canWriteTldraw)) {
      alert('Permission Denied: Your current role or session mode restricts pushing commits.');
      return;
    }
    setIsPushModalOpen(true);
  };

  const handleExecutePush = async (options: {
    message: string;
    branch?: string;
    createNewBranch?: boolean;
    repoName?: string;
    isPrivate?: boolean;
  }) => {
    if (!activeFileId || !activeRepo) return;

    const isLocalOrigin =
      activeRepo.owner === 'local' ||
      activeRepo.owner === 'upload' ||
      activeRepo.owner === 'workspace';

    setIsPushing(true);
    setPushToast(null);

    try {
      const data = await pushRepoCommit(activeFileId, options.message, {
        branch: options.branch,
        createNewBranch: options.createNewBranch,
        origin: isLocalOrigin ? 'local' : 'github',
        repoName: options.repoName,
        isPrivate: options.isPrivate,
      });

      console.log(`✅ [EditorShell] Commit created: ${data.commitSha} (${data.ref})`);
      setPushToast({
        type: 'success',
        message: isLocalOrigin && data.repoUrl
          ? `Created remote repository: ${data.repoUrl}`
          : `Pushed to GitHub: ${data.commitSha ? data.commitSha.slice(0, 7) : 'Success'} (${data.ref || 'HEAD'})`,
      });
      setTimeout(() => setPushToast(null), 5000);
    } catch (err: any) {
      console.error(`❌ [EditorShell] Commit push error:`, err);
      setPushToast({
        type: 'error',
        message: err.message || 'Push failed.',
      });
      setTimeout(() => setPushToast(null), 6000);
      throw err;
    } finally {
      setIsPushing(false);
    }
  };

  // Editor instance references
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const tldrawEditorRef = useRef<TldrawEditor | null>(null);
  const monacoBindingRef = useRef<MonacoBinding | null>(null);
  const tldrawBindingCleanupRef = useRef<(() => void) | null>(null);
  const scrollBindingRef = useRef<ScrollBindingInstance | null>(null);
  const clientFileCache = useRef<Map<string, string>>(new Map());

  // Sync active drawing tool with Tldraw whenever interaction mode switches
  useEffect(() => {
    if (tldrawEditorRef.current) {
      if (interactionMode === 'draw') {
        tldrawEditorRef.current.updateInstanceState({ isReadonly: !canWriteTldraw });
        tldrawEditorRef.current.setCurrentTool('draw');
      } else {
        // Clear all shape selections when leaving Draw mode so handles/bounding boxes never linger over code
        tldrawEditorRef.current.selectNone();
        tldrawEditorRef.current.updateInstanceState({ isReadonly: true });
        tldrawEditorRef.current.setCurrentTool('select');
      }
    }
  }, [interactionMode, canWriteTldraw]);

  // Sync read-only status dynamically to Monaco
  useEffect(() => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.updateOptions({ readOnly: isReadOnly });
    }
  }, [isReadOnly]);

  // Keyboard shortcut for toggling Draw Mode (Alt+D) and Code Mode (Alt+C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setInteractionMode('draw');
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setInteractionMode('code');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cleanup bindings when activeFileId changes
  useEffect(() => {
    return () => {
      if (monacoBindingRef.current) {
        monacoBindingRef.current.destroy();
        monacoBindingRef.current = null;
      }
      if (tldrawBindingCleanupRef.current) {
        tldrawBindingCleanupRef.current();
        tldrawBindingCleanupRef.current = null;
      }
      if (scrollBindingRef.current) {
        scrollBindingRef.current.destroy();
        scrollBindingRef.current = null;
      }
    };
  }, [activeFileId]);

  // Establish Monaco Binding with Y.Text('monaco') when editor and doc are ready
  const bindMonaco = useCallback(async () => {
    if (!monacoEditorRef.current || !doc || !yText) return;

    // Destroy existing binding if present
    if (monacoBindingRef.current) {
      monacoBindingRef.current.destroy();
      monacoBindingRef.current = null;
    }

    const model = monacoEditorRef.current.getModel();
    if (model) {
      console.log(`[EditorShell] Binding Monaco to Y.Text('monaco') for room ${activeFileId}`);
      monacoBindingRef.current = new MonacoBinding(
        yText,
        model,
        new Set([monacoEditorRef.current]),
        provider?.awareness
      );
    }
  }, [doc, yText, provider, activeFileId]);

  // Establish Tldraw Yjs Binding with Y.Map('tldraw') when tldraw and doc are ready
  const bindTldraw = useCallback(() => {
    if (!tldrawEditorRef.current || !doc) return;

    if (tldrawBindingCleanupRef.current) {
      tldrawBindingCleanupRef.current();
      tldrawBindingCleanupRef.current = null;
    }

    console.log(`[EditorShell] Binding Tldraw to Y.Map('tldraw') for room ${activeFileId}`);
    tldrawBindingCleanupRef.current = bindTldrawToYjs(
      tldrawEditorRef.current,
      doc,
      'tldraw'
    );
  }, [doc, activeFileId]);

  // Re-bind when doc/synced state changes
  useEffect(() => {
    if (doc && isSynced) {
      if (yText && activeFileId) {
        clientFileCache.current.set(activeFileId, yText.toString());
      }
      bindMonaco();
      bindTldraw();
    }
  }, [doc, isSynced, bindMonaco, bindTldraw, yText, activeFileId]);

  // Synchronize Scroll Binding whenever both editors are ready
  useEffect(() => {
    if (monacoEditorRef.current && tldrawEditorRef.current) {
      if (scrollBindingRef.current) {
        scrollBindingRef.current.destroy();
      }
      console.log(`[EditorShell] Initializing Monaco <-> Tldraw Scroll Binding.`);
      scrollBindingRef.current = bindMonacoToTldrawScroll(
        monacoEditorRef.current,
        tldrawEditorRef.current
      );
    }
  }, [activeFileId]);

  // Monaco mount handler
  const handleMonacoMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    _monaco: typeof import('monaco-editor')
  ) => {
    monacoInstanceRef.current = _monaco;
    registerMonacoThemes(_monaco);
    _monaco.editor.setTheme(theme);
    monacoEditorRef.current = editor;

    // Deselect canvas shapes when focusing code
    editor.onDidFocusEditorText(() => {
      tldrawEditorRef.current?.selectNone();
    });

    if (doc && yText && isSynced) {
      bindMonaco();
    }

    if (tldrawEditorRef.current) {
      if (scrollBindingRef.current) {
        scrollBindingRef.current.destroy();
      }
      scrollBindingRef.current = bindMonacoToTldrawScroll(editor, tldrawEditorRef.current);
    }
  };

  // Tldraw mount handler
  const handleTldrawMount = (editor: TldrawEditor) => {
    tldrawEditorRef.current = editor;

    // Apply color scheme preference based on active theme
    const colorScheme = palette.isDark ? 'dark' : 'light';
    editor.user.updateUserPreferences({ colorScheme });

    // Intercept shape creation so user annotations automatically inherit activeLayerId and active filePath
    editor.sideEffects.registerBeforeCreateHandler('shape', (shape: any) => {
      const currentMeta = (shape.meta || {}) as Record<string, unknown>;
      return {
        ...shape,
        meta: {
          ...currentMeta,
          layerId: currentMeta.layerId || activeLayerIdRef.current || 'layer-base',
          filePath: currentMeta.filePath || activeFilePathRef.current || undefined,
        },
      };
    });

    // Eraser Tool Isolation: Eraser can ONLY delete shapes belonging to the active layer!
    editor.sideEffects.registerBeforeDeleteHandler('shape', (shape: any) => {
      const currentTool = editor.getCurrentToolId();
      if (currentTool === 'eraser') {
        const shapeLayerId = shape.meta?.layerId || 'layer-base';
        if (shapeLayerId !== activeLayerIdRef.current) {
          // Reject deletion of shapes from other layers
          return false;
        }
      }
    });

    // Store listener fallback to guarantee active layer tag on newly created shapes
    editor.store.listen((entry) => {
      if (entry.source === 'user') {
        const addedShapes: any[] = [];
        for (const [id, record] of Object.entries(entry.changes.added)) {
          const rec = record as any;
          if (rec?.typeName === 'shape' && !rec?.meta?.layerId) {
            addedShapes.push({
              id,
              type: rec.type,
              meta: {
                ...rec.meta,
                layerId: activeLayerIdRef.current || 'layer-base',
                filePath: activeFilePathRef.current || undefined,
              },
            });
          }
        }
        if (addedShapes.length > 0) {
          editor.updateShapes(addedShapes);
        }
      }
    });

    // Ensure canvas editing is ready and activate draw tool if in draw mode
    if (interactionMode === 'draw') {
      editor.updateInstanceState({ isReadonly: false });
      editor.setCurrentTool('draw');
    }

    if (doc && isSynced) {
      bindTldraw();
    }

    if (monacoEditorRef.current) {
      if (scrollBindingRef.current) {
        scrollBindingRef.current.destroy();
      }
      scrollBindingRef.current = bindMonacoToTldrawScroll(monacoEditorRef.current, editor);
    }
  };

  // Pre-Made Architecture Sticker Insertion into Tldraw Document
  const handleInsertSticker = async (sticker: ArchitectureSticker, targetPoint?: { x: number; y: number }) => {
    const editor = tldrawEditorRef.current;
    if (!editor) return;

    let x = 100;
    let y = 100;

    if (targetPoint) {
      x = targetPoint.x;
      y = targetPoint.y;
    } else {
      const screenCenter = editor.getViewportScreenBounds().center;
      const pagePoint = editor.screenToPage(screenCenter);
      x = pagePoint.x - sticker.width / 2;
      y = pagePoint.y - sticker.height / 2;
    }

    // 1. Create native Tldraw Asset with encoded SVG data URL
    const { createShapeId, AssetRecordType } = await import('@tldraw/tldraw');
    const assetId = AssetRecordType.createId();
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sticker.svg)}`;

    const asset: TLImageAsset = {
      id: assetId,
      typeName: 'asset',
      type: 'image',
      meta: {},
      props: {
        w: sticker.width,
        h: sticker.height,
        name: `${sticker.id}.svg`,
        isAnimated: false,
        mimeType: 'image/svg+xml',
        src: dataUrl,
      },
    };

    editor.createAssets([asset]);

    // 2. Create Image Shape bound to the created asset
    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'image',
      x,
      y,
      props: {
        w: sticker.width,
        h: sticker.height,
        assetId,
        url: '',
      },
      meta: {
        layerId: activeLayerIdRef.current || 'layer-base',
      },
    });

    editor.setCurrentTool('select');
    editor.select(shapeId);
    console.log(
      `🎨 [EditorShell] Inserted architecture sticker "${sticker.name}" at (${Math.round(x)}, ${Math.round(y)})`
    );
  };

  // External SVG Sticker Insertion with dynamic aspect ratio calculation
  const handleInsertSvgSticker = async (svgUrl: string, name: string) => {
    const editor = tldrawEditorRef.current;
    if (!editor) return;

    // Measure natural dimensions to preserve exact aspect ratio without cropping
    let width = 90;
    let height = 90;
    try {
      const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const nw = img.naturalWidth || 80;
          const nh = img.naturalHeight || 80;
          const aspect = nw / nh;
          const base = 96;
          if (aspect >= 1) {
            resolve({ w: base, h: Math.round(base / aspect) });
          } else {
            resolve({ w: Math.round(base * aspect), h: base });
          }
        };
        img.onerror = () => resolve({ w: 90, h: 90 });
        img.src = svgUrl;
      });
      width = dimensions.w;
      height = dimensions.h;
    } catch {
      width = 90;
      height = 90;
    }

    const screenCenter = editor.getViewportScreenBounds().center;
    const pagePoint = editor.screenToPage(screenCenter);
    const x = pagePoint.x - width / 2;
    const y = pagePoint.y - height / 2;

    const { createShapeId, AssetRecordType } = await import('@tldraw/tldraw');
    const assetId = AssetRecordType.createId();

    const asset: TLImageAsset = {
      id: assetId,
      typeName: 'asset',
      type: 'image',
      meta: {},
      props: {
        w: width,
        h: height,
        name: `${name}.svg`,
        isAnimated: false,
        mimeType: 'image/svg+xml',
        src: svgUrl,
      },
    };

    editor.createAssets([asset]);

    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'image',
      x,
      y,
      props: {
        w: width,
        h: height,
        assetId,
        url: '',
      },
      meta: {
        layerId: activeLayerIdRef.current || 'layer-base',
        filePath: activeFilePathRef.current || undefined,
      },
    });

    editor.setCurrentTool('select');
    editor.select(shapeId);
  };

  // Wheel forwarding: in Draw Mode, mouse wheel events over canvas scroll Monaco smoothly
  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (interactionMode !== 'draw' || !monacoEditorRef.current) return;

    // Preserve Tldraw pinch-to-zoom gestures when Ctrl/Cmd is active
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Stop propagation so Tldraw canvas internal pan listeners do not fight Monaco scroll binding
    e.stopPropagation();

    // Responsive trackpad acceleration multiplier
    const multiplier = e.deltaMode === 1 ? 24 : 1.75;
    const currentScrollTop = monacoEditorRef.current.getScrollTop();
    const currentScrollLeft = monacoEditorRef.current.getScrollLeft();
    monacoEditorRef.current.setScrollPosition({
      scrollTop: Math.round(currentScrollTop + e.deltaY * multiplier),
      scrollLeft: Math.round(currentScrollLeft + e.deltaX * multiplier),
    });
  };

  const handleSelectFile = (filePath: string, _file: GitHubTreeItem) => {
    if (!activeRepo) return;
    const cleanPath = filePath.replace(/^\/+/, '');
    const roomId = `${activeRepo.owner}:${activeRepo.repo}:${cleanPath}`;
    console.log(`[EditorShell] Setting activeFileId: ${roomId}`);
    
    // Fast path: If local uploaded file or previously cached, load into Monaco model
    const localCode =
      localFileContentMap.get(cleanPath) ||
      localFileContentMap.get(`${activeRepo.repo}:${cleanPath}`) ||
      localFileContentMap.get(`local:${activeRepo.repo}:${cleanPath}`) ||
      clientFileCache.current.get(roomId);

    if (localCode !== undefined && monacoEditorRef.current) {
      clientFileCache.current.set(roomId, localCode);
      const model = monacoEditorRef.current.getModel();
      if (model) {
        model.setValue(localCode);
      }
    }

    setActiveFileId(roomId);
    setActiveFilePath(cleanPath);
    tldrawEditorRef.current?.selectNone();
  };

  // Direct Room Joining via initialRoomId
  useEffect(() => {
    if (!initialRoomId) return;
    const parts = initialRoomId.split(':');
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      loadRepository(`${owner}/${repo}`);
      if (parts.length >= 3) {
        const path = parts.slice(2).join(':');
        setActiveFileId(initialRoomId);
        setActiveFilePath(path);
      }
    }
  }, [initialRoomId, loadRepository]);

  // Automatically open initial starter file when tree is loaded
  useEffect(() => {
    if (activeRepo && !activeFilePath && treeCache[activeRepo.rootSha]) {
      const rootItems = treeCache[activeRepo.rootSha] || [];
      let fileToOpen =
        rootItems.find((i) => i.path.toLowerCase() === 'readme.md') ||
        rootItems.find((i) => i.type === 'blob');

      let pathToOpen = fileToOpen ? fileToOpen.path : undefined;

      // If no blob exists at root (common in C/C++ projects where code is in src/ or include/),
      // search recursively in treeCache for entry-point files
      if (!fileToOpen) {
        const priorityRegex = /(?:main|index|app|entry)\.(?:cpp|c|cc|cxx|h|hpp|ts|tsx|js|jsx|py|rs|go|java|cs)$/i;
        for (const [sha, items] of Object.entries(treeCache)) {
          if (sha === activeRepo.rootSha) continue;
          const match = items.find((i) => i.type === 'blob' && priorityRegex.test(i.path));
          if (match) {
            fileToOpen = match;
            pathToOpen = match.sha.startsWith('file-') ? match.sha.slice(5) : match.path;
            break;
          }
        }

        // Fallback: select first available blob anywhere in treeCache
        if (!fileToOpen) {
          for (const items of Object.values(treeCache)) {
            const firstBlob = items.find((i) => i.type === 'blob');
            if (firstBlob) {
              fileToOpen = firstBlob;
              pathToOpen = firstBlob.sha.startsWith('file-') ? firstBlob.sha.slice(5) : firstBlob.path;
              break;
            }
          }
        }
      }

      if (fileToOpen && pathToOpen) {
        handleSelectFile(pathToOpen, fileToOpen);
      }
    }
  }, [activeRepo, treeCache, activeFilePath]);

  // Keyboard Hotkey Routing & Disambiguation (Monaco Priority vs Canvas Hotkeys)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Global Mode / Focus Toggle: Alt+D (draw), Alt+C (code), Esc (return to code)
      if (e.altKey && e.code === 'KeyD') {
        e.preventDefault();
        setInteractionMode('draw');
        return;
      }

      if (e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        setInteractionMode('code');
        return;
      }

      if (e.key === 'Escape' && interactionMode === 'draw') {
        e.preventDefault();
        setInteractionMode('code');
        return;
      }

      // 2. Global Code Run Trigger: Ctrl+Enter / Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
        return;
      }

      // 3. Shortcuts Modal: Ctrl+/ or Cmd+/ or ? when not typing
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.code === 'Slash')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // 4. Monaco Priority: If Monaco editor has focus, let Monaco receive all shortcuts
      const activeEl = document.activeElement;
      const isMonacoFocused = !!activeEl?.closest('.monaco-editor');

      if (isMonacoFocused) {
        if (e.ctrlKey || e.metaKey) {
          if (['KeyP', 'KeyF', 'KeyD'].includes(e.code)) {
            // Let Monaco handle Ctrl+P, Ctrl+F, Ctrl+D uninterrupted
            return;
          }
        }
      }

      // 5. Canvas Hotkeys: When in Draw Mode and not typing in text fields or in-canvas text boxes
      const isInputActive =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        isMonacoFocused ||
        !!activeEl?.closest('.tl-text-input') ||
        !!activeEl?.closest('[data-isediting="true"]');

      if (interactionMode === 'draw' && !isInputActive) {
        const key = e.key.toLowerCase();
        if (key === '?') {
          e.preventDefault();
          setIsShortcutsOpen(true);
        } else if (key === 'l') {
          e.preventDefault();
          setIsLayersOpen((prev) => !prev);
        } else if (key === 's') {
          e.preventDefault();
          setIsStickersOpen((prev) => !prev);
        } else if (tldrawEditorRef.current) {
          if (key === 'v') {
            tldrawEditorRef.current.setCurrentTool('select');
          } else if (key === 'd') {
            tldrawEditorRef.current.setCurrentTool('draw');
          } else if (key === 'e') {
            tldrawEditorRef.current.setCurrentTool('eraser');
          } else if (key === 'a') {
            tldrawEditorRef.current.setCurrentTool('arrow');
          } else if (key === 'r') {
            tldrawEditorRef.current.setCurrentTool('geo');
          } else if (key === 't') {
            tldrawEditorRef.current.setCurrentTool('text');
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [interactionMode]);

  return (
    <YjsContextProvider
      value={{
        doc,
        provider,
        connectionStatus,
        isSynced,
        permission,
        isOnline,
        isPushLocked,
        yText,
        activeFileId,
        setActiveFileId,
      }}
    >
      <div
        className="flex flex-col h-screen w-screen overflow-hidden transition-colors duration-200 relative"
        style={{ backgroundColor: palette.background, color: palette.text }}
      >
        {/* Floating Notification Toast: Git Push Status */}
        {pushToast && (
          <div
            className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-center space-x-2.5 font-mono text-xs transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
              backgroundColor: palette.surface,
              borderColor: pushToast.type === 'success' ? '#10B981' : '#EF4444',
              color: pushToast.type === 'success' ? '#10B981' : '#EF4444',
            }}
          >
            {pushToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
            <span className="font-medium">{pushToast.message}</span>
          </div>
        )}

        {/* Floating Notification Toast: Supabase Draft Rehydration */}
        {draftToast && (
          <div
            className="fixed top-16 right-6 z-50 px-4 py-2.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-center space-x-2.5 font-mono text-xs transition-all animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
              color: palette.accent,
            }}
          >
            <Sparkles className="w-4 h-4 animate-pulse" style={{ color: palette.accent }} />
            <span className="font-medium">{draftToast}</span>
          </div>
        )}

        {/* Top Navigation & Auth Bar */}
        <TopBar
          authUser={authUser}
          isAuthenticated={isAuthenticated}
          isLoadingAuth={isLoadingAuth}
          onLogin={loginWithGitHub}
          onLogout={logout}
          onLoadRepo={loadRepository}
          isLoadingRepo={isLoadingRepo}
          currentRepoSlug={activeRepo ? `${activeRepo.owner}/${activeRepo.repo}` : ''}
          activeFileId={activeFileId}
          isPushLocked={isPushLocked}
          isPushing={isPushing}
          permission={permission}
          role={role}
          sessionMode={sessionMode}
          onSetSessionMode={setSessionMode}
          onPushCommit={handleOpenPushModal}
          onOpenSessions={() => setIsSessionBrowserOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenTutorial={() => setIsTutorialOpen(true)}
          roomCode={roomCode}
          isPublic={isPublic}
          hasPassword={hasPassword}
          participants={participants}
          onSetUserRole={setUserRole}
          onUpdateRoomSettings={updateRoomSettings}
          onConcludeSession={concludeSession}
          currentUserId={authUser?.login || undefined}
        />

        {/* Main Workspace Layout */}
        <div className="flex flex-1 h-[calc(100vh-3.5rem)] w-full overflow-hidden">
          {/* Left Sidebar: Lazy-Loaded Repository File Explorer with Draggable Resizer */}
          <aside
            className="relative h-full flex flex-col z-10 shrink-0 border-r select-none transition-[width] duration-75"
            style={{
              width: `${sidebarWidth}px`,
              minWidth: '180px',
              maxWidth: '550px',
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
            }}
          >
            <FileExplorer
              activeRepo={activeRepo}
              activeFileId={activeFilePath}
              isLoadingRepo={isLoadingRepo}
              repoError={repoError}
              treeCache={treeCache}
              loadingShas={loadingShas}
              onFetchFolder={fetchFolderTree}
              onSelectFile={handleSelectFile}
              onQuickLoad={loadRepository}
              onCreateFile={(filePath) => {
                const item = addVirtualFile(filePath);
                if (item) {
                  const initialContent = getFileExtensionTemplate(
                    item.path,
                    activeRepo?.owner || 'workspace',
                    activeRepo?.repo || 'project'
                  );
                  const roomId = `${activeRepo?.owner || 'workspace'}:${activeRepo?.repo || 'project'}:${item.path.replace(/^\/+/, '')}`;
                  clientFileCache.current.set(roomId, initialContent);
                  handleSelectFile(item.path, item);
                }
              }}
              onCreateFolder={(folderPath) => {
                addVirtualFolder(folderPath);
              }}
              onRenameItem={(oldPath, newPath) => {
                renameVirtualItem(oldPath, newPath);
                if (activeFilePath === oldPath) {
                  setActiveFilePath(newPath);
                }
              }}
              onDeleteItem={(path) => {
                deleteVirtualItem(path);
                if (activeFilePath === path) {
                  setActiveFilePath(null);
                  setActiveFileId(null);
                }
              }}
            />

            {/* Draggable Divider Handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingSidebar(true);
              }}
              className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-20 ${
                isResizingSidebar ? 'bg-blue-500 w-2' : ''
              }`}
              title="Drag to resize sidebar"
            />
          </aside>

          {/* Main Content Area: The Unified Editor View (Monaco + Tldraw) */}
          <main
            className="flex-1 relative h-full overflow-hidden flex flex-col bg-transparent"
          >
            {activeFilePath ? (
              <div className="h-full w-full flex flex-col bg-transparent">
                {/* File Tab Header with Mode Toggle & WebSocket Status */}
                <div
                  className="h-10 px-4 border-b flex items-center justify-between select-none z-20 backdrop-blur-md"
                  style={{
                    backgroundColor: `${palette.surface}CC`,
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                >
                  {/* File Metadata */}
                  <div className="flex items-center space-x-2 text-xs font-mono">
                    <FileCode className="w-3.5 h-3.5" style={{ color: palette.accent }} />
                    <span className="font-semibold" style={{ color: palette.text }}>
                      {activeFilePath}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${palette.surfaceBorder}30`,
                        borderColor: palette.surfaceBorder,
                        color: palette.subtext,
                      }}
                    >
                      {getMonacoLanguage(activeFilePath)}
                    </span>
                  </div>

                  {/* Mode Switcher, RBAC Status & WebSocket Status Indicator */}
                  <div className="flex items-center space-x-3">
                    {/* RBAC Role Indicator Badge */}
                    {isReadOnly ? (
                      <div
                        title="Spectator Mode: Read-Only access. You can watch live edits but cannot modify code or canvas."
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400"
                      >
                        <Eye className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] tracking-wide font-mono font-medium">Spectator</span>
                      </div>
                    ) : (
                      <div
                        title="Collaborator Mode: Full Write access. Edits and drawings are synchronized in real-time."
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                      >
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] tracking-wide font-mono font-medium">Collaborator</span>
                      </div>
                    )}

                    {/* Offline Queue Warning Badge */}
                    {!isOnline && (
                      <div
                        title="Network connection lost. Changes are queued locally in Yjs CRDT and will merge upon reconnection."
                        className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span className="text-[10px] tracking-wide font-mono font-medium">
                          Offline - Local Edits Queued
                        </span>
                      </div>
                    )}

                    {/* Mode Toggle (Code vs Draw) */}
                    <ModeToggle
                      mode={interactionMode}
                      onModeChange={setInteractionMode}
                      isReadOnly={isReadOnly}
                    />

                    {/* In-Browser & Ephemeral Run Button */}
                    <button
                      onClick={handleRunCode}
                      disabled={isRunningCode}
                      title="Run Active Code (Client Web Worker for JS/TS, Piston API for Polyglot)"
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-all disabled:opacity-50"
                      style={{
                        borderColor: `${palette.accent}50`,
                        backgroundColor: `${palette.accent}15`,
                        color: palette.accent,
                      }}
                    >
                      {isRunningCode ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 fill-current" />
                      )}
                      <span className="font-semibold">Run</span>
                    </button>

                    {/* Mode Hotkey Helper Badge */}
                    <span className="hidden xl:inline text-[10px] font-mono opacity-50">
                      {isReadOnly
                        ? 'Spectator (Read-Only)'
                        : interactionMode === 'code'
                        ? 'Alt+D to draw'
                        : 'Alt+C to code'}
                    </span>

                    {/* WebSocket Sync Status */}
                    <div className="flex items-center space-x-2 text-[11px] font-mono">
                      {connectionStatus === 'connected' && isSynced ? (
                        <div
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-emerald-500"
                          style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px] tracking-wide font-medium">Synced</span>
                        </div>
                      ) : connectionStatus === 'connected' ? (
                        <div
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-blue-500"
                          style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[10px]">Syncing...</span>
                        </div>
                      ) : connectionStatus === 'connecting' ? (
                        <div
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-amber-500"
                          style={{
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          <Wifi className="w-3 h-3 animate-pulse" />
                          <span className="text-[10px]">Connecting...</span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full border text-rose-500"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderColor: 'rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          <WifiOff className="w-3 h-3" />
                          <span className="text-[10px]">Disconnected</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* THE UNIFIED EDITOR VIEWPORT: DOM-CANVAS BRIDGE */}
                <div className="flex-1 relative w-full h-[calc(100%-2.5rem)] overflow-hidden bg-transparent">
                  {!isSynced && !clientFileCache.current.has(activeFileId || '') && (
                    <div className="absolute inset-0 z-30">
                      <EditorSkeleton filePath={activeFilePath} />
                    </div>
                  )}

                  {/* Layer 1: Monaco Editor (Base DOM Layer taking full width & height) */}
                  <div className="absolute inset-0 z-0">
                    <MonacoEditor
                      height="100%"
                      width="100%"
                      language={getMonacoLanguage(activeFilePath)}
                      theme={theme}
                      onMount={handleMonacoMount}
                      options={{
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', monospace",
                        fontLigatures: true,
                        minimap: { enabled: true, maxColumn: 80 },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        lineNumbers: 'on',
                        renderLineHighlight: 'all',
                        padding: { top: 16, bottom: 16 },
                        readOnly: isReadOnly,
                        smoothScrolling: false,
                        mouseWheelScrollSensitivity: 2,
                        fastScrollSensitivity: 7,
                        scrollbar: {
                          vertical: 'visible',
                          horizontal: 'auto',
                          verticalScrollbarSize: 8,
                          horizontalScrollbarSize: 8,
                          useShadows: false,
                          alwaysConsumeMouseWheel: true,
                        },
                      }}
                    />
                  </div>

                  {/* Layer 2: Tldraw Canvas (Layered Spatial HTML5 Canvas on top at z-index: 10) */}
                  <div
                    onWheel={handleCanvasWheel}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData('application/json');
                      if (!raw) return;
                      try {
                        const sticker = JSON.parse(raw) as ArchitectureSticker;
                        if (sticker?.id && sticker?.svg && tldrawEditorRef.current) {
                          const pagePoint = tldrawEditorRef.current.screenToPage({
                            x: e.clientX,
                            y: e.clientY,
                          });
                          handleInsertSticker(sticker, {
                            x: pagePoint.x - (sticker.width || 80) / 2,
                            y: pagePoint.y - (sticker.height || 80) / 2,
                          });
                        }
                      } catch {
                        // ignore invalid payload
                      }
                    }}
                    className={`absolute inset-0 z-10 spatial-canvas-overlay transition-colors ${
                      interactionMode === 'draw'
                        ? 'pointer-events-auto cursor-crosshair'
                        : 'pointer-events-none'
                    }`}
                  >
                    <TldrawCanvas
                      onMount={handleTldrawMount}
                      autoFocus={false}
                      hideUi={true}
                    />
                  </div>

                  {/* Layer 3: Advanced Architecture Sandbox Tools (Available in Draw Mode) */}
                  {interactionMode === 'draw' && (
                    <CanvasFloatingHUD
                      editor={tldrawEditorRef.current}
                      onToggleStickers={() => setIsStickersOpen((prev) => !prev)}
                      isStickersOpen={isStickersOpen}
                      onToggleLayers={() => setIsLayersOpen((prev) => !prev)}
                      isLayersOpen={isLayersOpen}
                      activeLayerName={activeLayerId}
                    />
                  )}

                  {/* External Searchable SVG Sticker Catalog with Dynamic Recoloring */}
                  <StickerDrawer
                    isOpen={isStickersOpen}
                    onClose={() => setIsStickersOpen(false)}
                    editor={tldrawEditorRef.current}
                  />

                  {/* Multi-Layer Engine Manager */}
                  <LayerManager
                    editor={tldrawEditorRef.current}
                    ydoc={doc}
                    activeFilePath={activeFilePath}
                    isOpen={isLayersOpen}
                    onClose={() => setIsLayersOpen(false)}
                    activeLayerId={activeLayerId}
                    onSelectLayer={setActiveLayerId}
                  />

                  {/* Collaborative Execution Terminal Drawer */}
                  {isTerminalOpen && (
                    <div
                      className="absolute bottom-0 left-0 right-0 max-h-56 h-48 border-t z-30 flex flex-col backdrop-blur-md font-mono text-xs shadow-2xl transition-colors"
                      style={{
                        backgroundColor: palette.surface,
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                    >
                      <div
                        className="flex items-center justify-between px-3 py-1.5 border-b"
                        style={{
                          borderColor: palette.surfaceBorder,
                          backgroundColor: `${palette.surfaceBorder}20`,
                        }}
                      >
                        <div className="flex items-center space-x-2 text-[11px]">
                          <Terminal className="w-3.5 h-3.5" style={{ color: palette.accent }} />
                          <span className="font-semibold" style={{ color: palette.text }}>
                            Execution Output
                          </span>
                          <span className="text-[10px]" style={{ color: palette.subtext }}>
                            ({activeFilePath})
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setTerminalOutput('')}
                            className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                            style={{ color: palette.subtext }}
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => setIsTerminalOpen(false)}
                            className="p-1 rounded transition-colors"
                            style={{ color: palette.subtext }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <pre
                        className="flex-1 p-3 overflow-auto whitespace-pre-wrap select-text leading-relaxed text-[11px]"
                        style={{ color: palette.text }}
                      >
                        {terminalOutput || (isRunningCode ? 'Running execution pipeline...' : 'No output recorded.')}
                      </pre>
                    </div>
                  )}

                  {/* Floating Mode Indicator Badge */}
                  <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
                    <div
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-md transition-all font-mono text-[11px]"
                      style={{
                        backgroundColor: palette.surface,
                        borderColor: palette.surfaceBorder,
                        color: interactionMode === 'draw' ? palette.accent : palette.subtext,
                      }}
                    >
                      {interactionMode === 'draw' ? (
                        <>
                          <PenTool className="w-3.5 h-3.5 animate-bounce" style={{ color: palette.accent }} />
                          <span className="font-medium">Draw Mode Active</span>
                        </>
                      ) : isReadOnly ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span className="font-medium">Spectator Mode (Read-Only)</span>
                        </>
                      ) : (
                        <>
                          <Code2 className="w-3.5 h-3.5" style={{ color: palette.accent }} />
                          <span>Code Mode Active</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : isLoadingRepo ? (
              <div className="h-full w-full flex items-center justify-center p-8 select-none">
                <WorkspaceLoadingScreen
                  title={activeRepo ? `${activeRepo.owner}/${activeRepo.repo}` : 'Loading Repository'}
                  subtitle="Fetching repository tree, AST metadata, and initializing CRDT buffer..."
                  stageIndex={2}
                />
              </div>
            ) : (
              /* Clean Session Hub Viewport when no file is active */
              <div
                className="h-full w-full flex flex-col items-center justify-start overflow-y-auto p-4 md:p-8 custom-scrollbar select-none"
                style={{ backgroundColor: palette.background }}
              >
                <div className="w-full max-w-4xl">
                  <CleanLandingHub
                    onJoinSession={(roomId: string) => {
                      const parts = roomId.split(':');
                      if (parts.length >= 2) {
                        loadRepository(`${parts[0]}/${parts[1]}`);
                      }
                    }}
                    onImportRepo={(repoUrl: string) => {
                      loadRepository(repoUrl);
                    }}
                    onCreateScratch={(name: string) => {
                      createScratchWorkspace(name);
                    }}
                  />
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Session Discovery & Lobby Modal */}
        {isSessionBrowserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div
              className="relative w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl border flex flex-col p-4"
              style={{
                backgroundColor: palette.background,
                borderColor: palette.surfaceBorder,
                color: palette.text,
              }}
            >
              <button
                onClick={() => setIsSessionBrowserOpen(false)}
                className={`absolute top-4 right-4 z-10 p-1.5 rounded-lg border transition-colors ${
                  palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
                style={{
                  borderColor: palette.surfaceBorder,
                  color: palette.text,
                  backgroundColor: palette.surface,
                }}
                title="Close Sessions Hub"
              >
                <X className="w-5 h-5" />
              </button>

              <CleanLandingHub
                onJoinSession={(roomId: string) => {
                  console.log('[EditorShell] Joining session:', roomId);
                  setIsSessionBrowserOpen(false);
                  const parts = roomId.split(':');
                  if (parts.length >= 2) {
                    loadRepository(`${parts[0]}/${parts[1]}`);
                  }
                }}
                onImportRepo={(repoUrl: string) => {
                  loadRepository(repoUrl);
                  setIsSessionBrowserOpen(false);
                }}
                onCreateScratch={(name: string) => {
                  createScratchWorkspace(name);
                  setIsSessionBrowserOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Stateless Git Commit & Push Modal with Origin Branching & Redis Mutex */}
        {isPushModalOpen && (
          <GitPushModal
            isOpen={isPushModalOpen}
            onClose={() => setIsPushModalOpen(false)}
            onConfirmPush={handleExecutePush}
            isLocalOrigin={
              activeRepo?.owner === 'local' ||
              activeRepo?.owner === 'upload' ||
              activeRepo?.owner === 'workspace'
            }
            defaultBranch={activeRepo?.defaultBranch || 'main'}
            defaultRepoName={activeRepo?.repo || 'spatial-workspace'}
            activeFilePath={activeFilePath}
            isPushLocked={isPushLocked}
            isPushing={isPushing}
          />
        )}

        {/* Global Keyboard Shortcuts Cheat Sheet Modal */}
        <ShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />

        {/* Step-by-Step Interactive Workspace Tutorial Modal */}
        <TutorialModal
          isOpen={isTutorialOpen}
          onClose={() => setIsTutorialOpen(false)}
        />

        {/* Room Password Authentication Modal */}
        <RoomPasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onSubmitPassword={(pwd) => {
            setRoomPassword(pwd);
            setIsPasswordModalOpen(false);
          }}
          roomName={activeRepo ? `${activeRepo.owner}/${activeRepo.repo}` : undefined}
          errorMessage={authError}
        />

        {/* Session Concluded Notice Modal */}
        <SessionConcludedModal
          isOpen={isSessionConcluded}
          concludedBy={sessionConcludedInfo?.by}
          reason={sessionConcludedInfo?.reason}
        />
      </div>
    </YjsContextProvider>
  );
};
