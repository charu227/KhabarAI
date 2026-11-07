# Khabar AI — local-first complete evaluation build

This build keeps the existing Khabar AI interface and connects it to an Express backend with JSON-file persistence, authenticated accounts, demo roles, team administration, and local rules-based review. It supports Node.js 20+ (including Node.js 24) without native C++ addons.

## Requirements
- Windows 10/11, macOS, or Linux
- Node.js 20 or newer

## Start on Windows
1. Extract the ZIP.
2. Open the `khabar-ai-backend` folder in VS Code.
3. Open Terminal in that folder.
4. Keep the included `.env` for local evaluation; `ANTHROPIC_API_KEY` is intentionally blank. Do not share `.env` or expose this local server publicly.
5. Run:
   ```powershell
   npm install
   npm run check
   npm start
   ```
6. Open `http://localhost:3000` (do not open `public/index.html` directly).

## Login options
- Sign Up creates a new Creator account and an isolated workspace.
- Existing users can log in with their email and password.
- Demo Creator and Demo Manager quick-login buttons open two accounts in one shared demo workspace.
- A Manager can create Creator or Manager accounts from **Team Management**. The manager sets a temporary password and shares it privately with the new member.

## No API key required
The built-in local rules engine is the default when `ANTHROPIC_API_KEY` is blank. Content Review can check: configured banned terms, preferred terminology, tone examples, unsupported superlatives and statistics, absolute claims, accessibility patterns, ALL CAPS formatting, and off-palette hex colours. Claim verification, document extraction and cross-channel drift have deterministic/heuristic fallbacks. Before/After can apply safe local substitutions where the rule engine has a confident replacement; remaining edits are explicitly left for human review.

This is **rules-based automation, not a large language model**. It cannot reliably understand nuanced meaning, detect every unsupported claim, or inspect image semantics. Visual colour/format checks are local; logo/font semantic recognition requires an external vision model. Managers should review high-risk claims before approval.

## Connected features
- Signup, login, logout, Demo Creator and Demo Manager
- Role-aware Creator and Manager navigation
- Workspace JSON persistence and restoration
- Brand Guidelines, approved facts, terminology and version history
- Draft management, local content review and explainable findings
- Claim verification with approved-fact matching fallback
- Before/After comparison and deterministic corrections
- Creator submission and Manager review/approval workflow
- Notifications, review queue, comments and revision history
- Governance settings and review rules
- Governance analytics, guideline intelligence, reports and audit timeline
- Team Management: create accounts, change roles, remove accounts, view activity
- Cross-Channel Brand Drift: compare channel content, detect numeric price/offer/spec mismatches, export report

## Data and backup
Workspace data and account records are stored in `data/khabar-data.json`. Passwords are stored as bcrypt hashes. Stop the server before backing up this file. The bundled JWT secret is for local evaluation only; replace it before any deployment.

## API routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Backend status and AI-key presence |
| POST | `/api/auth/signup` | Create isolated Creator workspace |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/demo` | Demo Creator/Manager access |
| GET | `/api/auth/me` | Validate session |
| POST | `/api/auth/logout` | Record logout |
| GET | `/api/team` | List workspace members |
| POST | `/api/team` | Manager creates a member account |
| PATCH | `/api/team/:id` | Manager changes a member role |
| DELETE | `/api/team/:id` | Manager removes a member |
| GET/PUT | `/api/state` | Read/save workspace state |
| POST | `/api/ai` | Optional server-side Anthropic call (only when key exists) |
| GET | `/api/audit` | Manager audit event list |

## Important scope note
This is a local-first hackathon/evaluation build, not a production enterprise deployment. Workspace state is stored as one shared JSON document per organisation; a production release should move to normalized database records and enforce permissions per record/action, add invitation tokens/password reset, backups, monitoring, CSRF protections and deployment hardening. The demo login endpoints must not be exposed publicly.
