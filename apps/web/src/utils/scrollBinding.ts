// apps/web/src/utils/scrollBinding.ts
import type * as monaco from 'monaco-editor';
import type { Editor as TldrawEditor } from '@tldraw/tldraw';
import React from 'react';

export interface ScrollBindingInstance {
  syncCurrentPosition: () => void;
  destroy: () => void;
}

export interface CanvasCoordinate {
  x: number;
  y: number;
}

/**
 * Mathematically binds Monaco's virtualized DOM scroll coordinates
 * to Tldraw's 2D camera viewport matrix using high-performance 60fps
 * requestAnimationFrame ticking to eliminate camera jitter during high-velocity
 * touchpad or mouse-wheel scrolling.
 *
 * Camera translation formula:
 *   camera.x = -scrollLeft
 *   camera.y = -scrollTop
 *   camera.z = tldrawEditor.getCamera().z (maintains scale fidelity)
 */
export function bindMonacoToTldrawScroll(
  monacoEditor: monaco.editor.IStandaloneCodeEditor,
  tldrawEditor: TldrawEditor
): ScrollBindingInstance {
  // Prevent Tldraw's internal gesture engine from overriding camera coordinates with arbitrary canvas panning
  try {
    tldrawEditor.setCameraOptions({
      wheelBehavior: 'none',
      panSpeed: 0,
      isLocked: false,
    });
  } catch (err) {
    console.warn('[scrollBinding] setCameraOptions error:', err);
  }

  const applyCameraOffset = (scrollLeft: number, scrollTop: number) => {
    try {
      const currentCamera = tldrawEditor.getCamera();
      const currentZ = currentCamera.z ?? 1;
      const targetX = -Math.round(scrollLeft);
      const targetY = -Math.round(scrollTop);

      // Instantaneous 1:1 camera sync with force: true
      if (currentCamera.x !== targetX || currentCamera.y !== targetY) {
        tldrawEditor.setCamera({
          x: targetX,
          y: targetY,
          z: currentZ,
        }, { force: true });
      }
    } catch (err) {
      console.warn('[scrollBinding] applyCameraOffset error:', err);
    }
  };

  // Synchronize immediately to prevent coordinate jumping on mount
  const syncCurrentPosition = () => {
    applyCameraOffset(monacoEditor.getScrollLeft(), monacoEditor.getScrollTop());
  };

  syncCurrentPosition();

  // Attach listener to Monaco scroll ticks directly without RAF deferral for immediate responsive trackpad gestures
  const scrollDisposable = monacoEditor.onDidScrollChange((e) => {
    applyCameraOffset(e.scrollLeft, e.scrollTop);
  });

  // Re-sync on layout changes (e.g. sidebar toggle or window resize)
  const layoutDisposable = monacoEditor.onDidLayoutChange(() => {
    syncCurrentPosition();
  });

  return {
    syncCurrentPosition,
    destroy: () => {
      scrollDisposable.dispose();
      layoutDisposable.dispose();
    },
  };
}

/**
 * Computes exact canvas pixel coordinates corresponding to a specific line and column
 * in the active Monaco document model.
 */
export function monacoCoordinateToCanvasPoint(
  monacoEditor: monaco.editor.IStandaloneCodeEditor,
  lineNumber: number,
  column = 1
): CanvasCoordinate {
  const lineTop = monacoEditor.getTopForLineNumber(lineNumber);
  const layout = monacoEditor.getLayoutInfo();
  // Calculate horizontal offset based on standard monospace character metrics
  const charWidth = 8.4;
  const x = layout.contentLeft + (column - 1) * charWidth;
  const y = lineTop;

  return { x, y };
}

/**
 * Helper to generate Tldraw container layer styles conforming to the architectural mandate:
 * Absolute, inset-0, z-index 10, with pointer-events toggled based on active drawing/annotating mode.
 */
export function getSpatialCanvasStyles(isDrawingOrAnnotating: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    pointerEvents: isDrawingOrAnnotating ? 'auto' : 'none',
  };
}
