# CardMeet Security Policy

## Overview

This document outlines the security measures implemented across the CardMeet backend API. All endpoints are protected with defense-in-depth controls covering authentication, rate limiting, data validation, and transport security.

## Security Controls

### 1. JWT Secrets
- **Implementation**: JWT tokens (access and refresh) are signed with strong, random 43+ character base64-encoded secrets.
- **Environment Variables**: `JWT_SECRET` and `JWT_REFRESH_SECRET`
- **Production Requirement**: Both must be cryptographically strong random values (minimum 32 characters, base64-encoded).
- **Token Expiry**: Access tokens expire in 15 minutes; refresh tokens in 7 days.
- **Location**: `backend/src/models/user/User.ts` (UserModel.generateTokens, UserModel.verifyToken)

### 2. Rate Limiting
- **General Endpoints**: 100 requests per 15 minutes per IP address
- **Auth Endpoints** (`/api/auth/login`, `/api/auth/register`): 5 requests per 15 minutes per IP address
- **Implementation**: `express-rate-limit` middleware
- **Rationale**: Auth endpoints are brute-force targets and require stricter limits
- **Location**: `backend/src/app.ts` (limiter and authLimiter middleware)

### 3. SQL Parameterization
- **Framework**: All queries use Knex.js with parameterized bindings
- **Pattern**: No string interpolation; all user input is bound as parameters
- **Example**: 
  ```typescript
  // Correct (parameterized)
  query.whereRaw('ST_DWithin(...)', [lng, lat, radiusKm * 1000])
  
  // Never used (string interpolation)
  // ❌ query.whereRaw(`ST_DWithin(..., ${lng}, ${lat}, ${radius})`)
  ```
- **Location**: All files in `backend/src/models/` use parameterized queries

### 4. CORS (Cross-Origin Resource Sharing)
- **Origin**: Locked to `process.env.FRONTEND_URL` or fallback to `http://localhost:3001`
- **Wildcard**: Never `*` — only the registered frontend domain
- **Credentials**: Enabled (credentialsallowed: true)
- **Implementation**: `cors` middleware
- **Location**: `backend/src/app.ts`

### 5. Password Hashing
- **Algorithm**: bcrypt with cost factor 12
- **One-Way**: Passwords are never stored or compared in plaintext
- **Verification**: `bcrypt.compare(inputPassword, storedHash)` returns boolean
- **Location**: `backend/src/models/user/User.ts` (UserModel.create, UserModel.verifyPassword)

### 6. Mock Fallbacks Removal
- **Status**: All mock fallbacks and bypass logic removed from production code
- **Verification**: No hardcoded test credentials or in-memory DB fallbacks
- **Database**: Strict Postgres-only requirement (no SQLite or in-memory alternatives)

---

## Production Checklist

Before deploying to production, verify:

- [ ] `JWT_SECRET` is set to a cryptographically strong value (>32 chars, base64)
- [ ] `JWT_REFRESH_SECRET` is set to a cryptographically strong value (>32 chars, base64)
- [ ] `FRONTEND_URL` is set to the actual frontend domain (not wildcard, not localhost)
- [ ] Database credentials (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`) are secured in secrets management
- [ ] `NODE_ENV=production`
- [ ] HTTPS is enforced (reverse proxy or load balancer)
- [ ] CORS origin does not include localhost or test domains
- [ ] Rate limiter is active and monitored for abuse patterns
- [ ] All log files exclude sensitive data (passwords, tokens, API keys)
- [ ] Regular security audits are scheduled

---

## Incident Response

If a security issue is suspected:

1. **JWT Compromise**: Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` immediately; invalidate all active tokens
2. **Rate Limit Bypass**: Check logs for attack patterns; consider IP-based blocking
3. **SQL Injection Attempt**: Review application logs; verify all queries use parameterized bindings
4. **Password Leak**: Hash values are one-way; advise affected users to reset passwords if plaintext credentials are exposed
5. **CORS Misconfiguration**: Check `FRONTEND_URL` and redeploy with correct origin

---

## Testing

Security assertions are verified in `backend/tests/security.test.ts`:
- JWT secrets exist and meet length requirements
- Password hashing is one-way (bcrypt)
- SQL queries are parameterized (no string interpolation)
- CORS origin is locked to a specific domain (not wildcard)

Run tests: `npm test` from `backend/`

---

## References

- JWT: RFC 7519 (https://tools.ietf.org/html/rfc7519)
- bcrypt: https://www.npmjs.com/package/bcryptjs
- Knex.js: https://knexjs.org/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
