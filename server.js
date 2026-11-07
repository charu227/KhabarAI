require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// File-based JSON persistence avoids native SQLite bindings, so this package
// can be installed on Windows with Node.js 24 without Visual Studio C++ tools.
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('Set JWT_SECRET in .env (at least 32 characters).');
  process.exit(1);
}

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'khabar-data.json');
fs.mkdirSync(dataDir, { recursive: true });
const emptyStore = () => ({ nextOrgId: 1, nextUserId: 1, nextAuditId: 1, organizations: [], users: [], appStates: [], auditLog: [] });
let store;
try {
  store = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : emptyStore();
  // Repair missing fields if the file was created by an earlier version.
  const defaults = emptyStore();
  for (const [key, value] of Object.entries(defaults)) if (store[key] === undefined) store[key] = value;
} catch (error) {
  console.error('Could not read data/khabar-data.json. If it is corrupted, rename it and restart.', error);
  process.exit(1);
}
function saveStore() {
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempFile, dataFile);
}
function findUserById(id, orgId) {
  const user = store.users.find(item => item.id === Number(id) && item.organization_id === Number(orgId));
  if (!user) return null;
  const org = store.organizations.find(item => item.id === user.organization_id);
  return { ...user, org: org?.name || '' };
}
function addAudit(user, action, detail = '') {
  store.auditLog.push({ id: store.nextAuditId++, organization_id: user.organization_id, user_id: user.id, action, detail: String(detail).slice(0, 500), created_at: new Date().toISOString() });
  if (store.auditLog.length > 10000) store.auditLog = store.auditLog.slice(-10000);
  saveStore();
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '3mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false }));
app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, org: u.org });
function issueToken(u) { return jwt.sign({ sub: u.id, org: u.organization_id, role: u.role }, JWT_SECRET, { expiresIn: '12h' }); }
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Please log in again.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.sub, payload.org);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'Khabar AI API', aiConfigured: !!process.env.ANTHROPIC_API_KEY, storage: 'json-file', version: '1.1.0' }));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, org } = req.body || {};
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Name, email, password and role are required.' });
    if (String(name).trim().length > 100 || String(email).length > 254 || String(password).length < 8 || String(password).length > 128) return res.status(400).json({ error: 'Use a name under 100 characters, valid email and password of 8–128 characters.' });
    if (role !== 'Creator') return res.status(403).json({ error: 'New self-service accounts start as Creator. Ask a workspace Manager to create or promote a Manager account.' });
    const cleanEmail = String(email).trim().toLowerCase();
    if (store.users.some(user => user.email.toLowerCase() === cleanEmail)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const orgName = String(org || '').trim().slice(0, 100) || cleanEmail.split('@')[1];
    // Self-service signup always creates an isolated workspace. Existing workspaces
    // can add members only through the authenticated Manager team endpoint.
    const organization = { id: store.nextOrgId++, name: orgName, created_at: new Date().toISOString() };
    store.organizations.push(organization);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = { id: store.nextUserId++, organization_id: organization.id, name: String(name).trim(), email: cleanEmail, password_hash: passwordHash, role, created_at: new Date().toISOString() };
    store.users.push(user);
    saveStore();
    const fullUser = { ...user, org: organization.name };
    addAudit(fullUser, 'account.created', fullUser.role);
    return res.status(201).json({ token: issueToken(fullUser), user: publicUser(fullUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const user = store.users.find(item => item.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    const fullUser = findUserById(user.id, user.organization_id);
    addAudit(fullUser, 'account.login');
    return res.json({ token: issueToken(fullUser), user: publicUser(fullUser) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});
// Local demo access: creates two isolated demo identities in one shared workspace.
// This endpoint is intended for local evaluation, not public production deployments.
app.post('/api/auth/demo', async (req, res) => {
  try {
    const role = req.body?.role;
    if (!['Creator', 'Manager'].includes(role)) return res.status(400).json({ error: 'Choose Creator or Manager demo access.' });
    const orgName = 'Khabar AI Demo Workspace';
    let organization = store.organizations.find(item => item.name.toLowerCase() === orgName.toLowerCase());
    if (!organization) { organization = { id: store.nextOrgId++, name: orgName, created_at: new Date().toISOString() }; store.organizations.push(organization); }
    const email = role === 'Manager' ? 'demo.manager@khabar.local' : 'demo.creator@khabar.local';
    let user = store.users.find(item => item.email.toLowerCase() === email);
    if (user && user.organization_id !== organization.id) { user.organization_id = organization.id; saveStore(); }
    if (!user) {
      user = {
        id: store.nextUserId++, organization_id: organization.id,
        name: role === 'Manager' ? 'Demo Manager' : 'Demo Creator', email,
        password_hash: await bcrypt.hash(`local-demo-${role}-not-for-production`, 12),
        role, created_at: new Date().toISOString(), demo: true
      };
      store.users.push(user);
      saveStore();
    }
    const fullUser = findUserById(user.id, user.organization_id);
    addAudit(fullUser, 'account.demo_login', role);
    return res.json({ token: issueToken(fullUser), user: publicUser(fullUser), demo: true });
  } catch (error) {
    console.error('Demo login failed:', error);
    return res.status(500).json({ error: 'Could not open the demo account.' });
  }
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/logout', auth, (req, res) => { addAudit(req.user, 'account.logout'); res.json({ ok: true }); });
app.get('/api/team', auth, (req, res) => {
  const users = store.users.filter(user => user.organization_id === req.user.organization_id).map(user => ({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at }));
  res.json({ users });
});

app.post('/api/team', auth, async (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  try {
    const { name, email, password, role = 'Creator' } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and temporary password are required.' });
    if (String(name).trim().length > 100 || String(email).length > 254 || String(password).length < 8 || String(password).length > 128) return res.status(400).json({ error: 'Use a name under 100 characters and a password of 8–128 characters.' });
    if (!['Creator', 'Manager'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    const cleanEmail = String(email).trim().toLowerCase();
    if (store.users.some(user => user.email.toLowerCase() === cleanEmail)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = { id: store.nextUserId++, organization_id: req.user.organization_id, name: String(name).trim(), email: cleanEmail, password_hash: await bcrypt.hash(password, 12), role, created_at: new Date().toISOString() };
    store.users.push(user); saveStore(); addAudit(req.user, 'team.member_created', `${cleanEmail} (${role})`);
    return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at } });
  } catch (error) { console.error('Team member creation failed:', error); return res.status(500).json({ error: 'Could not create team member.' }); }
});
app.patch('/api/team/:id', auth, (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  const target = store.users.find(item => item.id === Number(req.params.id) && item.organization_id === req.user.organization_id);
  if (!target) return res.status(404).json({ error: 'Team member not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
  const role = req.body?.role;
  if (!['Creator', 'Manager'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  const oldRole = target.role; target.role = role; saveStore(); addAudit(req.user, 'team.role_changed', `${target.email}: ${oldRole} -> ${role}`);
  return res.json({ user: { id: target.id, name: target.name, email: target.email, role: target.role, createdAt: target.created_at } });
});
app.delete('/api/team/:id', auth, (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  const index = store.users.findIndex(item => item.id === Number(req.params.id) && item.organization_id === req.user.organization_id);
  if (index < 0) return res.status(404).json({ error: 'Team member not found.' });
  if (store.users[index].id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });
  const [removed] = store.users.splice(index, 1); saveStore(); addAudit(req.user, 'team.member_removed', removed.email);
  return res.json({ ok: true });
});

app.post('/api/team', auth, async (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  try {
    const { name, email, password, role = 'Creator' } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and temporary password are required.' });
    if (String(name).trim().length > 100 || String(email).length > 254 || String(password).length < 8 || String(password).length > 128) return res.status(400).json({ error: 'Use a name under 100 characters and a password of 8–128 characters.' });
    if (role !== 'Creator') return res.status(403).json({ error: 'New self-service accounts start as Creator. Ask a workspace Manager to create or promote a Manager account.' });
    const cleanEmail = String(email).trim().toLowerCase();
    if (store.users.some(user => user.email.toLowerCase() === cleanEmail)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const user = { id: store.nextUserId++, organization_id: req.user.organization_id, name: String(name).trim(), email: cleanEmail, password_hash: await bcrypt.hash(password, 12), role, created_at: new Date().toISOString() };
    store.users.push(user); saveStore(); addAudit(req.user, 'team.member_created', `${cleanEmail} (${role})`);
    return res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at } });
  } catch (error) { console.error('Team member creation failed:', error); return res.status(500).json({ error: 'Could not create team member.' }); }
});
app.patch('/api/team/:id', auth, (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  const target = store.users.find(item => item.id === Number(req.params.id) && item.organization_id === req.user.organization_id);
  if (!target) return res.status(404).json({ error: 'Team member not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role.' });
  const role = req.body?.role;
  if (!['Creator', 'Manager'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  const oldRole = target.role; target.role = role; saveStore(); addAudit(req.user, 'team.role_changed', `${target.email}: ${oldRole} -> ${role}`);
  return res.json({ user: { id: target.id, name: target.name, email: target.email, role: target.role, createdAt: target.created_at } });
});
app.delete('/api/team/:id', auth, (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  const index = store.users.findIndex(item => item.id === Number(req.params.id) && item.organization_id === req.user.organization_id);
  if (index < 0) return res.status(404).json({ error: 'Team member not found.' });
  if (store.users[index].id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account.' });
  const [removed] = store.users.splice(index, 1); saveStore(); addAudit(req.user, 'team.member_removed', removed.email);
  return res.json({ ok: true });
});

app.get('/api/state', auth, (req, res) => {
  const row = store.appStates.find(item => item.organization_id === req.user.organization_id);
  let state = {};
  try { state = row ? JSON.parse(row.state_json) : {}; } catch (error) { state = {}; }
  res.json({ state, updatedAt: row?.updated_at || null });
});
app.put('/api/state', auth, (req, res) => {
  const state = req.body?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return res.status(400).json({ error: 'State must be a JSON object.' });
  const json = JSON.stringify(state);
  if (Buffer.byteLength(json) > 2 * 1024 * 1024) return res.status(413).json({ error: 'Workspace data exceeds 2 MB.' });
  const now = new Date().toISOString();
  const existing = store.appStates.find(item => item.organization_id === req.user.organization_id);
  if (existing) { existing.state_json = json; existing.updated_at = now; }
  else store.appStates.push({ organization_id: req.user.organization_id, state_json: json, updated_at: now });
  saveStore();
  res.json({ ok: true, savedAt: now });
});

app.post('/api/ai', auth, async (req, res) => {
  const { prompt, max_tokens } = req.body || {};
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured. Add ANTHROPIC_API_KEY to the backend .env file and restart the server.' });
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 50000) return res.status(400).json({ error: 'Prompt is empty or too long (maximum 50,000 characters).' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', max_tokens: Math.min(Math.max(Number(max_tokens) || 2500, 256), 6000), messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    if (!response.ok) { console.error('Anthropic API error:', response.status, data?.error?.message); return res.status(response.status === 429 ? 429 : 502).json({ error: data?.error?.message || 'AI provider request failed.' }); }
    const raw = (data.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n');
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end < start) return res.status(502).json({ error: 'AI returned an unreadable response. Please retry.' });
    addAudit(req.user, 'ai.review', `model=${data.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'}`);
    return res.json({ result: JSON.parse(raw.slice(start, end + 1)), model: data.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', usage: data.usage || null });
  } catch (error) {
    console.error('AI request failed:', error);
    return res.status(502).json({ error: 'Could not reach the AI provider. Check internet connection and API configuration.' });
  }
});
app.get('/api/audit', auth, (req, res) => {
  if (req.user.role !== 'Manager') return res.status(403).json({ error: 'Manager access required.' });
  const events = store.auditLog.filter(item => item.organization_id === req.user.organization_id).slice(-200).reverse().map(item => ({ action: item.action, detail: item.detail, createdAt: item.created_at, user: store.users.find(user => user.id === item.user_id)?.name || 'Unknown' }));
  res.json({ events });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Khabar AI running at http://localhost:${PORT}`));
