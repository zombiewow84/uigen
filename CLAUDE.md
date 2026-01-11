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
- `npm run test -- src/lib/__tests__/file-system.test.ts` - Run tests for a specific file

### Database
- `npm run setup` - Install dependencies, generate Prisma client, and run migrations
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
- Supports file operations through AI tool calls: `str_replace_editor` and `file_manager`

### AI Component Generation Flow

1. User types a prompt in chat
2. Chat submits to `/api/chat/route.ts` with message history and serialized file system
3. API endpoint streams Claude responses using Vercel AI SDK (`ai` package)
4. Claude uses tools to create/edit files in virtual file system
5. Client-side FileSystemContext processes tool results via `handleToolCall` and updates state
6. Preview auto-refreshes when files change (via `refreshTrigger`)
7. On completion, full state persists to database (if authenticated)

### Live Preview System

- **Preview Component** (`src/components/preview/PreviewFrame.tsx`): Renders React components in an iframe
- **JSX Transformation** (`src/lib/transform/jsx-transformer.ts`): Babel transpiles TypeScript/JSX to vanilla JS
- **Import Resolution**: Creates import map with blob URLs for local files and esm.sh URLs for packages
- **Tailwind CSS**: Loaded via CDN (`https://cdn.tailwindcss.com`) in preview iframe
- **Entry Point**: Always uses `App.jsx` (or `App.tsx`) as the root component
- **Error Handling**: ErrorBoundary wraps component, syntax errors displayed inline
- **CSS Support**: CSS files collected and injected as `<style>` tags in preview

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
| `src/generated/prisma/` | Generated Prisma client (auto-generated, do not edit) |
| `prisma/` | Database schema and migrations |

### Data Models

**User**: `id`, `email`, `password` (hashed), `createdAt`, `updatedAt`
**Project**: `id`, `name`, `userId` (optional), `messages` (JSON string), `data` (serialized file system JSON), `createdAt`, `updatedAt`

Projects can be:
- **Authenticated**: Associated with a user, persisted to database
- **Anonymous**: Stored in browser localStorage via `anon-work-tracker.ts`, not persisted after session ends

### Authentication & Authorization

- **JWT-based sessions** stored in HTTP-only cookies (7-day expiration)
- **Middleware** (`src/middleware.ts`) validates sessions for protected routes (`/api/projects`, `/api/filesystem`)
- **Anonymous access** allowed for chat/preview; persistence requires authentication
- Server Actions in `src/actions/` handle signup, signin, signout, project CRUD
- Password hashing with bcrypt

### AI Provider Architecture

- **Provider abstraction** (`src/lib/provider.ts`): Toggles between real Claude (Anthropic API) and mock provider
- **Model**: `claude-haiku-4-5` via `@ai-sdk/anthropic`
- Real provider: Uses Anthropic API with prompt caching via `cacheControl: { type: "ephemeral" }`
- Mock provider: Returns static component templates (fallback when no API key)
- System prompt defined in `src/lib/prompts/generation.tsx`
- Supports up to 40 tool-use steps per request (4 for mock), max 10,000 tokens
- API route has `maxDuration = 120` seconds for long-running requests

### Key Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Radix UI components, Monaco Editor
- **Backend**: Next.js 15 API Routes + Server Actions
- **AI**: Vercel AI SDK (`ai` package), Anthropic Claude API (`@ai-sdk/anthropic`)
- **Database**: Prisma ORM + SQLite
- **Development**: Turbopack, Vitest, ESLint

### Configuration

- **TypeScript paths**: `@/*` maps to `src/*` for clean imports
- **Tailwind**: Configured with Radix UI colors and Tailwind UI typography plugin
- **Next.js**: Dev indicators disabled (cleaner dev experience)
- **Vitest**: Runs in jsdom environment for DOM testing (`vitest.config.mts`)

## Important Implementation Details

### File System Serialization

The virtual file system is serialized to JSON for storage. When loading a project:
1. Fetch project from database
2. Deserialize `project.data` JSON string back to file system via `deserializeFromNodes()`
3. Deserialize `project.messages` (chat history)
4. UI auto-populates with previous state

### Chat Message Structure

Messages include:
- `role`: 'user' | 'assistant' | 'system'
- `content`: Text content
- `toolInvocations`: (for assistant messages) Array of tool calls made by Claude
- Tool results tracked separately for AI context

### AI Tools

Tools are defined with Zod schemas in `src/lib/tools/`:

**str_replace_editor** - Text editor operations:
- `view`: View file content with optional line range (`view_range`)
- `create`: Create new file with content (`file_text`)
- `str_replace`: Replace text (`old_str` -> `new_str`)
- `insert`: Insert text at line number (`insert_line`, `new_str`)
- `undo_edit`: Not supported (returns error message)

**file_manager** - File operations:
- `rename`: Rename/move file (`path` -> `new_path`)
- `delete`: Delete file or directory (`path`)

### Preview Import Resolution

The JSX transformer (`src/lib/transform/jsx-transformer.ts`) handles imports:
1. Local files: Transformed with Babel, converted to blob URLs
2. Third-party packages: Resolved via `https://esm.sh/{package}`
3. Missing local imports: Placeholder modules created
4. `@/` alias: Maps to root directory (`/`)
5. CSS imports: Extracted and injected as inline styles

### System Prompt (Component Generation)

Located in `src/lib/prompts/generation.tsx`, the prompt enforces:
- Root `/App.jsx` file requirement
- Tailwind CSS only (no inline styles or CSS files)
- Consistent design system (color palette, typography, spacing)
- `lucide-react` for icons
- Accessibility best practices
- Mobile-first responsive design

## Testing Notes

- Tests run in jsdom environment (DOM available in tests)
- Testing Library for React component testing (`@testing-library/react`)
- Vitest config in `vitest.config.mts` with tsconfig paths support
- Test files located in `__tests__/` directories alongside source files
- Key areas to test: VirtualFileSystem logic, JSX transformation, auth flows, React contexts

## Code Conventions

- Use TypeScript for all new code
- Prefer functional components with hooks
- Use `@/` import alias for all internal imports
- Keep components focused and composable
- Use descriptive variable names
- Follow existing patterns in the codebase
