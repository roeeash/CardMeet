import { sign } from 'jsonwebtoken';
import { UserModel } from '@models/user/User';

export class AuthService {
  static async register(email: string, password: string) {
    const user = await UserModel.create({ email, password });
    const tokens = await UserModel.generateTokens(user);
    return { user, tokens };
  }

  static async login(email: string, password: string) {
    const user = await UserModel.verifyPassword(email, password);
    if (!user) throw new Error('Invalid credentials');
    const tokens = await UserModel.generateTokens(user);
    return { user, tokens };
  }

  static async refreshTokens(refreshToken: string) {
    const payload = await UserModel.verifyToken(refreshToken, true) as { userId: string };
    const user = await UserModel.findById(payload.userId);
    if (!user) throw new Error('User not found or token invalid');
    // Re-sign tokens using payload
    const accessToken = sign(
      { userId: payload.userId },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );
    const newRefresh = sign(
      { userId: payload.userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
    return { accessToken, refreshToken: newRefresh };
  }

  static async logout(_userId: string) {
    // Stateless JWT — nothing to invalidate server-side in v1
    return true;
  }
}
