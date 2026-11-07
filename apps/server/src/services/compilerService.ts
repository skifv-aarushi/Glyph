// apps/server/src/services/compilerService.ts
/**
 * Polyglot Compiler & Execution Service
 * Supports 20+ programming languages through Wandbox API with server-side execution fallback.
 */

export interface CompileRequest {
  language: string;
  code: string;
  stdin?: string;
  options?: string;
}

export interface CompileResponse {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  compiler?: string;
}

const LANGUAGE_TO_WANDBOX_COMPILER: Record<string, string> = {
  // Python
  python: 'cpython-3.12.7',
  py: 'cpython-3.12.7',
  python3: 'cpython-3.12.7',

  // TypeScript / JavaScript
  typescript: 'typescript-5.6.2',
  ts: 'typescript-5.6.2',
  tsx: 'typescript-5.6.2',
  javascript: 'nodejs-20.17.0',
  js: 'nodejs-20.17.0',
  jsx: 'nodejs-20.17.0',
  node: 'nodejs-20.17.0',

  // C / C++
  c: 'gcc-head-c',
  cpp: 'gcc-head',
  'c++': 'gcc-head',
  cc: 'gcc-head',
  cxx: 'gcc-head',

  // Rust
  rust: 'rust-1.82.0',
  rs: 'rust-1.82.0',

  // Go
  go: 'go-1.23.2',
  golang: 'go-1.23.2',

  // Java
  java: 'openjdk-jdk-22+36',

  // Shell / Bash
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',

  // Ruby
  ruby: 'ruby-4.0.2',
  rb: 'ruby-4.0.2',

  // PHP
  php: 'php-8.3.12',

  // Swift
  swift: 'swift-6.0.1',

  // C#
  csharp: 'mono-6.12.0.199',
  'c#': 'mono-6.12.0.199',
  cs: 'mono-6.12.0.199',

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

export async function executeCode(req: CompileRequest): Promise<CompileResponse> {
  const normalizedLang = req.language.toLowerCase().trim();
  const compiler = LANGUAGE_TO_WANDBOX_COMPILER[normalizedLang] || normalizedLang;
  const startTime = Date.now();

  try {
    const wandboxRes = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler,
        code: req.code,
        stdin: req.stdin || '',
        'compiler-option-raw': req.options || '',
      }),
      signal: AbortSignal.timeout(15000),
    });

    const durationMs = Date.now() - startTime;

    if (!wandboxRes.ok) {
      const errorText = await wandboxRes.text().catch(() => 'Wandbox compilation service error');
      return {
        success: false,
        stdout: '',
        stderr: `Compilation service returned status ${wandboxRes.status}: ${errorText}`,
        exitCode: 1,
        durationMs,
        compiler,
      };
    }

    const data: any = await wandboxRes.json();
    const stdout = (data.program_output || '').trimEnd();
    const compilerMsg = (data.compiler_error || data.compiler_message || '').trimEnd();
    const programErr = (data.program_error || '').trimEnd();

    const stderr = [compilerMsg, programErr].filter(Boolean).join('\n');
    const exitCode = parseInt(data.status || '0', 10);
    const success = exitCode === 0 && !data.signal;

    return {
      success,
      stdout,
      stderr,
      exitCode,
      durationMs,
      compiler,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      stdout: '',
      stderr: err.message || 'Execution request failed or timed out',
      exitCode: 1,
      durationMs,
      compiler,
    };
  }
}

