// apps/server/src/routes/compiler.ts
import { Router, Request, Response } from 'express';
import { executeCode, CompileRequest } from '../services/compilerService';

const router = Router();

/**
 * POST /api/compiler/execute
 * Executes code in Python, C++, C, Rust, Go, TypeScript, Java, Bash, etc.
 */
router.post('/execute', async (req: Request, res: Response) => {
  const { language, code, stdin, options } = req.body as CompileRequest;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing required string parameter: "code"',
    });
  }

  const lang = (language || 'javascript').toString();

  try {
    const result = await executeCode({
      language: lang,
      code,
      stdin,
      options,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Internal compiler service failure',
    });
  }
});

export default router;

