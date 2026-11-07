'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Editor as TldrawEditor } from '@tldraw/tldraw';
import * as Y from 'yjs';
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  FileCode,
  Globe,
  Edit2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type LayerScope = 'ALL_FILES' | 'ACTIVE_FILE_ONLY';

export interface CanvasLayer {
  id: string;
  name: string;
  visible: boolean;
  scope: LayerScope;
  boundFilePath?: string;
  locked: boolean;
  zIndex: number;
  // Compatibility aliases
  isVisible?: boolean;
  isLocked?: boolean;
  mode?: LayerScope | 'all' | 'context-bound';
  colorHex?: string;
}

const DEFAULT_LAYERS: CanvasLayer[] = [
  {
    id: 'layer-base',
    name: 'General Annotations',
    visible: true,
    locked: false,
    scope: 'ALL_FILES',
    zIndex: 0,
    isVisible: true,
    isLocked: false,
    mode: 'ALL_FILES',
    colorHex: '#3B82F6',
  },
  {
    id: 'layer-architecture',
    name: 'System Architecture',
    visible: true,
    locked: false,
    scope: 'ALL_FILES',
    zIndex: 1,
    isVisible: true,
    isLocked: false,
    mode: 'ALL_FILES',
    colorHex: '#10B981',
  },
];

interface LayerManagerProps {
  editor: TldrawEditor | null;
  ydoc: Y.Doc | null;
  activeFilePath: string | null;
  isOpen: boolean;
  onClose: () => void;
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  editor,
  ydoc,
  activeFilePath,
  isOpen,
  onClose,
  activeLayerId,
  onSelectLayer,
}) => {
  const { palette } = useTheme();
  const [layers, setLayers] = useState<CanvasLayer[]>(DEFAULT_LAYERS);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newLayerName, setNewLayerName] = useState('');
  const [isAddingLayer, setIsAddingLayer] = useState(false);
  const [newLayerScope, setNewLayerScope] = useState<LayerScope>('ALL_FILES');

  // Synchronize layers from Yjs Array
  useEffect(() => {
    if (!ydoc) return;
    const yLayers = ydoc.getArray<string>('room-layers');

    const handleYjsUpdate = () => {
      const serialized = yLayers.toArray();
      if (serialized.length > 0) {
        try {
          const parsed = serialized.map((str, index) => {
            const raw = JSON.parse(str);
            const isVisible = raw.visible !== undefined ? Boolean(raw.visible) : (raw.isVisible !== undefined ? Boolean(raw.isVisible) : true);
            const isLocked = raw.locked !== undefined ? Boolean(raw.locked) : (raw.isLocked !== undefined ? Boolean(raw.isLocked) : false);
            const scope: LayerScope = raw.scope === 'ACTIVE_FILE_ONLY' || raw.mode === 'context-bound'
              ? 'ACTIVE_FILE_ONLY'
              : 'ALL_FILES';

            return {
              id: raw.id || `layer-${index}`,
              name: raw.name || `Layer ${index + 1}`,
              visible: isVisible,
              locked: isLocked,
              scope,
              boundFilePath: raw.boundFilePath,
              zIndex: typeof raw.zIndex === 'number' ? raw.zIndex : index,
              isVisible,
              isLocked,
              mode: scope,
              colorHex: raw.colorHex || '#3B82F6',
            } as CanvasLayer;
          });
          // Sort by zIndex ascending
          parsed.sort((a, b) => a.zIndex - b.zIndex);
          setLayers(parsed);
        } catch (e) {
          console.warn('[LayerManager] Failed to parse Yjs layers:', e);
        }
      } else {
        // Try to rehydrate from localStorage workspace layers before defaulting
        let initialToUse = DEFAULT_LAYERS;
        try {
          const cached = localStorage.getItem('pg_workspace_layers');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialToUse = parsed;
            }
          }
        } catch {}

        ydoc.transact(() => {
          yLayers.push(initialToUse.map((l) => JSON.stringify(l)));
        });
      }
    };

    handleYjsUpdate();
    yLayers.observe(handleYjsUpdate);

    return () => {
      yLayers.unobserve(handleYjsUpdate);
    };
  }, [ydoc]);

  // Push layers update to Yjs and localStorage
  const persistLayers = useCallback(
    (updatedLayers: CanvasLayer[]) => {
      // Re-normalize zIndex and ensure file-bound layers have boundFilePath
      const normalized = updatedLayers.map((l, idx) => ({
        ...l,
        zIndex: idx,
        isVisible: l.visible,
        isLocked: l.locked,
        mode: l.scope,
        boundFilePath: l.scope === 'ACTIVE_FILE_ONLY' ? (l.boundFilePath || activeFilePath || undefined) : undefined,
      }));
      setLayers(normalized);

      try {
        localStorage.setItem('pg_workspace_layers', JSON.stringify(normalized));
      } catch {}

      if (!ydoc) return;
      const yLayers = ydoc.getArray<string>('room-layers');
      ydoc.transact(() => {
        yLayers.delete(0, yLayers.length);
        yLayers.push(normalized.map((l) => JSON.stringify(l)));
      });
    },
    [ydoc, activeFilePath]
  );

  // Apply visibility and lock states to Tldraw shapes whenever layers, activeFilePath, or activeLayerId change
  useEffect(() => {
    if (!editor) return;

    try {
      const allShapes = editor.getCurrentPageShapes();
      if (!allShapes || allShapes.length === 0) return;

      const currentTool = editor.getCurrentToolId();
      const updates: any[] = [];
      const hiddenShapeIds: string[] = [];

      allShapes.forEach((shape) => {
        const shapeMeta = (shape.meta || {}) as { layerId?: string };
        const shapeLayerId = shapeMeta.layerId || 'layer-base';
        const layer = layers.find((l) => l.id === shapeLayerId);

        let shouldBeVisible = true;
        let shouldBeLocked = false;

        if (layer) {
          const isVisible = layer.visible !== undefined ? layer.visible : (layer.isVisible ?? true);
          const isLocked = layer.locked !== undefined ? layer.locked : (layer.isLocked ?? false);

          if (!isVisible) {
            shouldBeVisible = false;
          } else if (layer.scope === 'ACTIVE_FILE_ONLY' || layer.mode === 'context-bound') {
            // Scope check: layer bound to a file is ONLY visible when that exact file is active
            const normBound = (layer.boundFilePath || '').replace(/^\/+/, '');
            const normActive = (activeFilePath || '').replace(/^\/+/, '');
            if (!normBound || normBound !== normActive) {
              shouldBeVisible = false;
            }
          }
          // When hidden, shapes must be locked so they cannot be selected or dragged
          shouldBeLocked = isLocked || !shouldBeVisible;
        }

        // Eraser Tool Isolation: When using Eraser, lock shapes that don't belong to the active layer
        if (currentTool === 'eraser' && shapeLayerId !== activeLayerId) {
          shouldBeLocked = true;
        }

        if (!shouldBeVisible) {
          hiddenShapeIds.push(shape.id);
        }

        const targetOpacity = shouldBeVisible ? 1 : 0;
        if (shape.opacity !== targetOpacity || shape.isLocked !== shouldBeLocked) {
          updates.push({
            id: shape.id,
            type: shape.type,
            opacity: targetOpacity,
            isLocked: shouldBeLocked,
          });
        }
      });

      if (updates.length > 0) {
        editor.updateShapes(updates);
      }

      // Immediately deselect any shapes that have become hidden
      const selectedIds = editor.getSelectedShapeIds();
      const selectedHiddenIds = selectedIds.filter((id) => hiddenShapeIds.includes(id));
      if (selectedHiddenIds.length > 0) {
        editor.deselect(...selectedHiddenIds);
      }
    } catch (err) {
      console.warn('[LayerManager] Failed to synchronize shape visibility/locking:', err);
    }
  }, [editor, layers, activeFilePath, activeLayerId]);

  if (!isOpen) return null;

  const toggleLayerVisibility = (id: string) => {
    const next = layers.map((layer) =>
      layer.id === id
        ? { ...layer, visible: !layer.visible, isVisible: !layer.visible }
        : layer
    );
    persistLayers(next);
  };

  const toggleLayerLock = (id: string) => {
    const next = layers.map((layer) =>
      layer.id === id
        ? { ...layer, locked: !layer.locked, isLocked: !layer.locked }
        : layer
    );
    persistLayers(next);
  };

  const toggleLayerScope = (id: string) => {
    const next: CanvasLayer[] = layers.map((layer) => {
      if (layer.id === id) {
        const newScope: LayerScope = layer.scope === 'ALL_FILES' ? 'ACTIVE_FILE_ONLY' : 'ALL_FILES';
        return {
          ...layer,
          scope: newScope,
          mode: newScope,
          boundFilePath: newScope === 'ACTIVE_FILE_ONLY' ? activeFilePath || undefined : undefined,
        };
      }
      return layer;
    });
    persistLayers(next);
  };

  const handleStartRename = (layer: CanvasLayer) => {
    setEditingLayerId(layer.id);
    setEditName(layer.name);
  };

  const handleSaveRename = (id: string) => {
    if (!editName.trim()) return;
    const next = layers.map((layer) =>
      layer.id === id ? { ...layer, name: editName.trim() } : layer
    );
    persistLayers(next);
    setEditingLayerId(null);
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;

    // Delete all shapes belonging to this layer permanently
    if (editor) {
      try {
        const allShapes = editor.getCurrentPageShapes();
        const shapesInLayer = allShapes.filter(
          (s) => ((s.meta as Record<string, unknown>)?.layerId) === id
        );
        if (shapesInLayer.length > 0) {
          editor.deleteShapes(shapesInLayer.map((s) => s.id));
        }
      } catch (err) {
        console.warn('[LayerManager] Failed to delete shapes in layer:', err);
      }
    }

    const next = layers.filter((l) => l.id !== id);
    persistLayers(next);
    if (activeLayerId === id) {
      onSelectLayer(next[0].id);
    }
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layers.length) return;
    const reordered = [...layers];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    persistLayers(reordered);
  };

  const handleAddLayer = () => {
    if (!newLayerName.trim()) return;
    const newLayer: CanvasLayer = {
      id: `layer-${Date.now()}`,
      name: newLayerName.trim(),
      visible: true,
      locked: false,
      scope: newLayerScope,
      boundFilePath: newLayerScope === 'ACTIVE_FILE_ONLY' ? activeFilePath || 'root' : undefined,
      zIndex: layers.length,
      isVisible: true,
      isLocked: false,
      mode: newLayerScope,
      colorHex: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6'][layers.length % 5],
    };

    persistLayers([...layers, newLayer]);
    onSelectLayer(newLayer.id);
    setNewLayerName('');
    setIsAddingLayer(false);
  };

  return (
    <div
      className="fixed bottom-20 right-8 z-40 w-80 rounded-xl shadow-2xl border flex flex-col font-mono text-xs backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-200"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.surfaceBorder,
        color: palette.text,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 border-b"
        style={{ borderColor: palette.surfaceBorder }}
      >
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4" style={{ color: palette.accent }} />
          <span className="font-semibold text-sm tracking-tight">Canvas Layers</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: `${palette.accent}20`, color: palette.accent }}
          >
            {layers.length}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsAddingLayer(true)}
            className={`p-1 rounded transition-colors ${palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="Add Layer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="Close Layers Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {layers.map((layer, idx) => {
          const isActive = activeLayerId === layer.id;
          const isContextMismatch =
            layer.scope === 'ACTIVE_FILE_ONLY' &&
            layer.boundFilePath &&
            layer.boundFilePath !== activeFilePath;

          return (
            <div
              key={layer.id}
              onClick={() => {
                onSelectLayer(layer.id);
                if (!layer.visible) {
                  toggleLayerVisibility(layer.id);
                }
              }}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                isActive
                  ? palette.isDark ? 'bg-white/15 font-semibold' : 'bg-black/10 font-semibold'
                  : palette.isDark ? 'hover:bg-white/5 opacity-80 hover:opacity-100' : 'hover:bg-black/5 opacity-80 hover:opacity-100'
              }`}
            >
              {/* Left: Color pip + Name + Scope indicator */}
              <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: layer.colorHex || palette.accent }}
                />

                {editingLayerId === layer.id ? (
                  <div className="flex items-center space-x-1 flex-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="border rounded px-1.5 py-0.5 text-xs focus:outline-none w-full transition-colors"
                      style={{
                        backgroundColor: palette.isDark ? 'rgba(0,0,0,0.3)' : '#ffffff',
                        borderColor: palette.surfaceBorder,
                        color: palette.text,
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveRename(layer.id)}
                      className="p-1 hover:text-emerald-500 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="truncate flex flex-col">
                    <span className="truncate">{layer.name}</span>
                    {layer.scope === 'ACTIVE_FILE_ONLY' && (
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded border font-mono truncate max-w-[130px] ${
                            isContextMismatch
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          }`}
                          title={`Bound to: ${layer.boundFilePath || activeFilePath || 'none'}`}
                        >
                          {isContextMismatch ? `Hidden (${layer.boundFilePath || 'none'})` : `Active: ${layer.boundFilePath || 'this file'}`}
                        </span>
                        {isContextMismatch && activeFilePath && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = layers.map((l) =>
                                l.id === layer.id ? { ...l, boundFilePath: activeFilePath } : l
                              );
                              persistLayers(next);
                            }}
                            className="text-[9px] underline opacity-70 hover:opacity-100 hover:text-blue-400"
                            title="Rebind layer to current file"
                          >
                            Rebind
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Action Controls */}
              <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Scope Toggle: ALL_FILES vs ACTIVE_FILE_ONLY */}
                <button
                  onClick={() => toggleLayerScope(layer.id)}
                  className={`p-1 rounded transition-colors ${
                    layer.scope === 'ACTIVE_FILE_ONLY'
                      ? 'text-amber-500 bg-amber-500/10'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ color: layer.scope === 'ACTIVE_FILE_ONLY' ? undefined : palette.text }}
                  title={
                    layer.scope === 'ACTIVE_FILE_ONLY'
                      ? `Active File Only: bound to ${layer.boundFilePath || activeFilePath || 'file'}`
                      : 'All Files: Global layer visible across workspace'
                  }
                >
                  {layer.scope === 'ACTIVE_FILE_ONLY' ? (
                    <FileCode className="w-3.5 h-3.5" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Lock Toggle */}
                <button
                  onClick={() => toggleLayerLock(layer.id)}
                  className={`p-1 rounded transition-colors ${
                    layer.locked
                      ? 'text-red-500 bg-red-500/10'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ color: layer.locked ? undefined : palette.text }}
                  title={layer.locked ? 'Locked (Shapes non-editable)' : 'Unlocked'}
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                {/* Visibility Toggle */}
                <button
                  onClick={() => toggleLayerVisibility(layer.id)}
                  className={`p-1 rounded transition-colors ${
                    layer.visible && !isContextMismatch
                      ? 'opacity-100'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                  style={{ color: palette.text }}
                  title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                >
                  {layer.visible && !isContextMismatch ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Reorder Up */}
                <button
                  disabled={idx === 0}
                  onClick={() => moveLayer(idx, 'up')}
                  className="p-1 rounded opacity-70 hover:opacity-100 disabled:opacity-20 transition-colors"
                  style={{ color: palette.text }}
                  title="Move Layer Up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>

                {/* Reorder Down */}
                <button
                  disabled={idx === layers.length - 1}
                  onClick={() => moveLayer(idx, 'down')}
                  className="p-1 rounded opacity-70 hover:opacity-100 disabled:opacity-20 transition-colors"
                  style={{ color: palette.text }}
                  title="Move Layer Down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {/* Rename */}
                {editingLayerId !== layer.id && (
                  <button
                    onClick={() => handleStartRename(layer)}
                    className="p-1 rounded opacity-70 hover:opacity-100 transition-colors"
                    style={{ color: palette.text }}
                    title="Rename"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete */}
                {layers.length > 1 && (
                  <button
                    onClick={() => handleDeleteLayer(layer.id)}
                    className="p-1 rounded opacity-70 hover:opacity-100 text-red-500 transition-colors"
                    title="Delete Layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Layer Form */}
      {isAddingLayer && (
        <div
          className="p-3 border-t space-y-2"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: palette.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
          }}
        >
          <input
            type="text"
            placeholder="Layer name (e.g. Architecture Flow, Security)..."
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            className="w-full border rounded px-2.5 py-1 text-xs focus:outline-none transition-colors"
            style={{
              backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
              borderColor: palette.surfaceBorder,
              color: palette.text,
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddLayer();
              if (e.key === 'Escape') setIsAddingLayer(false);
            }}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setNewLayerScope('ALL_FILES')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors border ${
                  newLayerScope === 'ALL_FILES'
                    ? 'bg-blue-500/20 text-blue-500 border-blue-500/40 font-semibold'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                style={{ color: newLayerScope === 'ALL_FILES' ? undefined : palette.text }}
              >
                All Files
              </button>
              <button
                type="button"
                onClick={() => setNewLayerScope('ACTIVE_FILE_ONLY')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors border ${
                  newLayerScope === 'ACTIVE_FILE_ONLY'
                    ? 'bg-amber-500/20 text-amber-500 border-amber-500/40 font-semibold'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                style={{ color: newLayerScope === 'ACTIVE_FILE_ONLY' ? undefined : palette.text }}
              >
                Active File Only
              </button>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setIsAddingLayer(false)}
                className="px-2 py-1 rounded text-[10px] opacity-70 hover:opacity-100 transition-opacity"
                style={{ color: palette.text }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddLayer}
                className="px-2.5 py-1 rounded text-[10px] font-bold transition-opacity hover:opacity-90 shadow-sm"
                style={{
                  backgroundColor: palette.accent,
                  color: palette.isDark ? '#09090B' : '#FFFFFF',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayerManager;
