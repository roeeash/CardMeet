"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const url_1 = require("url");
dotenv_1.default.config();
const dbUrl = process.env.DATABASE_URL;
const connection = dbUrl ? (() => {
    const u = new url_1.URL(dbUrl);
    return {
        host: u.hostname,
        port: parseInt(u.port || '5432'),
        database: u.pathname.slice(1),
        user: u.username,
        password: u.password,
        ssl: { rejectUnauthorized: false },
    };
})() : (() => {
    const useSSL = !!process.env.DB_HOST &&
        process.env.DB_HOST !== 'localhost' &&
        process.env.DB_HOST !== '127.0.0.1';
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'cardmeet_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    };
})();
const config = {
    development: {
        client: 'pg',
        connection,
        pool: { min: 2, max: 10 },
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
        connection,
        pool: { min: 1, max: 5 },
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
            ...connection,
            ssl: { rejectUnauthorized: false },
        },
        pool: { min: 2, max: 10 },
        migrations: {
            tableName: 'knex_migrations',
            directory: './src/migrations',
        },
    },
};
exports.default = config;
//# sourceMappingURL=knexfile.js.map