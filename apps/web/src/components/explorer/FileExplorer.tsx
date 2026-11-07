'use client';

import React, { useState } from 'react';
import { GitHubTreeItem } from '@glyph/shared';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  File,
  ChevronRight,
  ChevronDown,
  Loader2,
  GitBranch,
  RefreshCw,
  AlertCircle,
  Code2,
} from 'lucide-react';
import { ActiveRepoState } from '../../hooks/useGitHubApi';
import { FileExplorerActions } from '../Sidebar/FileExplorerActions';
import { ExplorerSkeleton } from './ExplorerSkeleton';
import { useTheme } from '../../context/ThemeContext';

interface FileExplorerProps {
  activeRepo: ActiveRepoState | null;
  activeFileId?: string | null;
  isLoadingRepo: boolean;
  repoError: string | null;
  treeCache: Record<string, GitHubTreeItem[]>;
  loadingShas: Set<string>;
  onFetchFolder: (sha: string) => Promise<GitHubTreeItem[]>;
  onSelectFile?: (filePath: string, file: GitHubTreeItem) => void;
  onQuickLoad?: (slug: string) => void;
  onCreateFile?: (path: string) => void;
  onCreateFolder?: (path: string) => void;
  onRenameItem?: (oldPath: string, newPath: string) => void;
  onDeleteItem?: (path: string) => void;
}

/**
 * Returns an appropriate icon based on file extension and language
 */
function getFileIcon(filename: string) {
  const base = filename.toLowerCase();
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Specific build and system configuration files
  if (base === 'cmakelists.txt' || ext === 'cmake') {
    return <FileCode className="w-4 h-4 text-purple-400 shrink-0" />;
  }
  if (base === 'makefile' || base === 'gnumakefile' || ext === 'mk') {
    return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
  }
  if (base === 'dockerfile' || ext === 'dockerfile') {
    return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
  }

  switch (ext) {
    // C and C++ (Full family: cpp, c, cc, cxx, h, hpp, hh, hxx, inl, cu)
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
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    case 'c':
    case 'h':
      return <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />;

    // Rust
    case 'rs':
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;

    // Go
    case 'go':
      return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;

    // Python
    case 'py':
    case 'pyw':
    case 'ipynb':
      return <FileCode className="w-4 h-4 text-yellow-400 shrink-0" />;

    // Java
    case 'java':
      return <FileCode className="w-4 h-4 text-amber-500 shrink-0" />;

    // C#
    case 'cs':
      return <FileCode className="w-4 h-4 text-violet-400 shrink-0" />;

    // TypeScript & JavaScript
    case 'ts':
    case 'tsx':
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;

    // PHP, Ruby, Swift, Kotlin, Zig
    case 'php':
      return <FileCode className="w-4 h-4 text-indigo-300 shrink-0" />;
    case 'rb':
      return <FileCode className="w-4 h-4 text-red-400 shrink-0" />;
    case 'swift':
      return <FileCode className="w-4 h-4 text-orange-500 shrink-0" />;
    case 'kt':
    case 'kts':
      return <FileCode className="w-4 h-4 text-purple-400 shrink-0" />;
    case 'zig':
      return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;

    // Web & Styles
    case 'html':
    case 'htm':
    case 'css':
    case 'scss':
    case 'less':
      return <Code2 className="w-4 h-4 text-rose-400 shrink-0" />;

    // Config & Data
    case 'json':
      return <FileJson className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
    case 'svg':
    case 'sql':
    case 'env':
    case 'ini':
      return <FileCode className="w-4 h-4 text-teal-400 shrink-0" />;

    // Shell & Scripts
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
    case 'ps1':
    case 'bat':
    case 'cmd':
      return <FileCode className="w-4 h-4 text-lime-400 shrink-0" />;

    // Text & Docs
    case 'md':
    case 'txt':
    case 'markdown':
      return <FileText className="w-4 h-4 opacity-60 shrink-0" />;

    default:
      return <File className="w-4 h-4 opacity-60 shrink-0" />;
  }
}

interface TreeNodeProps {
  item: GitHubTreeItem;
  level: number;
  activeFileId?: string | null;
  treeCache: Record<string, GitHubTreeItem[]>;
  loadingShas: Set<string>;
  onFetchFolder: (sha: string) => Promise<GitHubTreeItem[]>;
  onSelectFile?: (filePath: string, file: GitHubTreeItem) => void;
  parentPath?: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  level,
  activeFileId,
  treeCache,
  loadingShas,
  onFetchFolder,
  onSelectFile,
  parentPath = '',
}) => {
  const { palette } = useTheme();
  const isDirectory = item.type === 'tree';
  const fullPath = parentPath ? `${parentPath}/${item.path}` : item.path;
  const isParentOfActive = Boolean(activeFileId && (activeFileId.endsWith(`:${fullPath}`) || activeFileId.includes(`:${fullPath}/`)));
  const [isOpen, setIsOpen] = useState(isParentOfActive || (level === 0 && Boolean(treeCache[item.sha])));

  // Auto-expand folder if active file is selected inside it
  React.useEffect(() => {
    if (isParentOfActive) {
      setIsOpen(true);
    }
  }, [isParentOfActive]);

  const isFolderLoading = loadingShas.has(item.sha);
  const children = treeCache[item.sha] || [];
  const isActive = !isDirectory && activeFileId === fullPath;

  const handleClick = async () => {
    if (isDirectory) {
      const nextOpen = !isOpen;
      setIsOpen(nextOpen);
      if (nextOpen && !treeCache[item.sha]) {
        // Trigger lazy-load for this folder's specific SHA
        await onFetchFolder(item.sha);
      }
    } else {
      // Phase 2: State update setting activeFileId
      if (onSelectFile) {
        onSelectFile(fullPath, { ...item, path: fullPath });
      }
    }
  };

  return (
    <div className="select-none text-xs font-mono">
      <div
        onClick={handleClick}
        style={{
          paddingLeft: `${Math.max(level * 12 + 6, 8)}px`,
          backgroundColor: isActive ? `${palette.accent}18` : undefined,
          color: isActive ? palette.accent : undefined,
          borderLeftColor: isActive ? palette.accent : 'transparent',
        }}
        className={`flex items-center space-x-1.5 py-1 pr-2 rounded cursor-pointer transition-colors group ${
          isDirectory
            ? palette.isDark
              ? 'hover:bg-white/5 opacity-80 hover:opacity-100'
              : 'hover:bg-black/5 opacity-80 hover:opacity-100'
            : isActive
            ? 'border-l-2 font-semibold pl-2'
            : palette.isDark
            ? 'hover:bg-white/5 opacity-70 hover:opacity-100'
            : 'hover:bg-black/5 opacity-70 hover:opacity-100'
        }`}
      >
        {isDirectory ? (
          <div className="flex items-center space-x-1 shrink-0">
            {isFolderLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: palette.accent }} />
            ) : isOpen ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            )}

            {isOpen ? (
              <FolderOpen className="w-4 h-4 shrink-0" style={{ color: palette.accent }} />
            ) : (
              <Folder className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" />
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-1 shrink-0 pl-3.5">
            {getFileIcon(item.path)}
          </div>
        )}

        <span className="truncate tracking-tight">{item.path}</span>
      </div>

      {/* Render lazy-loaded children when folder is expanded */}
      {isDirectory && isOpen && (
        <div className="flex flex-col">
          {isFolderLoading && children.length === 0 ? (
            <div
              style={{ paddingLeft: `${(level + 1) * 12 + 18}px` }}
              className="py-1 text-gray-500 text-[11px] italic flex items-center space-x-1.5"
            >
              <Loader2 className="w-3 h-3 animate-spin opacity-80" style={{ color: palette.accent }} />
              <span>Fetching tree (depth=1)...</span>
            </div>
          ) : children.length === 0 ? (
            <div
              style={{ paddingLeft: `${(level + 1) * 12 + 18}px` }}
              className="py-1 text-gray-600 text-[11px] italic"
            >
              (empty)
            </div>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.sha + child.path}
                item={child}
                level={level + 1}
                activeFileId={activeFileId}
                treeCache={treeCache}
                loadingShas={loadingShas}
                onFetchFolder={onFetchFolder}
                onSelectFile={onSelectFile}
                parentPath={fullPath}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  activeRepo,
  activeFileId,
  isLoadingRepo,
  repoError,
  treeCache,
  loadingShas,
  onFetchFolder,
  onSelectFile,
  onQuickLoad,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
}) => {
  const { palette } = useTheme();
  const [filterText, setFilterText] = useState('');

  const rootItems = activeRepo ? treeCache[activeRepo.rootSha] || [] : [];

  const filteredItems = filterText.trim()
    ? rootItems.filter((item) =>
        item.path.toLowerCase().includes(filterText.toLowerCase().trim())
      )
    : rootItems;

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden select-none border-r font-mono"
      style={{
        backgroundColor: palette.background,
        color: palette.text,
        borderColor: palette.surfaceBorder,
      }}
    >
      {/* Explorer Header */}
      <div
        className="px-3 py-2.5 border-b flex items-center justify-between"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: palette.surface,
        }}
      >
        <div className="flex items-center space-x-2 truncate">
          <span
            className="text-[11px] font-mono font-bold tracking-wider uppercase"
            style={{ color: palette.subtext }}
          >
            Explorer
          </span>
          {activeRepo && (
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border truncate"
              style={{
                color: palette.accent,
                backgroundColor: `${palette.accent}15`,
                borderColor: `${palette.accent}30`,
              }}
            >
              {activeRepo.owner}/{activeRepo.repo}
            </span>
          )}
        </div>
        {activeRepo && (
          <div
            className="flex items-center space-x-1 text-[10px] font-mono"
            style={{ color: palette.subtext }}
          >
            <GitBranch className="w-3 h-3 text-emerald-400" />
            <span className="truncate max-w-[80px]">{activeRepo.defaultBranch}</span>
          </div>
        )}
      </div>

      {/* Explorer Actions (File & Folder Creation/Management) */}
      {onCreateFile && onCreateFolder && (
        <FileExplorerActions
          activeFilePath={activeFileId}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRenameItem={onRenameItem}
          onDeleteItem={onDeleteItem}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
        {isLoadingRepo ? (
          <ExplorerSkeleton />
        ) : repoError ? (
          <div
            className="p-3 bg-red-950/20 border border-red-500/40 rounded-lg m-1 space-y-2.5 text-xs"
          >
            <div className="flex items-center space-x-1.5 text-red-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>GitHub API Fetch Error</span>
            </div>
            <p className="text-gray-300 text-[11px] font-mono break-words leading-relaxed">
              {repoError}
            </p>
            {onQuickLoad && (
              <div className="pt-1.5 flex flex-col space-y-1.5 border-t border-red-500/20">
                <button
                  onClick={() => onQuickLoad('demo/starter')}
                  className="w-full py-1.5 px-2 rounded text-[11px] font-mono text-center font-medium transition-colors border"
                  style={{
                    backgroundColor: `${palette.accent}15`,
                    borderColor: `${palette.accent}40`,
                    color: palette.accent,
                  }}
                >
                  Load Demo Workspace (Offline)
                </button>
                <button
                  onClick={() => onQuickLoad('facebook/react')}
                  className="text-[10px] font-mono opacity-70 underline hover:opacity-100 text-left pt-0.5"
                >
                  Retry &quot;facebook/react&quot;
                </button>
              </div>
            )}
          </div>
        ) : !activeRepo ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-4">
            <div
              className="w-10 h-10 rounded-full border flex items-center justify-center"
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.surfaceBorder,
                color: palette.subtext,
              }}
            >
              <Folder className="w-5 h-5 opacity-80" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-mono font-medium" style={{ color: palette.text }}>
                No Repository Loaded
              </h4>
              <p className="text-[11px] max-w-[200px] leading-relaxed" style={{ color: palette.subtext }}>
                Enter a GitHub repository in the top bar to inspect its tree.
              </p>
            </div>

            {onQuickLoad && (
              <div className="pt-2 w-full space-y-1.5">
                <span
                  className="text-[10px] font-mono block uppercase"
                  style={{ color: palette.subtext }}
                >
                  Quick Load Suggestions
                </span>
                <div className="flex flex-col space-y-1">
                  {['demo/starter', 'facebook/react', 'vercel/next.js'].map((slug) => (
                    <button
                      key={slug}
                      onClick={() => onQuickLoad(slug)}
                      className="w-full py-1.5 px-2 border rounded text-[11px] font-mono text-left transition-colors truncate hover:bg-white/5"
                      style={{
                        backgroundColor: palette.surface,
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                    >
                      {slug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-4 text-center text-xs font-mono" style={{ color: palette.subtext }}>
            {filterText ? 'No matching files or folders.' : 'Empty directory.'}
          </div>
        ) : (
          <div className="flex flex-col space-y-0.5">
            {filteredItems.map((item) => (
              <TreeNode
                key={item.sha + item.path}
                item={item}
                level={0}
                activeFileId={activeFileId}
                treeCache={treeCache}
                loadingShas={loadingShas}
                onFetchFolder={onFetchFolder}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Explorer Footer Status */}
      {activeRepo && (
        <div
          className="px-3 py-1.5 border-t text-[10px] font-mono flex items-center justify-between"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: palette.surface,
            color: palette.subtext,
          }}
        >
          <span className="truncate">
            {rootItems.length} root item{rootItems.length === 1 ? '' : 's'}
          </span>
          <span className="text-[9px] font-medium opacity-70" style={{ color: palette.accent }}>
            Tree Mounted
          </span>
        </div>
      )}
    </div>
  );
};

