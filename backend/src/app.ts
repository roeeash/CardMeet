import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

import { errorHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/requestLogger';
import { Database } from '@config/database';

// Initialise knex and wire all models
Database.getInstance();

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

// Auth-specific rate limiter (stricter brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit auth endpoints to 5 requests per windowMs
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many login/register attempts. Please try again later.' });
  },
});

app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve static files from project root
app.use(express.static(path.join(__dirname, '../../'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// Serve mvp.html at root
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../mvp.html'));
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

import authRoutes from '@routes/auth';
import eventRoutes from '@routes/events';
import listingRoutes from '@routes/listings';
import dealRoutes from '@routes/deals';
import meetupRoutes from '@routes/meetups';
import profileRoutes from '@routes/profile';

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/meetups', meetupRoutes);
app.use('/api/profile', profileRoutes);

// Error handling middleware
app.use(errorHandler);

export { app, server, io };
