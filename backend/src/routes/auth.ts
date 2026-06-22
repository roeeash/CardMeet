import { Router, Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getStatusCode, formatErrorResponse } from '../utils/errorHandler';
import { validateRequest, registerSchema, loginSchema, refreshSchema } from '../middleware/validation';
import { authResponseToDTO } from '../utils/dto';

const router = Router();

router.post('/register', validateRequest(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.register(email, password);
    res.status(201).json(authResponseToDTO(result.user, result.tokens));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/login', validateRequest(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.status(200).json(authResponseToDTO(result.user, result.tokens));
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/refresh', validateRequest(refreshSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await AuthService.refreshTokens(refreshToken);
    res.status(200).json(tokens);
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await AuthService.logout(req.user!.userId);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(getStatusCode(err)).json(formatErrorResponse(err));
  }
});

export default router;
