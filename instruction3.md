# Instruction 3: Authentication & User Management

## Overview
This instruction covers the complete authentication system including JWT token management, user registration/login flows, profile management, and security implementations. We'll build secure authentication with proper validation, rate limiting, and session management.

## 3.1 Authentication Controller

### JWT Service Implementation
```typescript
// backend/src/services/auth/JWTService.ts
import jwt from 'jsonwebtoken';
import { UserModel } from '@models/User';

export interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  static generateTokenPair(user: { id: string; email: string }): TokenPair {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: 'access',
      } as JWTPayload,
      process.env.JWT_SECRET!,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: 'refresh',
      } as JWTPayload,
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }

  static async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      
      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  static async verifyRefreshToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JWTPayload;
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  static async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    
    // Verify user still exists
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.generateTokenPair(user);
  }
}
```

### Password Validation Service
```typescript
// backend/src/services/auth/PasswordService.ts
import bcrypt from 'bcryptjs';

export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must be less than ${this.MAX_LENGTH} characters long`);
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
```

### Authentication Middleware
```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { JWTService } from '@services/auth/JWTService';
import { UserModel } from '@models/User';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = await JWTService.verifyAccessToken(token);
    
    // Verify user exists
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid access token' });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await JWTService.verifyAccessToken(token);
      
      const user = await UserModel.findById(payload.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
        };
      }
    }

    next();
  } catch (error) {
    // Optional auth - continue without user
    next();
  }
};
```

### Rate Limiting Middleware
```typescript
// backend/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    // Use IP + email for login attempts to prevent email enumeration
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  },
});

// Password reset rate limiting
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too many password reset attempts, please try again later.',
  },
});
```

### Input Validation Schemas
```typescript
// backend/src/utils/validation.ts
import Joi from 'joi';

export const schemas = {
  // Registration validation
  register: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must be less than 128 characters',
        'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
        'any.required': 'Password is required',
      }),
    displayName: Joi.string()
      .min(2)
      .max(50)
      .required()
      .messages({
        'string.min': 'Display name must be at least 2 characters long',
        'string.max': 'Display name must be less than 50 characters',
        'any.required': 'Display name is required',
      }),
  }),

  // Login validation
  login: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required',
      }),
  }),

  // Profile update validation
  updateProfile: Joi.object({
    displayName: Joi.string()
      .min(2)
      .max(50)
      .messages({
        'string.min': 'Display name must be at least 2 characters long',
        'string.max': 'Display name must be less than 50 characters',
      }),
    locationLat: Joi.number()
      .min(-90)
      .max(90)
      .messages({
        'number.min': 'Invalid latitude',
        'number.max': 'Invalid latitude',
      }),
    locationLng: Joi.number()
      .min(-180)
      .max(180)
      .messages({
        'number.min': 'Invalid longitude',
        'number.max': 'Invalid longitude',
      }),
    travelRadiusKm: Joi.number()
      .min(5)
      .max(500)
      .messages({
        'number.min': 'Travel radius must be at least 5 km',
        'number.max': 'Travel radius must be less than 500 km',
      }),
    games: Joi.array()
      .items(Joi.string().valid('mtg', 'pokemon', 'yugioh', 'lorcana'))
      .min(1)
      .messages({
        'array.min': 'You must select at least one game',
        'any.only': 'Invalid game selection',
      }),
  }),

  // Password change validation
  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required',
      }),
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password must be less than 128 characters',
        'string.pattern.base': 'New password must contain at least one lowercase letter, one uppercase letter, and one number',
        'any.required': 'New password is required',
      }),
  }),
};

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      res.status(400).json({
        error: 'Validation failed',
        errors,
      });
      return;
    }

    req.body = value;
    next();
  };
};
```

### Authentication Controller
```typescript
// backend/src/controllers/auth.ts
import { Request, Response } from 'express';
import { UserModel, UserProfileModel } from '@models/User';
import { JWTService } from '@services/auth/JWTService';
import { PasswordService } from '@services/auth/PasswordService';
import { validate, schemas } from '@utils/validation';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, displayName } = req.body;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      // Create user
      const user = await UserModel.create({ email, password });

      // Create user profile
      await UserProfileModel.createProfile({
        userId: user.id,
        displayName,
        locationLat: 32.0853, // Default Tel Aviv
        locationLng: 34.7818,
        travelRadiusKm: 50,
        games: ['mtg'], // Default game
        rating: 5.0,
        completedDeals: 0,
        noShows: 0,
      });

      // Generate tokens
      const tokens = JWTService.generateTokenPair(user);

      // Get user profile for response
      const profile = await UserProfileModel.findByUserId(user.id);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          profile,
        },
        tokens,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Verify credentials
      const user = await UserModel.verifyPassword(email, password);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate tokens
      const tokens = JWTService.generateTokenPair(user);

      // Get user profile
      const profile = await UserProfileModel.findByUserId(user.id);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          profile,
        },
        tokens,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(401).json({ error: 'Refresh token required' });
        return;
      }

      const tokens = await JWTService.refreshTokens(refreshToken);

      res.json({ tokens });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    // In a production environment, you might want to:
    // 1. Add the token to a blacklist
    // 2. Revoke the refresh token
    // 3. Clear any server-side sessions
    
    res.json({ message: 'Logged out successfully' });
  }

  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user!.id;

      // Get current user
      const user = await UserModel.findById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Verify current password
      const isValidPassword = await PasswordService.verifyPassword(
        currentPassword,
        user.password_hash
      );

      if (!isValidPassword) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      // Validate new password
      const passwordValidation = PasswordService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          error: 'Invalid new password',
          errors: passwordValidation.errors,
        });
        return;
      }

      // Hash and update password
      const newPasswordHash = await PasswordService.hashPassword(newPassword);
      await UserModel.update(userId, { password_hash: newPasswordHash });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Password change failed' });
    }
  }
}
```

## 3.2 User Profile Controller

### Profile Controller
```typescript
// backend/src/controllers/profile.ts
import { Request, Response } from 'express';
import { UserProfileModel } from '@models/User';
import { EventRSVPModel } from '@models/Event';
import { ListingModel } from '@models/Listing';
import { DealModel } from '@models/Deal';
import { validate, schemas } from '@utils/validation';

export class ProfileController {
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const profile = await UserProfileModel.findByUserId(userId);

      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json({ profile });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const updateData = req.body;

      const updatedProfile = await UserProfileModel.updateProfile(userId, updateData);

      res.json({ profile: updatedProfile });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  static async getPublicProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const profile = await UserProfileModel.findByUserId(userId);

      if (!profile) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Return only public information
      const publicProfile = {
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        rating: profile.rating,
        completedDeals: profile.completedDeals,
        noShows: profile.noShows,
        games: profile.games,
      };

      res.json({ profile: publicProfile });
    } catch (error) {
      console.error('Get public profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // Get user's RSVPs
      const rsvps = await EventRSVPModel.getUserRSVPs(userId);
      const goingCount = rsvps.filter(rsvp => rsvp.status === 'going').length;
      const maybeCount = rsvps.filter(rsvp => rsvp.status === 'maybe').length;

      // Get user's listings
      const listings = await ListingModel.getSellerListings(userId);
      const activeListings = listings.filter(listing => listing.status === 'active').length;
      const soldListings = listings.filter(listing => listing.status === 'sold').length;

      // Get user's deals
      const deals = await DealModel.getUserDeals(userId);
      const negotiatingCount = deals.negotiating.length;
      const matchedCount = deals.matched.length;
      const scheduledCount = deals.scheduled.length;

      res.json({
        events: {
          going: goingCount,
          maybe: maybeCount,
          total: rsvps.length,
        },
        listings: {
          active: activeListings,
          sold: soldListings,
          total: listings.length,
        },
        deals: {
          negotiating: negotiatingCount,
          matched: matchedCount,
          scheduled: scheduledCount,
          total: negotiatingCount + matchedCount + scheduledCount,
        },
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ error: 'Failed to get user stats' });
    }
  }

  static async uploadAvatar(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // TODO: Implement file upload to S3
      // For now, return a placeholder URL
      const avatarUrl = `https://cardmeet-uploads.s3.amazonaws.com/avatars/${userId}/${req.file.filename}`;

      await UserProfileModel.updateProfile(userId, { avatarUrl });

      res.json({ avatarUrl });
    } catch (error) {
      console.error('Avatar upload error:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
}
```

### File Upload Middleware
```typescript
// backend/src/middleware/upload.ts
import multer from 'multer';
import { Request } from 'express';

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: any) => {
  // Allow only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export const uploadCardImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
```

## 3.3 Authentication Routes

### Auth Routes
```typescript
// backend/src/routes/auth.ts
import { Router } from 'express';
import { AuthController } from '@controllers/auth';
import { authenticate, authLimiter, passwordResetLimiter } from '@middleware/auth';
import { validate, schemas } from '@utils/validation';

const router = Router();

// Registration
router.post(
  '/register',
  authLimiter,
  validate(schemas.register),
  AuthController.register
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(schemas.login),
  AuthController.login
);

// Token refresh
router.post('/refresh', AuthController.refresh);

// Logout (protected)
router.post('/logout', authenticate, AuthController.logout);

// Change password (protected)
router.put(
  '/password',
  authenticate,
  validate(schemas.changePassword),
  AuthController.changePassword
);

export default router;
```

### Profile Routes
```typescript
// backend/src/routes/profile.ts
import { Router } from 'express';
import { ProfileController } from '@controllers/profile';
import { authenticate } from '@middleware/auth';
import { validate, schemas } from '@utils/validation';
import { uploadAvatar } from '@middleware/upload';

const router = Router();

// Get current user's profile (protected)
router.get('/', authenticate, ProfileController.getProfile);

// Update current user's profile (protected)
router.put(
  '/',
  authenticate,
  validate(schemas.updateProfile),
  ProfileController.updateProfile
);

// Get public profile (anyone can view)
router.get('/:userId', ProfileController.getPublicProfile);

// Get user statistics (protected)
router.get('/stats', authenticate, ProfileController.getUserStats);

// Upload avatar (protected)
router.post(
  '/avatar',
  authenticate,
  uploadAvatar.single('avatar'),
  ProfileController.uploadAvatar
);

export default router;
```

## 3.4 Frontend Authentication Implementation

### Authentication Service
```typescript
// frontend/src/services/auth/AuthService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface User {
  id: string;
  email: string;
  profile: UserProfile;
}

interface JWTPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
  exp: number;
}

export class AuthService {
  private static readonly TOKENS_KEY = 'auth_tokens';
  private static readonly USER_KEY = 'auth_user';

  static async login(email: string, password: string): Promise<{
    user: User;
    tokens: AuthTokens;
  }> {
    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    
    // Store tokens and user
    await this.setTokens(data.tokens);
    await this.setUser(data.user);

    return data;
  }

  static async register(userData: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{
    user: User;
    tokens: AuthTokens;
  }> {
    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    
    // Store tokens and user
    await this.setTokens(data.tokens);
    await this.setUser(data.user);

    return data;
  }

  static async logout(): Promise<void> {
    try {
      const tokens = await this.getTokens();
      if (tokens) {
        await fetch(`${process.env.API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear local storage regardless of API call success
      await this.clearAuth();
    }
  }

  static async refreshToken(): Promise<AuthTokens> {
    const tokens = await this.getTokens();
    
    if (!tokens) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${process.env.API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const newTokens = await response.json();
    await this.setTokens(newTokens.tokens);
    
    return newTokens.tokens;
  }

  static async getAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    
    if (!tokens) {
      return null;
    }

    // Check if access token is expired
    try {
      const decoded = jwtDecode<JWTPayload>(tokens.accessToken);
      const now = Math.floor(Date.now() / 1000);
      
      if (decoded.exp < now) {
        // Token expired, try to refresh
        try {
          await this.refreshToken();
          const newTokens = await this.getTokens();
          return newTokens?.accessToken || null;
        } catch (error) {
          // Refresh failed, clear auth
          await this.clearAuth();
          return null;
        }
      }
      
      return tokens.accessToken;
    } catch (error) {
      // Invalid token, clear auth
      await this.clearAuth();
      return null;
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    const user = await AsyncStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    const user = await this.getCurrentUser();
    return !!(token && user);
  }

  private static async setTokens(tokens: AuthTokens): Promise<void> {
    await AsyncStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
  }

  private static async getTokens(): Promise<AuthTokens | null> {
    const tokens = await AsyncStorage.getItem(this.TOKENS_KEY);
    return tokens ? JSON.parse(tokens) : null;
  }

  private static async setUser(user: User): Promise<void> {
    await AsyncStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  private static async clearAuth(): Promise<void> {
    await AsyncStorage.multiRemove([this.TOKENS_KEY, this.USER_KEY]);
  }
}
```

### Auth Store (Redux)
```typescript
// frontend/src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthService } from '@services/auth/AuthService';
import { User } from '@types/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const response = await AuthService.login(email, password);
    return response;
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: {
    email: string;
    password: string;
    displayName: string;
  }) => {
    const response = await AuthService.register(userData);
    return response;
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await AuthService.logout();
});

export const checkAuthStatus = createAsyncThunk(
  'auth/checkStatus',
  async () => {
    const isAuthenticated = await AuthService.isAuthenticated();
    const user = isAuthenticated ? await AuthService.getCurrentUser() : null;
    return { isAuthenticated, user };
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      // Register
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Registration failed';
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      // Check auth status
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isAuthenticated = action.payload.isAuthenticated;
        state.user = action.payload.user;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
```

### Authentication Screens

#### Login Screen
```typescript
// frontend/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { login } from '@store/slices/authSlice';
import { Button } from '@components/common/Button/Button';
import { Card } from '@components/common/Card/Card';
import { Input } from '@components/common/Input/Input';
import { Text } from '@components/common/Text/Text';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await dispatch(login({ email, password })).unwrap();
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your CardMeet account</Text>
      </View>

      <Card style={styles.formCard}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.passwordInput}
        />

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          style={styles.loginButton}
        />

        <Button
          title="Create Account"
          onPress={() => navigation.navigate('Register')}
          variant="ghost"
          style={styles.registerButton}
        />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },
  header: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxxl,
  },
  title: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h1.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
  },
  formCard: {
    padding: spacing.xxl,
  },
  passwordInput: {
    marginTop: spacing.lg,
  },
  loginButton: {
    marginTop: spacing.xxl,
  },
  registerButton: {
    marginTop: spacing.lg,
  },
});
```

#### Register Screen
```typescript
// frontend/src/screens/auth/RegisterScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { register } from '@store/slices/authSlice';
import { Button } from '@components/common/Button/Button';
import { Card } from '@components/common/Card/Card';
import { Input } from '@components/common/Input/Input';
import { Text } from '@components/common/Text/Text';
import { colors, spacing, typography } from '@utils/designSystem/tokens';

type RegisterScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validation
    if (!email || !password || !displayName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      await dispatch(register({ email, password, displayName })).unwrap();
    } catch (error) {
      Alert.alert('Registration Failed', error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join CardMeet and start trading at conventions</Text>
      </View>

      <Card style={styles.formCard}>
        <Input
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.emailInput}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.passwordInput}
        />

        <Input
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={styles.confirmPasswordInput}
        />

        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={loading}
          style={styles.registerButton}
        />

        <Button
          title="Sign In"
          onPress={() => navigation.navigate('Login')}
          variant="ghost"
          style={styles.loginButton}
        />
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.lg,
  },
  header: {
    marginTop: spacing.xxxl,
    marginBottom: spacing.xxxl,
  },
  title: {
    fontFamily: typography.fonts.serif,
    fontSize: typography.sizes.h1.fontSize,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fonts.sans,
    fontSize: typography.sizes.body.fontSize,
    color: colors.ink2,
  },
  formCard: {
    padding: spacing.xxl,
  },
  emailInput: {
    marginTop: spacing.lg,
  },
  passwordInput: {
    marginTop: spacing.lg,
  },
  confirmPasswordInput: {
    marginTop: spacing.lg,
  },
  registerButton: {
    marginTop: spacing.xxl,
  },
  loginButton: {
    marginTop: spacing.lg,
  },
});
```

## 3.5 Navigation Integration

### Auth Navigator
```typescript
// frontend/src/navigation/AuthNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { RegisterScreen } from '@screens/auth/RegisterScreen';

const Stack = createNativeStackNavigator();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
};
```

### App Navigator with Auth Flow
```typescript
// frontend/src/navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuthStatus } from '@store/slices/authSlice';
import { RootState } from '@store';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { LoadingScreen } from '@screens/common/LoadingScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, loading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

## 3.6 API Client with Authentication

### Authenticated API Client
```typescript
// frontend/src/services/api/ApiClient.ts
import { AuthService } from '@services/auth/AuthService';

export class ApiClient {
  private static baseURL = process.env.API_BASE_URL || 'http://localhost:3001/api';

  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Get access token
    const token = await AuthService.getAccessToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid, clear auth
      await AuthService.logout();
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  static async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  static async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  static async upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>
  ): Promise<T> {
    const token = await AuthService.getAccessToken();
    
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }
}
```

## 3.7 Testing Authentication

### Authentication Tests
```typescript
// backend/tests/controllers/auth.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { Database } from '../../src/config/database';

describe('Authentication Controller', () => {
  beforeAll(async () => {
    await Database.migrate();
  });

  afterAll(async () => {
    await Database.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        displayName: 'Test User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.profile.displayName).toBe(userData.displayName);
    });

    it('should reject invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Password123',
        displayName: 'Test User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should reject weak password', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'weak',
        displayName: 'Test User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123',
        displayName: 'Another User',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
    });

    it('should reject invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        });

      const { refreshToken } = loginResponse.body.tokens;

      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('tokens');
      expect(refreshResponse.body.tokens.accessToken).toBeDefined();
      expect(refreshResponse.body.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid refresh token');
    });
  });
});
```

## Verification Checklist

- [ ] JWT service implemented with proper token validation
- [ ] Password service with secure hashing and validation
- [ ] Authentication middleware working correctly
- [ ] Rate limiting implemented for auth endpoints
- [ ] Input validation schemas complete
- [ ] Auth controllers with proper error handling
- [ ] Profile controller with CRUD operations
- [ ] File upload middleware for avatars
- [ ] Frontend auth service with token management
- [ ] Redux auth store with async thunks
- [ ] Authentication screens implemented
- [ ] Navigation with auth flow
- [ ] API client with automatic token refresh
- [ ] Comprehensive test coverage
- [ ] Security measures (rate limiting, validation, etc.)

## Next Steps

Proceed to **Instruction 4: Events & Calendar System** to implement the event discovery, RSVP management, and calendar functionality that forms the core of CardMeet's coordination system.
