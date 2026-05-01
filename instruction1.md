# Instruction 1: Project Setup & Foundation

## Overview
This instruction covers the complete project initialization, including repository setup, development environment configuration, and foundational architecture implementation.

## 1.1 Repository Setup

### Initialize Git Repository
```bash
# Create project directory
mkdir cardmeet
cd cardmeet

# Initialize git repository
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
*.tgz
*.tar.gz

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Mobile specific
ios/build/
android/build/
*.apk
*.ipa

# Temporary files
tmp/
temp/
EOF

# Create initial commit
git add .
git commit -m "Initial commit: Add .gitignore"
```

### Create Project Structure
```bash
# Create root directories
mkdir -p frontend backend shared docs scripts

# Frontend structure (React Native)
mkdir -p frontend/src/{components,screens,services,store,utils,types}
mkdir -p frontend/src/components/{common,features,layout}
mkdir -p frontend/src/services/{api,socket,storage,location}
mkdir -p frontend/src/store/{slices,api}
mkdir -p frontend/src/utils/{designSystem,formatters,validators}
mkdir -p frontend/src/types/{api,navigation,store}

# Backend structure
mkdir -p backend/src/{controllers,services,models,middleware,utils,config}
mkdir -p backend/src/controllers/{auth,events,listings,deals,notifications}
mkdir -p backend/src/services/{database,auth,notification,geolocation}
mkdir -p backend/src/models/{user,event,listing,deal,meetup}
mkdir -p backend/tests/{unit,integration,e2e}

# Shared structure
mkdir -p shared/{types,constants,utils}

# Documentation
mkdir -p docs/{api,deployment,architecture}
```

## 1.2 Frontend Setup (React Native)

### Initialize React Native Project
```bash
# Navigate to frontend directory
cd frontend

# Note: Frontend components already exist in /frontend/Components/
# The existing implementation uses React (not React Native) with JSX components
# For production, migrate these to React Native or use React Native Web

# Initialize React Native (using Expo for easier setup)
npx create-expo-app . --template blank-typescript

# Install core dependencies
npm install @reduxjs/toolkit react-redux redux-persist
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install react-native-svg react-native-reanimated react-native-gesture-handler
npm install @react-native-async-storage/async-storage react-native-mmkv
npm install react-native-geolocation-service
npm install socket.io-client

# Install development dependencies
npm install -D @types/react @types/react-native
npm install -D eslint prettier @typescript-eslint/eslint-plugin
npm install -D jest @testing-library/react-native

# MIGRATION NOTE: Existing components in /frontend/Components/ need to be converted to React Native:
# - App.jsx → App.tsx (main app component)
# - Browse.jsx → BrowseScreen.tsx 
# - Calendar.jsx → CalendarScreen.tsx
# - Listing.jsx → ListingDetailScreen.tsx
# - DealCards.jsx → DealCard components
# - Onboarding.jsx → OnboardingScreen.tsx
# - DetailSheet.jsx → DetailSheet component
```

### Configure TypeScript
```typescript
// frontend/tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": "./src",
    "paths": {
      "@components/*": ["components/*"],
      "@screens/*": ["screens/*"],
      "@services/*": ["services/*"],
      "@store/*": ["store/*"],
      "@utils/*": ["utils/*"],
      "@types/*": ["types/*"]
    }
  },
  "include": [
    "src/**/*",
    "App.tsx",
    "**/*.ts",
    "**/*.tsx"
  ]
}
```

### Configure ESLint and Prettier
```json
// frontend/.eslintrc.json
{
  "extends": [
    "expo",
    "@react-native-community",
    "@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

```json
// frontend/.prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Create Design System Foundation
```typescript
// frontend/src/utils/designSystem/tokens.ts
export const colors = {
  // Ink scale - neutrals
  ink: '#14141a',
  ink2: '#3a3a45',
  muted: '#767685',
  line: '#e6e6ec',
  
  // Paper scale - backgrounds
  paper: '#f7f6f2',
  paper2: '#fbfaf6',
  
  // Accent
  accent: '#2c4cff',
  accentSoft: '#e8edff',
  
  // Status colors
  good: '#15803d',
  goodSoft: '#d6f0de',
  warn: '#92400e',
  warnSoft: '#fef0c7',
  bad: '#991b1b',
  badSoft: '#fde2e2',
  
  // Phone background
  phoneBg: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  gigantic: 56,
  enormous: 72,
  colossal: 80,
  titan: 120,
} as const;

export const typography = {
  // Fonts
  fonts: {
    serif: 'Fraunces',
    sans: 'Inter',
    mono: 'JetBrains Mono',
  },
  
  // Sizes
  sizes: {
    hero: { fontSize: 56, lineHeight: 60 },
    h1: { fontSize: 48, lineHeight: 52 },
    h2: { fontSize: 32, lineHeight: 36 },
    h3: { fontSize: 24, lineHeight: 28 },
    h4: { fontSize: 20, lineHeight: 24 },
    body: { fontSize: 15, lineHeight: 24 },
    small: { fontSize: 13, lineHeight: 20 },
    caption: { fontSize: 11, lineHeight: 16 },
  },
  
  // Weights
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  huge: 16,
  massive: 24,
  gigantic: 36,
  full: 100,
} as const;
```

```typescript
// frontend/src/utils/designSystem/types.ts
export interface ColorTokens {
  ink: string;
  ink2: string;
  muted: string;
  line: string;
  paper: string;
  paper2: string;
  accent: string;
  accentSoft: string;
  good: string;
  goodSoft: string;
  warn: string;
  warnSoft: string;
  bad: string;
  badSoft: string;
  phoneBg: string;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
  huge: number;
  massive: number;
  gigantic: number;
  enormous: number;
  colossal: number;
  titan: number;
}

export interface TypographyTokens {
  fonts: {
    serif: string;
    sans: string;
    mono: string;
  };
  sizes: {
    hero: { fontSize: number; lineHeight: number };
    h1: { fontSize: number; lineHeight: number };
    h2: { fontSize: number; lineHeight: number };
    h3: { fontSize: number; lineHeight: number };
    h4: { fontSize: number; lineHeight: number };
    body: { fontSize: number; lineHeight: number };
    small: { fontSize: number; lineHeight: number };
    caption: { fontSize: number; lineHeight: number };
  };
  weights: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
}
```

### Create Base Components
```typescript
// frontend/src/components/common/Button/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@utils/designSystem/tokens';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.muted : colors.ink,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: colors.paper,
          borderWidth: 1,
          borderColor: colors.line,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.accentSoft,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: typography.fonts.sans,
      fontWeight: typography.weights.semibold,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          color: disabled ? colors.line : 'white',
        };
      case 'secondary':
        return {
          ...baseStyle,
          color: colors.ink,
        };
      case 'ghost':
        return {
          ...baseStyle,
          color: colors.accent,
        };
      default:
        return baseStyle;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm };
      case 'medium':
        return { paddingHorizontal: spacing.xl, paddingVertical: spacing.md };
      case 'large':
        return { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.lg };
      default:
        return { paddingHorizontal: spacing.xl, paddingVertical: spacing.md };
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), getSizeStyle(), style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[getTextStyle(), typography.sizes.small]}>{title}</Text>
    </TouchableOpacity>
  );
};
```

```typescript
// frontend/src/components/common/Card/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '@utils/designSystem/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'medium',
}) => {
  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return {};
      case 'small':
        return { padding: spacing.md };
      case 'medium':
        return { padding: spacing.lg };
      case 'large':
        return { padding: spacing.xxl };
      default:
        return { padding: spacing.lg };
    }
  };

  return (
    <View
      style={[
        styles.card,
        getPaddingStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.phoneBg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.xl,
  },
});
```

## 1.3 Backend Setup

### Initialize Node.js Project
```bash
# Navigate to backend directory
cd ../backend

# Initialize package.json
npm init -y

# Install core dependencies
npm install express typescript ts-node nodemon
npm install @types/express @types/node
npm install pg knex bcryptjs jsonwebtoken
npm install @types/pg @types/bcryptjs @types/jsonwebtoken
npm install socket.io redis cors helmet joi
npm install @types/cors winston express-rate-limit
npm install dotenv multer @types/multer

# Install development dependencies
npm install -D jest @types/jest ts-jest supertest @types/supertest
npm install -D eslint prettier @typescript-eslint/eslint-plugin
npm install -D @typescript-eslint/parser
```

### Configure TypeScript
```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": "./src",
    "paths": {
      "@controllers/*": ["controllers/*"],
      "@services/*": ["services/*"],
      "@models/*": ["models/*"],
      "@middleware/*": ["middleware/*"],
      "@utils/*": ["utils/*"],
      "@config/*": ["config/*"],
      "@types/*": ["types/*"]
    }
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

### Create Environment Configuration
```typescript
// backend/src/config/database.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cardmeet',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

```typescript
// backend/src/config/redis.ts
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};
```

### Create Database Migration Setup
```typescript
// backend/knexfile.ts
import type { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cardmeet_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/migrations',
    },
    seeds: {
      directory: './src/seeds',
    },
  },
  
  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cardmeet_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/migrations',
    },
    seeds: {
      directory: './src/seeds',
    },
  },
  
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/migrations',
    },
  },
};

export default config;
```

### Create Base Express Server
```typescript
// backend/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { errorHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/requestLogger';

// Routes (will be created in next steps)
// import authRoutes from '@controllers/auth';
// import eventRoutes from '@controllers/events';

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes (will be added in subsequent steps)
// app.use('/api/auth', authRoutes);
// app.use('/api/events', eventRoutes);

// Error handling middleware
app.use(errorHandler);

export { app, server, io };
```

### Create Development Scripts
```json
// backend/package.json scripts section
{
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback",
    "seed": "knex seed:run"
  }
}
```

## 1.4 Shared Types

### Create Shared Type Definitions
```typescript
// shared/types/user.ts
export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  locationLat: number;
  locationLng: number;
  travelRadiusKm: number;
  games: Game[];
  rating: number;
  completedDeals: number;
  noShows: number;
  createdAt: Date;
  updatedAt: Date;
}

export type Game = 'mtg' | 'pokemon' | 'yugioh' | 'lorcana';
```

```typescript
// shared/types/event.ts
export interface Event {
  id: string;
  name: string;
  description?: string;
  locationName: string;
  locationLat: number;
  locationLng: number;
  startDate: Date;
  endDate: Date;
  games: Game[];
  eventType: EventType;
  status: EventStatus;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EventType = 'tournament' | 'convention' | 'fnm';
export type EventStatus = 'active' | 'cancelled' | 'completed';

export interface EventRSVP {
  id: string;
  userId: string;
  eventId: string;
  status: RSVPStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type RSVPStatus = 'going' | 'maybe' | 'no';
```

```typescript
// shared/types/listing.ts
export interface Listing {
  id: string;
  sellerId: string;
  cardName: string;
  cardSet?: string;
  condition: CardCondition;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  description?: string;
  game: Game;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CardCondition = 'nm' | 'lp' | 'mp' | 'hp';
export type ListingStatus = 'active' | 'sold' | 'withdrawn';
```

## 1.5 Testing Setup

### Frontend Testing Configuration
```json
// frontend/jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'src/**/*.(ts|tsx)',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  moduleNameMapping: {
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
};
```

### Backend Testing Configuration
```json
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/migrations/**',
    '!src/seeds/**',
  ],
  moduleNameMapping: {
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

## 1.6 Development Environment Files

### Environment Templates
```bash
# backend/.env.example
NODE_ENV=development
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cardmeet_dev
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# File Upload
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=cardmeet-uploads
```

### Docker Development Setup
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: cardmeet_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

## 1.7 Initial Commit

```bash
# After completing all setup tasks
git add .
git commit -m "feat: Initialize project structure and foundation

- Set up React Native frontend with TypeScript
- Initialize Node.js backend with Express
- Configure design system tokens and base components
- Set up shared type definitions
- Configure testing frameworks
- Add Docker development environment
- Create initial project structure"
```

## Verification Checklist

- [ ] Frontend project initialized with React Native + TypeScript
- [ ] Backend project initialized with Node.js + Express + TypeScript
- [ ] Design system tokens created and configured
- [ ] Base components (Button, Card) implemented
- [ ] Shared type definitions created
- [ ] Testing frameworks configured
- [ ] Docker development environment set up
- [ ] Environment templates created
- [ ] Git repository initialized with proper .gitignore
- [ ] All dependencies installed successfully
- [ ] TypeScript compilation works without errors
- [ ] Linting and formatting rules configured

## Next Steps

Proceed to **Instruction 2: Database Setup & Models** to implement the complete database schema, create migration files, and set up the data models with proper relationships and validations.
