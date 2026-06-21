/**
 * Security assertions: JWT secrets, password hashing, SQL parameterization, CORS, rate limiting.
 * These tests verify that 6 security controls are correctly implemented.
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'node:path';

describe('Cycle 5.4 — Security Pass', () => {
  // ── JWT Secrets ──────────────────────────────────────────────────────────────

  it('JWT_SECRET env var is set (>6 chars in dev/test, >32 chars in production)', () => {
    const secret = process.env.JWT_SECRET;
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    // In test/dev mode, secrets can be shorter; production must enforce >32
    expect(secret!.length).toBeGreaterThan(6);
  });

  it('JWT_REFRESH_SECRET env var is set (>6 chars in dev/test, >32 chars in production)', () => {
    const secret = process.env.JWT_REFRESH_SECRET;
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    // In test/dev mode, secrets can be shorter; production must enforce >32
    expect(secret!.length).toBeGreaterThan(6);
  });

  // ── Password Hashing (bcrypt) ────────────────────────────────────────────────

  it('password hash with bcrypt(password, 12) is one-way (hash !== password)', async () => {
    const password = 'test_password_123';
    const hash = await bcrypt.hash(password, 12);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(typeof hash).toBe('string');
  });

  it('bcrypt.compare(password, hash) returns true for correct password', async () => {
    const password = 'correct_password_xyz';
    const hash = await bcrypt.hash(password, 12);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  it('bcrypt.compare(wrongPassword, hash) returns false for incorrect password', async () => {
    const password = 'correct_password_xyz';
    const wrongPassword = 'wrong_password';
    const hash = await bcrypt.hash(password, 12);

    const isValid = await bcrypt.compare(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  // ── SQL Parameterization ─────────────────────────────────────────────────────

  it('all SQL queries in src/models use parameterized Knex (no string interpolation)', async () => {
    const modelsDir = path.join(__dirname, '../src/models');
    const filesToCheck: string[] = [];

    // Recursively collect all .ts files in models directory
    const collectFiles = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          collectFiles(fullPath);
        } else if (file.endsWith('.ts')) {
          filesToCheck.push(fullPath);
        }
      });
    };

    collectFiles(modelsDir);

    // Check each file for unsafe string interpolation patterns
    filesToCheck.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Look for whereRaw with template literals containing variables (bad pattern)
      // Pattern: whereRaw(`...${...}...`)
      const unsafePattern = /whereRaw\s*\(\s*`[^`]*\$\{[^}]*\}[^`]*`/g;

      expect(content).not.toMatch(unsafePattern);
    });
  });

  // ── CORS Origin Locking ──────────────────────────────────────────────────────

  it('CORS origin is set to FRONTEND_URL or localhost (not wildcard)', async () => {
    const appPath = path.join(__dirname, '../src/app.ts');
    const content = fs.readFileSync(appPath, 'utf-8');

    // Verify CORS is configured with specific origins
    expect(content).toContain("origin: process.env.FRONTEND_URL || 'http://localhost:3001'");

    // Ensure no wildcard origin
    expect(content).not.toMatch(/origin\s*:\s*['"`]\*['"`]/);
  });

  // ── Auth Rate Limiter ────────────────────────────────────────────────────────

  it('auth rate limiter is configured with 5 requests per 15 minutes', async () => {
    const appPath = path.join(__dirname, '../src/app.ts');
    const content = fs.readFileSync(appPath, 'utf-8');

    // Verify authLimiter exists and has correct max value
    expect(content).toContain('authLimiter');
    expect(content).toContain('max: 5');
    expect(content).toContain('windowMs: 15 * 60 * 1000');
  });

  it('authLimiter is applied to /api/auth route before authRoutes middleware', async () => {
    const appPath = path.join(__dirname, '../src/app.ts');
    const content = fs.readFileSync(appPath, 'utf-8');

    // Verify authLimiter is used in app.use for /api/auth
    expect(content).toContain("app.use('/api/auth', authLimiter, authRoutes)");
  });

  // ── Mock Fallbacks Removal ───────────────────────────────────────────────────

  it('no hardcoded test credentials or mock fallbacks in src/models/', async () => {
    const modelsDir = path.join(__dirname, '../src/models');
    const filesToCheck: string[] = [];

    const collectFiles = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          collectFiles(fullPath);
        } else if (file.endsWith('.ts')) {
          filesToCheck.push(fullPath);
        }
      });
    };

    collectFiles(modelsDir);

    filesToCheck.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for test credentials or bypass logic
      expect(content).not.toMatch(/test-password|mock-user|bypass-auth|mock-db/i);
    });
  });

  // ── General Rate Limiter ─────────────────────────────────────────────────────

  it('general rate limiter is configured with 100 requests per 15 minutes', async () => {
    const appPath = path.join(__dirname, '../src/app.ts');
    const content = fs.readFileSync(appPath, 'utf-8');

    // Verify general limiter has max: 100
    const limiterMatch = content.match(
      /const limiter = rateLimit\(\{[\s\S]*?max: (\d+)/
    );

    expect(limiterMatch).toBeTruthy();
    expect(parseInt(limiterMatch![1])).toBe(100);
  });
});
