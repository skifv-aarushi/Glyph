'use client';

import React, { useState } from 'react';
import {
  FilePlus,
  FolderPlus,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface FileExplorerActionsProps {
  activeFilePath?: string | null;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRenameItem?: (oldPath: string, newPath: string) => void;
  onDeleteItem?: (path: string) => void;
  onRefresh?: () => void;
}

export const FileExplorerActions: React.FC<FileExplorerActionsProps> = ({
  activeFilePath,
  onCreateFile,
  onCreateFolder,
  onRenameItem,
  onDeleteItem,
  onRefresh,
}) => {
  const { palette } = useTheme();
  const [modalType, setModalType] = useState<'file' | 'folder' | 'rename' | 'delete' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const openModal = (type: 'file' | 'folder' | 'rename' | 'delete') => {
    setErrorMsg('');
    if (type === 'rename') {
      setInputValue(activeFilePath || '');
    } else {
      setInputValue('');
    }
    setModalType(type);
  };

  const closeModal = () => {
    setModalType(null);
    setInputValue('');
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed && modalType !== 'delete') {
      setErrorMsg('Name cannot be empty');
      return;
    }

    if (modalType === 'file') {
      onCreateFile(trimmed);
      closeModal();
    } else if (modalType === 'folder') {
      onCreateFolder(trimmed);
      closeModal();
    } else if (modalType === 'rename') {
      if (activeFilePath && onRenameItem) {
        onRenameItem(activeFilePath, trimmed);
      }
      closeModal();
    } else if (modalType === 'delete') {
      if (activeFilePath && onDeleteItem) {
        onDeleteItem(activeFilePath);
      }
      closeModal();
    }
  };

  const isDark = palette.isDark;
  const iconBtnClass = isDark
    ? 'p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors'
    : 'p-1 rounded hover:bg-black/5 text-gray-600 hover:text-black transition-colors';

  return (
    <div className="relative">
      {/* Quick Action Icons Bar */}
      <div
        className="flex items-center space-x-1 px-2 py-1 border-b"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: `${palette.surface}80`,
        }}
      >
        <button
          onClick={() => openModal('file')}
          className={iconBtnClass}
          title="New File"
        >
          <FilePlus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => openModal('folder')}
          className={iconBtnClass}
          title="New Folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>

        {activeFilePath && onRenameItem && (
          <button
            onClick={() => openModal('rename')}
            className={iconBtnClass}
            title={`Rename "${activeFilePath}"`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {activeFilePath && onDeleteItem && (
          <button
            onClick={() => openModal('delete')}
            className={iconBtnClass}
            title={`Delete "${activeFilePath}"`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {onRefresh && (
          <button
            onClick={onRefresh}
            className={`${iconBtnClass} ml-auto`}
            title="Refresh Explorer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Creation / Action Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-mono text-xs">
          <div
            className="w-full max-w-sm rounded-xl p-4 shadow-2xl border flex flex-col space-y-3 animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: palette.surface,
              borderColor: palette.surfaceBorder,
              color: palette.text,
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: palette.surfaceBorder }}>
              <span className="font-semibold text-sm">
                {modalType === 'file' && 'Create New File'}
                {modalType === 'folder' && 'Create New Folder'}
                {modalType === 'rename' && 'Rename File or Folder'}
                {modalType === 'delete' && 'Confirm Deletion'}
              </span>
              <button onClick={closeModal} className={iconBtnClass}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalType === 'delete' ? (
              <div className="space-y-3 py-1">
                <p className="leading-relaxed text-xs" style={{ color: palette.text }}>
                  Are you sure you want to delete <span className="font-bold text-red-500">{activeFilePath}</span>?
                  This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-1.5 rounded border font-medium transition-colors"
                    style={{
                      borderColor: palette.surfaceBorder,
                      backgroundColor: `${palette.surfaceBorder}30`,
                      color: palette.text,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: palette.subtext }}>
                    {modalType === 'file' && 'File Path / Name (e.g., src/utils/logger.ts)'}
                    {modalType === 'folder' && 'Folder Path (e.g., components/canvas)'}
                    {modalType === 'rename' && 'New Name'}
                  </label>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder={modalType === 'file' ? 'src/index.ts' : 'my-folder'}
                    className="w-full border rounded px-3 py-2 text-xs focus:outline-none transition-colors"
                    style={{
                      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#ffffff',
                      borderColor: palette.surfaceBorder,
                      color: palette.text,
                    }}
                    autoFocus
                  />
                  {errorMsg && (
                    <span className="text-[10px] text-red-500 mt-1 block">{errorMsg}</span>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3 py-1.5 rounded border font-medium transition-colors"
                    style={{
                      borderColor: palette.surfaceBorder,
                      backgroundColor: `${palette.surfaceBorder}30`,
                      color: palette.text,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded font-bold transition-opacity hover:opacity-90 shadow-sm"
                    style={{
                      backgroundColor: palette.accent,
                      color: isDark ? '#09090B' : '#FFFFFF',
                    }}
                  >
                    {modalType === 'rename' ? 'Rename' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

