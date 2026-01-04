# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server with Turbopack (runs on port 3000, or next available if in use)
- `npm run dev:daemon` - Start dev server in background, logging to `logs.txt`

### Building & Deployment
- `npm run build` - Create production build
- `npm run start` - Run production server

### Code Quality
- `npm run lint` - Run ESLint on the codebase

### Testing
- `npm run test` - Run all tests with Vitest (jsdom environment)
- `npm run test -- --watch` - Run tests in watch mode
- `npm run test -- src/lib/file-system.ts` - Run tests for a specific file

### Database
- `npm setup` - Install dependencies, generate Prisma client, and run migrations
- `npm run db:reset` - Reset database to initial state (deletes all data, useful for development)

### Environment Setup
- Copy the `.env` template and add `ANTHROPIC_API_KEY=your-key-here` to use Claude API (optional; app falls back to mock data)

## Architecture Overview

### High-Level Structure

UIGen is an AI-powered React component generator with three core layers:

1. **Frontend (Client)**: Next.js 15 with React 19, split into chat interface (left) and code/preview panels (right)
2. **Backend (Server)**: Next.js API routes + Server Actions for AI streaming and project persistence
3. **Data**: Virtual file system (in-memory) + SQLite database for user projects

### Virtual File System (Core Concept)

The app maintains an **in-memory virtual file system** that never writes to disk. Key classes/methods:
- **VirtualFileSystem** (`src/lib/file-system.ts`): Core implementation with methods like `createFile()`, `viewFile()`, `replaceInFile()`, `serialize()`, etc.
- State managed via **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`)
- Full state (all files) serialized to JSON and stored in database as `project.data`
- Supports file operations through AI tool calls: `str_replace_editor` (edit/create) and `file_manager` (rename/delete)

### AI Component Generation Flow

1. User types a prompt in chat
2. Chat submits to `/api/chat/route.ts` with message history and serialized file system
3. API endpoint streams Claude responses using Vercel AI SDK (`ai` package)
4. Claude uses tools to create/edit files in virtual file system
5. Client-side FileSystemContext processes tool results and updates state
6. Preview auto-refreshes when files change
7. On completion, full state persists to database (if authenticated)

### Live Preview System

- **Preview Component** (`src/components/preview/PreviewFrame.tsx`): Renders React components in an iframe
- **JSX Transformation** (`src/lib/transform/jsx-transformer.ts`): Babel transpiles TypeScript/JSX to vanilla JS
- **Import Resolution**: Custom logic resolves local imports (from virtual file system) and external packages
- **Entry Point**: Always uses `App.jsx` (or `App.tsx`) as the root component
- Components execute in isolated iframe scope with error handling

### File Organization & Key Directories

| Directory | Purpose |
|-----------|---------|
| `src/app/` | Next.js 15 App Router: pages, layouts, API routes |
| `src/app/api/chat/` | AI streaming endpoint; core backend logic |
| `src/components/` | React UI components (chat, editor, preview, auth) |
| `src/lib/` | Core business logic: file system, auth, AI provider, tools, transforms |
| `src/lib/contexts/` | React Context for file system and chat state |
| `src/lib/tools/` | AI tool implementations (str_replace, file_manager) |
| `src/lib/prompts/` | System prompt templates for component generation |
| `src/lib/transform/` | JSX compilation and import resolution |
| `src/actions/` | Next.js Server Actions for auth and project management |
| `src/middleware.ts` | JWT session validation for protected routes |
| `prisma/` | Database schema and migrations |

### Data Models

**User**: Email, hashed password, timestamp fields
**Project**: Name, messages (JSON string of chat history), data (serialized file system JSON), user relationship, timestamps

Projects can be:
- **Authenticated**: Associated with a user, persisted to database
- **Anonymous**: Stored in browser localStorage via `anon-work-tracker.ts`, not persisted after session ends

### Authentication & Authorization

- **JWT-based sessions** stored in HTTP-only cookies (7-day expiration)
- **Middleware** (`src/middleware.ts`) validates sessions for protected routes
- **Anonymous access** allowed for chat preview; persistence requires authentication
- Server Actions in `src/actions/` handle signup, signin, signout, project CRUD
- Password hashing with bcrypt

### AI Provider Architecture

- **Provider abstraction** (`src/lib/provider.ts`): Toggles between real Claude (Anthropic API) and mock provider
- Real provider: Uses `@ai-sdk/anthropic` with prompt caching
- Mock provider: Returns static component templates (fallback when no API key)
- System prompt injection with Anthropic prompt caching for consistent instructions
- Supports up to 40 tool-use steps per request

### Key Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Radix UI components, Monaco Editor
- **Backend**: Next.js 15 API Routes + Server Actions
- **AI**: Vercel AI SDK, Anthropic Claude API
- **Database**: Prisma ORM + SQLite
- **Development**: Turbopack, Vitest, ESLint

### Configuration

- **TypeScript paths**: `@/*` maps to `src/*` for clean imports
- **Tailwind**: Configured with Radix UI colors and Tailwind UI typography plugin
- **Next.js**: Dev indicators disabled (cleaner dev experience)
- **Vitest**: Runs in jsdom environment for DOM testing

## Important Implementation Details

### File System Serialization

The virtual file system is serialized to JSON for storage. When loading a project:
1. Fetch project from database
2. Deserialize `project.data` JSON string back to file system
3. Deserialize `project.messages` (chat history)
4. UI auto-populates with previous state

### Chat Message Structure

Messages include:
- `role`: 'user' | 'assistant'
- `content`: Text content
- `toolInvocations`: (for assistant messages) Array of tool calls made by Claude
- Tool results tracked separately for AI context

### Tool Implementation Pattern

Tools are defined in the system prompt and implemented in `src/lib/tools/`:
- **str_replace_editor**: Create files, view files, replace content (handles multi-step edits)
- **file_manager**: Rename and delete files
- Client processes tool calls via `onToolCall` callback in FileSystemContext
- Tool results sent back to LLM for multi-turn interactions

## Testing Notes

- Tests run in jsdom environment (DOM available in tests)
- Testing Library for React component testing
- Key files to test: VirtualFileSystem logic, JSX transformation, auth flows
