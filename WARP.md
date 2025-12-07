# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands

- Install dependencies: `npm install` (uses `package-lock.json`).
- Run the development server (Node with file watching): `npm run dev` (runs `node --watch src/index.js`).
- Lint the codebase: `npm run lint`.
- Lint and auto-fix: `npm run lint:fix`.
- Format the codebase with Prettier: `npm run format`.
- Check formatting without writing changes: `npm run format:check`.
- Database migrations with Drizzle (requires `DB_URL`):
  - Generate migrations from models: `npm run db:generate`.
  - Apply migrations: `npm run db:migrate`.
  - Open Drizzle studio UI: `npm run db:studio`.

Notes:
- There is currently no `test` script or `tests/` directory configured; add a test runner and scripts before expecting test commands to work.
- There is no separate build step; the API runs directly with Node on the JavaScript sources in `src/`.

## Project layout and architecture

### Entry points and server lifecycle

- `src/index.js` is the top-level entry. It loads environment variables via `dotenv/config` and imports `src/server.js`.
- `src/server.js` imports the Express app from `src/app.js`, reads `process.env.PORT` (default `3000`), and calls `app.listen(...)`.
- `src/app.js` constructs and configures the Express application:
  - Attaches security and parsing middleware: `helmet`, `express.json`, `express.urlencoded`, `cors`, and `cookie-parser`.
  - Sets up request logging via `morgan` wired into the shared Winston logger.
  - Exposes basic endpoints:
    - `GET /health` – JSON healthcheck with status, timestamp, and uptime.
    - `GET /` – simple text greeting.
    - `GET /api` – simple JSON describing the API.
  - Mounts the authentication routes under `/api/auth` from `src/routes/auth.routes.js`.

### Module path aliases

`package.json` defines Node `imports` aliases to keep imports consistent and avoid deep relative paths:

- `#config/*` → `./src/config/*`
- `#controllers/*` → `./src/controller/*`
- `#middleware/*` → `./src/middleware/*`
- `#models/*` → `./src/models/*`
- `#routes/*` → `./src/routes/*`
- `#services/*` → `./src/services/*`
- `#utils/*` → `./src/utils/*`
- `#validations/*` → `./src/validations/*`

When adding new modules, prefer using these aliases instead of relative paths.

### Configuration and infrastructure

- `src/config/database.js`
  - Creates a Neon HTTP client via `@neondatabase/serverless` using `process.env.DB_URL`.
  - Wraps it with `drizzle-orm/neon-http` to provide the `db` query interface.
  - Exports both `db` and `sql` for use in services and lower-level DB access.
- `drizzle.config.js`
  - Points Drizzle at `./src/models/*.js` for schema definitions.
  - Outputs migration artifacts to `./drizzle`.
  - Uses the PostgreSQL dialect and `DB_URL` for credentials.
- `src/config/logger.js`
  - Central Winston logger used across the app.
  - Logs JSON to `logs/error.lg` (level `error`) and `logs/combined.log` (all levels at or above `LOG_LEVEL`, default `info`).
  - In non-production (`NODE_ENV !== 'production'`), also logs to the console with colored, simple formatting.

### HTTP routing, controllers, and services

The HTTP layer is structured in a standard route → controller → service flow.

- **Routes (`src/routes/`)**
  - `auth.routes.js` defines the `/api/auth` subrouter using `express.Router()`.
  - Endpoints include:
    - `POST /api/auth/sign-up` – user signup.
    - `POST /api/auth/login` – placeholder login endpoint.
    - `POST /api/auth/logout` – placeholder logout endpoint.
  - Routes delegate all non-trivial work to controllers.

- **Controllers (`src/controller/`)**
  - `auth.controller.js` owns HTTP-specific behavior for auth:
    - Validates request bodies with Zod schemas from `src/validations/auth.validation.js` using `safeParse`.
    - On validation failure, formats Zod errors via `formatValidationError` from `src/utils/format.js` and returns a `400` response.
    - On success, calls service-layer functions (e.g., `createUser`) for business logic.
    - Issues JWTs using `jwttoken.signToken` from `src/utils/jwt.js` and sets them as cookies via `src/utils/cookies.js`.
    - Logs key events (e.g., successful registration) through the shared `logger` instance.

- **Services (`src/services/`)**
  - `auth.service.js` contains authentication-related business logic and DB access:
    - Password management helpers:
      - `hashPassword` – hashes plaintext passwords with `bcrypt`.
      - `comparePassword` – compares plaintext against a stored hash.
    - User management:
      - `createUser` – checks for existing user by email using Drizzle (`db.select().from(users).where(eq(users.email, email))`), hashes the password, inserts a new record, and returns selected columns.
      - `authenticateUser` – fetches user by email, compares passwords, and returns user identity data or throws on failure.
    - All key operations log via the shared `logger` and throw errors up to controllers, which are responsible for translating them into HTTP responses.

### Data modeling and migrations

- `src/models/users.model.js`
  - Defines the `users` table schema using `drizzle-orm/pg-core` (`pgTable`, `serial`, `varchar`, `timestamp`).
  - Tracks fields such as `id`, `name`, `email` (unique), `password`, `role`, `created_at`, and `updated_at`.
- `drizzle/`
  - Contains generated migrations and metadata produced by Drizzle based on the models.
  - Treat these files as generated artifacts; change schemas in `src/models/` and regenerate migrations using `npm run db:generate`.

### Validation and utilities

- **Validation (`src/validations/`)**
  - `auth.validation.js` uses Zod to define request schemas:
    - `signupSchema` – enforces name length, normalizes email, enforces password length, and restricts `role` to `user` or `admin`.
    - `signInSchema` – basic email and password schema for login.
  - Controllers use these schemas to keep validation logic separate from routing and business logic.

- **Utilities (`src/utils/`)**
  - `jwt.js`
    - Wraps `jsonwebtoken` with `jwttoken.signToken` and `jwttoken.verify` helpers.
    - Uses `JWT_SECRET` from env (falling back to a default) and a fixed expiry (currently `1d`).
    - Logs and rethrows on token errors so callers can handle authentication failures.
  - `cookies.js`
    - Centralizes cookie options (e.g., `httpOnly`, `secure` based on `NODE_ENV`, `sameSite`, and `maxAge`).
    - Provides `set`, `clear`, and `get` helpers used by controllers when managing auth cookies.
  - `format.js`
    - Provides `formatValidationError` to convert Zod error objects into concise, user-facing messages.

### Middleware

- `src/middleware/` is currently empty and reserved for reusable Express middleware (e.g., authentication guards or request logging extensions).
- When introducing cross-cutting HTTP concerns, place them here and mount them in `src/app.js`.

### Linting and formatting

- `eslint.config.js` configures ESLint for this project:
  - Based on `@eslint/js` recommended settings.
  - Enforces 2-space indentation, Unix line endings, single quotes, and semicolons.
  - Disallows `var` and encourages `const`.
  - Treats unused variables as errors (but ignores arguments prefixed with `_`).
  - Adds globals for Node and Jest-style test globals (tests are not yet present but config is ready).
- Prettier is used for formatting via the `format` and `format:check` scripts.

### Environment variables

Key environment variables used by the codebase:

- `DB_URL` – PostgreSQL connection string for Neon / Drizzle (`src/config/database.js` and `drizzle.config.js`).
- `PORT` – Port for the HTTP server (defaults to `3000` in `src/server.js`).
- `NODE_ENV` – Controls logger console transport and cookie security defaults.
- `LOG_LEVEL` – Minimum log level for the Winston logger.
- `JWT_SECRET` – Secret key for signing/verifying JWTs in `src/utils/jwt.js`.
