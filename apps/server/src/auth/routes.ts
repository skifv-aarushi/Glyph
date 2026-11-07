import { Router, Request, Response } from 'express';
import { config } from '../config/index';
import { signAuthToken, verifyAuthToken } from './jwt';
import { AuthStatusResponse, AuthUser } from '@glyph/shared';

const router = Router();

/**
 * Initiates the GitHub OAuth 2.0 flow
 */
router.get('/github', (req: Request, res: Response) => {
  if (!config.github.clientId) {
    return res.status(500).json({
      error: 'GitHub Client ID is not configured on the server.',
    });
  }

  // Preserve the caller origin (e.g. https://glyph-ebon.vercel.app) in state so callback returns there accurately
  const returnOrigin = (req.query.origin as string) || req.headers.referer || config.clientOrigin || 'https://glyph-ebon.vercel.app';
  const statePayload = Buffer.from(JSON.stringify({
    nonce: Math.random().toString(36).substring(2, 15),
    returnTo: returnOrigin.replace(/\/$/, '')
  })).toString('base64');

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', config.github.clientId);
  authUrl.searchParams.set('redirect_uri', config.github.callbackUrl);
  authUrl.searchParams.set('scope', config.github.scopes);
  authUrl.searchParams.set('state', statePayload);

  res.redirect(authUrl.toString());
});

/**
 * Handles GitHub OAuth 2.0 callback
 */
router.get('/github/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const rawState = req.query.state as string;

  let redirectTarget = config.clientOrigin.replace(/\/$/, '');
  if (rawState) {
    try {
      const parsedState = JSON.parse(Buffer.from(rawState, 'base64').toString('utf-8'));
      if (parsedState.returnTo) {
        redirectTarget = parsedState.returnTo;
      }
    } catch {}
  }

  if (error || !code) {
    console.error('[OAuth] Callback error or missing code:', error);
    return res.redirect(`${redirectTarget}?auth_error=${encodeURIComponent(error || 'missing_code')}`);
  }

  try {
    // 1. Exchange temporary code for GitHub access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Glyph-App',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      console.error('[OAuth] Token exchange failed:', tokenData);
      return res.redirect(
        `${redirectTarget}?auth_error=${encodeURIComponent(tokenData.error_description || 'token_exchange_failed')}`
      );
    }

    const githubToken = tokenData.access_token;

    // 2. Fetch authenticated GitHub user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glyph-App',
      },
    });

    if (!userResponse.ok) {
      console.error('[OAuth] Failed to fetch user profile:', userResponse.statusText);
      return res.redirect(`${redirectTarget}?auth_error=profile_fetch_failed`);
    }

    const userData = (await userResponse.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
      email?: string | null;
    };

    const user: AuthUser = {
      id: userData.id,
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
      email: userData.email || null,
    };

    // 3. Sign JWT containing GitHub token and profile
    const signedJwt = signAuthToken({ githubToken, user });

    // 4. Set secure cross-site cookie
    res.cookie(config.cookieName, signedJwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // 5. Redirect back to client app with auth_success and token for immediate localStorage sync
    return res.redirect(`${redirectTarget}?auth_success=true&token=${encodeURIComponent(signedJwt)}`);
  } catch (err: any) {
    console.error('[OAuth] Exception in GitHub callback:', err);
    return res.redirect(`${redirectTarget}?auth_error=internal_server_error`);
  }
});

/**
 * Authenticate directly via a GitHub Personal Access Token (PAT)
 */
router.post('/token', async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'GitHub Personal Access Token is required.' });
  }

  const cleanToken = token.trim();

  try {
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glyph-App',
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({
        error: 'Invalid GitHub token. Please verify your token and scopes.',
      });
    }

    const userData = (await userResponse.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
      email?: string | null;
    };

    const user: AuthUser = {
      id: userData.id,
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
      email: userData.email || null,
    };

    const signedJwt = signAuthToken({ githubToken: cleanToken, user });

    res.cookie(config.cookieName, signedJwt, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, user });
  } catch (err: any) {
    console.error('[Auth Token] Verification error:', err);
    return res.status(500).json({ error: err.message || 'Failed to verify token with GitHub.' });
  }
});

/**
 * Instant Guest / Demo Authentication
 */
router.post('/guest', (req: Request, res: Response) => {
  const requestedUsername = req.body?.username?.trim();
  const guestId = Math.floor(10000 + Math.random() * 90000);
  const login = requestedUsername || `dev_guest_${guestId}`;

  const user: AuthUser = {
    id: guestId,
    login,
    name: requestedUsername ? `${requestedUsername} (Guest)` : `Guest Developer ${guestId}`,
    avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${login}`,
    email: null,
  };

  const signedJwt = signAuthToken({
    githubToken: config.github.fallbackToken || '',
    user,
  });

  res.cookie(config.cookieName, signedJwt, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ success: true, user });
});

/**
 * Returns the current authentication status and user details
 */
router.get('/status', (req: Request, res: Response) => {
  const token = req.cookies[config.cookieName];

  if (!token) {
    const response: AuthStatusResponse = { authenticated: false, user: null };
    return res.json(response);
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    // Clear invalid/expired cookie with matching flags
    res.clearCookie(config.cookieName, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      path: '/',
    });
    const response: AuthStatusResponse = { authenticated: false, user: null };
    return res.json(response);
  }

  const response: AuthStatusResponse = {
    authenticated: true,
    user: payload.user,
  };
  return res.json(response);
});

/**
 * Logs out the user by clearing the HTTP-only cookie
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    path: '/',
  });
  return res.json({ success: true });
});

export default router;

