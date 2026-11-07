// apps/web/src/services/codeExecution.ts
import * as Y from 'yjs';
import type * as monaco from 'monaco-editor';
import type { Editor as TldrawEditor } from '@tldraw/tldraw';
import { createShapeId } from '@tldraw/tldraw';
import { transform } from 'sucrase';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';

export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorLine?: number;
  errorMessage?: string;
  exitCode?: number;
}

const WANDBOX_LANG_MAP: Record<string, string> = {
  // Python
  py: 'cpython-3.12.7',
  python: 'cpython-3.12.7',
  python3: 'cpython-3.12.7',

  // TypeScript / JavaScript
  ts: 'typescript-5.6.2',
  tsx: 'typescript-5.6.2',
  typescript: 'typescript-5.6.2',
  js: 'nodejs-20.17.0',
  jsx: 'nodejs-20.17.0',
  javascript: 'nodejs-20.17.0',
  mjs: 'nodejs-20.17.0',
  cjs: 'nodejs-20.17.0',

  // C / C++
  c: 'gcc-head-c',
  cpp: 'gcc-head',
  'c++': 'gcc-head',
  cc: 'gcc-head',
  cxx: 'gcc-head',

  // Rust
  rs: 'rust-1.82.0',
  rust: 'rust-1.82.0',

  // Go
  go: 'go-1.23.2',
  golang: 'go-1.23.2',

  // Java
  java: 'openjdk-jdk-22+36',

  // Bash / Shell
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',

  // Ruby
  rb: 'ruby-4.0.2',
  ruby: 'ruby-4.0.2',

  // PHP
  php: 'php-8.3.12',

  // Swift
  swift: 'swift-6.0.1',

  // C#
  cs: 'mono-6.12.0.199',
  csharp: 'mono-6.12.0.199',

  // SQL
  sql: 'sqlite-3.46.1',
  sqlite: 'sqlite-3.46.1',

  // Lua
  lua: 'lua-5.4.7',

  // Zig
  zig: 'zig-head',

  // Nim
  nim: 'nim-2.2.10',

  // R
  r: 'r-4.4.1',

  // Perl
  perl: 'perl-5.44.0',
};

/**
 * Extracts line numbers from stdout/stderr tracebacks across polyglot compilers.
 */
export function parseTracebackLine(output: string, language: string): { line: number; message: string } | null {
  if (!output) return null;

  // Python: File "...", line 12, in <module>
  const pyMatch = output.match(/File\s+["'][^"']+["'],\s+line\s+(\d+)(?:,\s+in\s+.*)?\n(?:\s+.*\n)?(?:\s*\^+\n)?(\w+Error:[^\n]+|\w+Exception:[^\n]+)/i);
  if (pyMatch) {
    return { line: parseInt(pyMatch[1], 10), message: pyMatch[2] || 'Python Runtime Error' };
  }

  // Rust: --> src/main.rs:14:5
  const rustMatch = output.match(/-->\s+[^:]+:(\d+):(\d+)\n.*error(?:\[E\d+\])?: ([^\n]+)/i);
  if (rustMatch) {
    return { line: parseInt(rustMatch[1], 10), message: rustMatch[3] || 'Rust Compilation Error' };
  }

  // Go: ./main.go:10:2: undefined: foo
  const goMatch = output.match(/[^:]+:(\d+):(?:\d+:)?\s*([^\n]+)/i);
  if (goMatch) {
    return { line: parseInt(goMatch[1], 10), message: goMatch[2] || 'Go Runtime Error' };
  }

  // C / C++: main.cpp:8:5: error: expected ';'
  const cppMatch = output.match(/[^:]+:(\d+):(?:\d+:)?\s*error:\s*([^\n]+)/i);
  if (cppMatch) {
    return { line: parseInt(cppMatch[1], 10), message: cppMatch[2] || 'C++ Compilation Error' };
  }

  // Java: Exception in thread "main" java.lang.NullPointerException at Main.java:14
  const javaMatch = output.match(/(?:Exception[^\n]+)\s+at\s+[^:]+:(\d+)/i);
  if (javaMatch) {
    return { line: parseInt(javaMatch[1], 10), message: 'Java Runtime Exception' };
  }

  // JavaScript / TypeScript: at <anonymous>:4:15 or ReferenceError: x is not defined at ...
  const jsMatch = output.match(/(?:at\s+.*:|\s+at\s+.*:)(\d+):(\d+)/i);
  const jsErrorMatch = output.match(/((?:Reference|Type|Syntax|Range|URI|Error)[^\n]+)/);
  if (jsMatch) {
    return { line: parseInt(jsMatch[1], 10), message: jsErrorMatch ? jsErrorMatch[1] : 'JavaScript Runtime Error' };
  }

  // Generic fallback: line 15 or :15:
  const genericMatch = output.match(/(?:line|Line)\s+(\d+)[:\s]+([^\n]+)/i);
  if (genericMatch) {
    return { line: parseInt(genericMatch[1], 10), message: genericMatch[2] };
  }

  return null;
}

/**
 * Projects a diagnostic error marker directly onto Monaco and inserts an anchored
 * Spatial Pin/Sticky Note on the Tldraw canvas at the exact line coordinate.
 */
export function pinSpatialErrorToCanvas(
  line: number,
  errorMessage: string,
  monacoEditor: monaco.editor.IStandaloneCodeEditor | null,
  tldrawEditor: TldrawEditor | null,
  monacoInstance?: typeof monaco | null
): void {
  if (!monacoEditor) return;

  // 1. Monaco Editor Markers: red squiggly at the line
  const model = monacoEditor.getModel();
  if (model && monacoInstance) {
    const maxCol = model.getLineMaxColumn(line);
    monacoInstance.editor.setModelMarkers(model, 'sandbox-execution', [
      {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: maxCol,
        message: errorMessage,
        severity: monacoInstance.MarkerSeverity.Error,
      },
    ]);
  }

  // 2. Spatial Pin to Tldraw Canvas
  if (tldrawEditor) {
    try {
      // Calculate pixel Y-position for the line in Monaco coordinates
      const lineTopPx = monacoEditor.getTopForLineNumber(line);
      const editorLayout = monacoEditor.getLayoutInfo();
      // Position sticky note just past the code content width
      const pinX = Math.min(editorLayout.width - 240, Math.max(300, editorLayout.contentLeft + 280));
      const pinY = Math.max(10, lineTopPx - 20);

      // Create a prominent red diagnostic sticky note on Tldraw
      const shapeId = createShapeId(`diagnostic-pin-line-${line}-${Date.now()}`);
      tldrawEditor.createShapes([
        {
          id: shapeId,
          type: 'geo',
          x: pinX,
          y: pinY,
          props: {
            geo: 'rectangle',
            w: 230,
            h: 70,
            color: 'red',
            fill: 'semi',
            size: 's',
            text: `🔴 Line ${line}: ${errorMessage.slice(0, 70)}`,
          },
        },
      ]);

      console.log(`📌 [Spatial Error Pin] Anchored diagnostic shape at (${pinX}, ${pinY}) for code line ${line}`);
    } catch (pinErr) {
      console.warn('[Spatial Error Pin] Could not anchor pin to Tldraw canvas:', pinErr);
    }
  }
}

/**
 * In-Browser TypeScript & JavaScript transpilation and execution engine.
 * Transpiles types, interfaces, and JSX with Sucrase in ~1ms,
 * provides CommonJS require/module shims and DOM shims for offline evaluation.
 */
export async function executeInBrowserJS(
  code: string,
  filePath: string,
  streamOutput: (chunk: string, isError?: boolean) => void,
  timeoutMs = 6000
): Promise<{ success: boolean; stdout: string; stderr: string; errorLine?: number; errorMessage?: string }> {
  let transpiledCode = code;

  // 1. Transpile TS / TSX / JSX using Sucrase
  try {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const isTS = ['ts', 'tsx'].includes(ext);
    const isJSX = ['jsx', 'tsx'].includes(ext);
    const transforms: ('typescript' | 'jsx' | 'imports')[] = ['imports'];
    if (isTS) transforms.push('typescript');
    if (isJSX) transforms.push('jsx');

    const result = transform(code, {
      transforms,
      disableESTransforms: true,
      production: true,
    });
    transpiledCode = result.code;
  } catch (transpileErr: any) {
    return {
      success: false,
      stdout: '',
      stderr: `TypeScript Syntax Error: ${transpileErr.message || String(transpileErr)}`,
      errorLine: transpileErr.loc?.line,
      errorMessage: transpileErr.message,
    };
  }

  let stdoutCaptured = '';
  let stderrCaptured = '';

  const serialize = (val: unknown): string => {
    if (typeof val === 'string') return val;
    if (val instanceof Error) return `${val.name}: ${val.message}\n${val.stack || ''}`;
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  const customConsole = {
    log: (...args: unknown[]) => {
      const msg = args.map(serialize).join(' ') + '\n';
      stdoutCaptured += msg;
      streamOutput(msg, false);
    },
    warn: (...args: unknown[]) => {
      const msg = args.map(serialize).join(' ') + '\n';
      stderrCaptured += msg;
      streamOutput(msg, true);
    },
    error: (...args: unknown[]) => {
      const msg = args.map(serialize).join(' ') + '\n';
      stderrCaptured += msg;
      streamOutput(msg, true);
    },
    info: (...args: unknown[]) => {
      const msg = args.map(serialize).join(' ') + '\n';
      stdoutCaptured += msg;
      streamOutput(msg, false);
    },
  };

  // Module and require shims
  const moduleObj = { exports: {} as Record<string, any> };
  const exportsObj = moduleObj.exports;
  const customRequire = (moduleName: string) => {
    if (moduleName === 'react') return (typeof window !== 'undefined' ? (window as any).React : null) || {};
    return {};
  };

  // Safe DOM shims
  const docShim = typeof window !== 'undefined' && window.document ? window.document : {
    getElementById: (id: string) => ({ id, innerHTML: '', style: {}, addEventListener: () => {} }),
    createElement: (tag: string) => ({ tagName: tag, innerHTML: '', style: {}, appendChild: () => {} }),
    body: { appendChild: () => {}, innerHTML: '' },
  };
  const winShim = typeof window !== 'undefined' ? window : {};

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const runner = new AsyncFunction('console', 'require', 'module', 'exports', 'document', 'window', transpiledCode);

    const execPromise = runner(customConsole, customRequire, moduleObj, exportsObj, docShim, winShim);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    await Promise.race([execPromise, timeoutPromise]);

    return {
      success: true,
      stdout: stdoutCaptured,
      stderr: stderrCaptured,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const stack = err?.stack || '';
    const fullErr = `${errorMsg}\n${stack}`;
    stderrCaptured += fullErr + '\n';

    const parsed = parseTracebackLine(fullErr, 'javascript');
    return {
      success: false,
      stdout: stdoutCaptured,
      stderr: stderrCaptured,
      errorLine: parsed?.line,
      errorMessage: errorMsg,
    };
  }
}

/**
 * Polyglot compiler execution via server endpoint or Wandbox direct fallback.
 */
async function executePolyglotCompiler(
  code: string,
  filePath: string,
  streamOutput: (chunk: string, isError?: boolean) => void
): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number; durationMs: number }> {
  const ext = filePath.split('.').pop()?.toLowerCase() || 'py';
  const startTime = performance.now();

  // 1. Try server endpoint /api/compiler/execute first
  try {
    const res = await fetch(`${SERVER_URL}/api/compiler/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: ext,
        code,
      }),
      signal: AbortSignal.timeout(18000),
    });

    if (res.ok) {
      const data = await res.json();
      const stdout = data.stdout || '';
      const stderr = data.stderr || '';
      const durationMs = data.durationMs || Math.round(performance.now() - startTime);

      if (stdout) streamOutput(stdout + (stdout.endsWith('\n') ? '' : '\n'), false);
      if (stderr) streamOutput(stderr + (stderr.endsWith('\n') ? '' : '\n'), true);

      return {
        success: data.success,
        stdout,
        stderr,
        exitCode: data.exitCode ?? (data.success ? 0 : 1),
        durationMs,
      };
    }
  } catch (serverErr) {
    console.warn('[Compiler] Server endpoint unavailable, falling back to direct Wandbox API:', serverErr);
  }

  // 2. Direct fallback to Wandbox API
  const compiler = WANDBOX_LANG_MAP[ext] || ext;
  try {
    const wandboxRes = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler,
        code,
      }),
      signal: AbortSignal.timeout(18000),
    });

    const durationMs = Math.round(performance.now() - startTime);
    if (!wandboxRes.ok) {
      const text = await wandboxRes.text().catch(() => 'Compiler service error');
      streamOutput(`\n❌ Compiler service returned status ${wandboxRes.status}: ${text}\n`, true);
      return { success: false, stdout: '', stderr: text, exitCode: 1, durationMs };
    }

    const data: any = await wandboxRes.json();
    const stdout = (data.program_output || '').trimEnd();
    const compilerMsg = (data.compiler_error || data.compiler_message || '').trimEnd();
    const programErr = (data.program_error || '').trimEnd();
    const stderr = [compilerMsg, programErr].filter(Boolean).join('\n');
    const exitCode = parseInt(data.status || '0', 10);
    const success = exitCode === 0 && !data.signal;

    if (stdout) streamOutput(stdout + '\n', false);
    if (stderr) streamOutput(stderr + '\n', true);

    return {
      success,
      stdout,
      stderr,
      exitCode,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    const msg = err.message || 'Compiler execution request failed or timed out';
    streamOutput(`\n❌ Execution failed: ${msg}\n`, true);
    return {
      success: false,
      stdout: '',
      stderr: msg,
      exitCode: 1,
      durationMs,
    };
  }
}

/**
 * Executes code across polyglot compilers or in-browser JS/TS engine,
 * streams stdout/stderr collaboratively into Y.Text('terminal-output'),
 * and automatically pins diagnostic markers to code coordinates on errors.
 */
export async function executeCodeInSandbox(options: {
  code: string;
  filePath: string;
  ydoc?: Y.Doc | null;
  monacoEditor?: monaco.editor.IStandaloneCodeEditor | null;
  tldrawEditor?: TldrawEditor | null;
  monacoInstance?: typeof monaco | null;
  onOutputChunk?: (chunk: string, isError: boolean) => void;
}): Promise<ExecutionResult> {
  const { code, filePath, ydoc, monacoEditor, tldrawEditor, monacoInstance, onOutputChunk } = options;
  const ext = filePath.split('.').pop()?.toLowerCase() || 'ts';

  // Clear previous execution markers in Monaco
  if (monacoEditor && monacoInstance) {
    const model = monacoEditor.getModel();
    if (model) {
      monacoInstance.editor.setModelMarkers(model, 'sandbox-execution', []);
    }
  }

  // Collaborative Y.Text terminal output streaming
  const terminalText = ydoc ? ydoc.getText('terminal-output') : null;
  if (terminalText) {
    terminalText.delete(0, terminalText.length);
    terminalText.insert(0, `⚡ Executing ${filePath}...\n`);
  }

  const streamOutput = (text: string, isError = false) => {
    if (terminalText) {
      terminalText.insert(terminalText.length, text);
    }
    if (onOutputChunk) {
      onOutputChunk(text, isError);
    }
  };

  const isJavaScript = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext);

  if (isJavaScript) {
    const startTime = performance.now();
    streamOutput(`⚡ In-Browser Transpiler (Sucrase TypeScript / JSX Engine)...\n`);

    const result = await executeInBrowserJS(code, filePath, streamOutput);
    const durationMs = Math.round(performance.now() - startTime);

    if (result.success) {
      streamOutput(`\nProcess finished with exit code 0 (${durationMs}ms)\n`);
      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs,
        exitCode: 0,
      };
    }

    // If client in-browser execution had a runtime/syntax error, check if we should attempt server-side Node execution
    if (result.stderr.includes('require(') || result.stderr.includes('Cannot find module')) {
      streamOutput(`\n🔄 Attempting server-side polyglot execution fallback...\n`);
      const polyResult = await executePolyglotCompiler(code, filePath, streamOutput);
      return {
        ...polyResult,
        errorLine: result.errorLine,
        errorMessage: result.errorMessage,
      };
    }

    // Pin error to canvas if line was detected
    if (result.errorLine && result.errorMessage) {
      pinSpatialErrorToCanvas(result.errorLine, result.errorMessage, monacoEditor || null, tldrawEditor || null, monacoInstance);
    }

    streamOutput(`\nProcess finished with exit code 1 (${durationMs}ms)\n`, true);
    return {
      success: false,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs,
      errorLine: result.errorLine,
      errorMessage: result.errorMessage,
      exitCode: 1,
    };
  }

  // Polyglot execution via server compiler or Wandbox
  const compiler = WANDBOX_LANG_MAP[ext] || ext;
  streamOutput(`🌐 Dispatching to isolated container (${compiler})...\n`);

  const polyResult = await executePolyglotCompiler(code, filePath, streamOutput);

  // Pin traceback diagnostic marker if an error occurred
  let errorLine: number | undefined;
  let errorMessage: string | undefined;

  if (!polyResult.success && (polyResult.stderr || polyResult.stdout)) {
    const parsed = parseTracebackLine(polyResult.stderr || polyResult.stdout, ext);
    if (parsed) {
      errorLine = parsed.line;
      errorMessage = parsed.message;
      pinSpatialErrorToCanvas(errorLine, errorMessage, monacoEditor || null, tldrawEditor || null, monacoInstance);
    }
  }

  streamOutput(`\nProcess finished with exit code ${polyResult.exitCode} (${polyResult.durationMs}ms)\n`);

  return {
    success: polyResult.success,
    stdout: polyResult.stdout,
    stderr: polyResult.stderr,
    durationMs: polyResult.durationMs,
    errorLine,
    errorMessage,
    exitCode: polyResult.exitCode,
  };
}
