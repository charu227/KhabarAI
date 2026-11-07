# Khabar AI – AI-Powered Brand Governance Platform

Khabar AI is a brand governance platform designed to help organizations maintain consistent, compliant, and on-brand communication. It helps teams manage brand guidelines, detect content violations, review marketing drafts, and streamline content approval workflows.

##  Key Features

- **Brand Guidelines Management:** Define and manage brand identity, tone, colours, and communication guidelines.
- **Content Compliance Review:** Detect banned words, unsupported claims, terminology violations, and formatting issues.
- **Rules-Based Review Engine:** Perform local content checks without requiring an external AI API key.
- **Approved Facts & Claims:** Maintain approved information and use it as a reference during content review.
- **Banned Words & Preferred Terminology:** Configure restricted terms and preferred alternatives.
- **Draft Management:** Create, edit, save, and manage content drafts.
- **Review & Approval Workflow:** Enable Creators to submit drafts and Managers to approve or request changes.
- **Before/After Suggestions:** Compare original content with suggested corrections.
- **Notifications:** Track review updates and workflow activities.
- **Version History:** Maintain a record of content changes.
- **Analytics & Reports:** View brand governance and content compliance insights.
- **Team Management:** Manage workspace members and their roles.
- **Cross-Channel Brand Drift:** Compare content across channels and identify potential inconsistencies.

##  Technology Stack

- **Frontend:** HTML, CSS, JavaScript, React
- **Backend:** Node.js, Express.js
- **Storage:** JSON-file persistence
- **Authentication:** JWT
- **Password Security:** bcryptjs
- **Security Middleware:** Helmet, CORS, Express Rate Limit
- **Optional AI Integration:** Anthropic API

##  Requirements

- Windows 10/11, macOS, or Linux
- Node.js 20 or newer
- npm

The project supports Node.js 24 and does not require native C++ addons.

##  Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/charu227/KhabarAI.git
cd khabar-ai-backend
```

Alternatively, download and extract the project ZIP.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file by copying `.env.example`.

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure:

```env
PORT=3000
JWT_SECRET=your-unique-random-secret-of-at-least-32-characters
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

**Note:** Anthropic API key is optional. Keep it blank to use the built-in local rules-based review engine. Generate your own secure JWT secret for local use.

Never upload your actual `.env` file or expose secret keys publicly.

### 4. Run the Project

```bash
npm run check
npm start
```

Open the application in your browser:

```text
http://localhost:3000
```

Do not open `public/index.html` directly. The application should be accessed through the Express server.

##  Login Options

Khabar AI provides three ways to access the platform:

- **Sign Up:** Create a new Creator account with an isolated workspace.
- **Demo Creator:** Explore the platform from a content creator's perspective.
- **Demo Manager:** Explore review, approval, and team management features.

Demo Creator and Demo Manager use a shared demonstration workspace, allowing users to experience the content submission and approval workflow.

Managers can also create team accounts and assign Creator or Manager roles through Team Management.

##  Rules-Based Content Review – No API Key Required

Khabar AI includes a local rules-based review engine that can operate without an external AI service.

It can identify:

- Configured banned words and phrases.
- Preferred terminology violations.
- Unsupported superlatives and absolute claims.
- Potentially unsupported numerical claims and statistics.
- Tone and formatting inconsistencies.
- ALL CAPS formatting patterns.
- Accessibility-related content patterns.
- Hex colour values that do not match configured brand colours.

The review engine also supports deterministic corrections where a confident replacement is available.

**Important:** This is rules-based automation, not a large language model. It does not guarantee complete semantic understanding or factual verification. Nuanced claims, context-dependent language, and visual semantics may require human review or an optional external AI integration.

## 🔄Main Workflow

1. Creator logs in and creates a content draft.
2. Creator submits the content for review.
3. The local review engine checks the content against configured brand rules.
4. Findings, explanations, and suggested corrections are displayed.
5. Creator revises and submits the draft.
6. Manager reviews the submission.
7. Manager approves the draft or requests changes.
8. The workflow status and related notifications are updated.

## 🔌 Backend API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend status |
| POST | `/api/auth/signup` | Create a Creator account |
| POST | `/api/auth/login` | Authenticate a user |
| POST | `/api/auth/demo` | Access Demo Creator or Manager |
| GET | `/api/auth/me` | Validate the current session |
| POST | `/api/auth/logout` | Record logout |
| GET | `/api/team` | List workspace members |
| POST | `/api/team` | Create a team member |
| PATCH | `/api/team/:id` | Update a member's role |
| DELETE | `/api/team/:id` | Remove a team member |
| GET | `/api/state` | Retrieve workspace state |
| PUT | `/api/state` | Save workspace state |
| POST | `/api/ai` | Optional server-side Anthropic API request |
| GET | `/api/audit` | Retrieve audit events |

##  Data Storage

Khabar AI uses JSON-file persistence for local evaluation.

Workspace data and account records are stored in:

```text
data/khabar-data.json
```

Passwords are stored as bcrypt hashes rather than plain text.

Stop the server before manually backing up the data file. The `.env` file and workspace data should not be committed to a public repository.

##  Project Scope

**Project Status: Functional Prototype – Round 2**

Khabar AI is developed as a local-first prototype to demonstrate brand governance, content compliance checking, and collaborative approval workflows.

The current implementation focuses on demonstrating the core product experience and its key workflows rather than providing a fully production-ready enterprise service.

##  Future Enhancements

- Advanced semantic content analysis using AI models.
- More comprehensive factual claim verification.
- Visual logo and brand asset recognition.
- Real-time multi-channel brand monitoring.
- Enterprise database integration.
- Advanced access control and audit capabilities.
- Cloud deployment and scalability improvements.

##  Security & Deployment Note

This project is intended for local hackathon evaluation and prototyping. It is not a production enterprise deployment.

Before public deployment, additional work is required, including stronger record-level authorization, secure invitation flows, password recovery, database migration, monitoring, backups, CSRF protection, and deployment hardening.

Demo authentication endpoints should not be exposed publicly without additional safeguards.

---

**Khabar AI – Making Every Piece of Content Consistent with Your Brand.**
