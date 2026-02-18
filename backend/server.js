const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const DATA_FILE = path.join(__dirname, 'db', 'data.json');

const WORKFLOW_STATES = {
  BACKLOG: 'Backlog',
  NOT_STARTED: 'Not Started',
  STARTED: 'Started',
  READY_FOR_REVIEW: 'Ready for Review',
  PENDING_REVIEW: 'Pending Review',
  OWNER_REVIEW: 'Owner Review',
  CHANGES_REQUESTED: 'Changes Requested',
  DONE: 'Done'
};

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { employees: [], tasks: [], events: [], conversations: {}, activities: {} };
  }
}

function save(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}

let db = load();
if (!db.conversations) db.conversations = {};
if (!db.activities) db.activities = {};
if (!db.events) db.events = [];
if (!db.tasks) db.tasks = [];

if (!db.employees || db.employees.length === 0) {
  db.employees = [
    { id: 1, name: 'Assaf', role: 'Owner', status: 'active' },
    { id: 2, name: 'Assi', role: 'Reviewer', status: 'active' },
    { id: 3, name: 'manager', role: 'Reviewer', status: 'active' }
  ];
  save(db);
}

function now() {
  return new Date().toISOString();
}

function addConversation(taskId, author, message, extra = {}) {
  if (!db.conversations[taskId]) db.conversations[taskId] = [];
  db.conversations[taskId].push({ author, message, timestamp: now(), ...extra });
}

function addEvent(type, payload) {
  db.events.push({ type, payload, created_at: now() });
}

function findTask(id) {
  return db.tasks.find((x) => x.id === id);
}

function getParticipants(task) {
  const s = new Set();
  if (!task) return [];
  if (task.created_by) s.add(String(task.created_by).toLowerCase());
  if (task.assignee) s.add(String(task.assignee).toLowerCase());
  (task.reviewers || []).forEach((r) => r && s.add(String(r).toLowerCase()));
  (task.contributors || []).forEach((c) => c && s.add(String(c).toLowerCase()));
  const conv = db.conversations[task.id] || [];
  conv.forEach((m) => m.author && s.add(String(m.author).toLowerCase()));

  // Alias normalization (same person can appear under different labels)
  if (s.has('assaf') || s.has('mr-a') || s.has('assaf (boss)')) {
    s.add('mr-a');
    s.add('assaf');
  }

  return [...s];
}

function notifyAgentWake(agent, task, reason, sender) {
  if (!agent) return { agent, skipped: true, why: 'no_agent' };
  const a = String(agent).toLowerCase();
  const s = String(sender || '').toLowerCase();
  if (a === s) return { agent: a, skipped: true, why: 'sender' }; // never wake sender

  const inboxDir = path.join(process.env.HOME || '/home/assi', '.openclaw', 'agents', a, 'workspace', 'inbox');
  try {
    fs.mkdirSync(inboxDir, { recursive: true });
    fs.writeFileSync(path.join(inboxDir, `${task.id}.json`), JSON.stringify(task, null, 2));
    fs.writeFileSync(
      path.join(inboxDir, `wake_${task.id}.json`),
      JSON.stringify({ wake: `Task ${task.id} requires your attention`, reason, task_id: task.id, sender: sender || 'system' }, null, 2)
    );
    return { agent: a, wrote: true };
  } catch (e) {
    console.error('wake_failed', a, e.message);
    return { agent: a, wrote: false, error: e.message };
  }
}

function notifyRelevant(task, reason, sender) {
  const participants = getParticipants(task);
  const results = participants.map((p) => notifyAgentWake(p, task, reason, sender));
  addEvent('wake_dispatched', { taskId: task.id, reason, sender, participants, results });
}

function ownerMatches(task, actor) {
  const owner = (task.created_by || '').toLowerCase();
  const a = (actor || '').toLowerCase();
  return a === owner || (['mr-a', 'assaf'].includes(a) && ['mr-a', 'assaf'].includes(owner));
}

function isDevelopmentTask(task) {
  if (!task) return false;
  const type = String(task.task_type || task.type || '').toLowerCase();
  // Strict classification only: never infer dev-task from free text.
  // This prevents non-dev tasks from being blocked by TDD gate.
  if (['dev', 'development', 'software', 'frontend', 'backend', 'fullstack', 'devops'].includes(type)) return true;
  return task.tdd_required === true;
}

function hasTddEvidence(task) {
  const e = task?.tdd_evidence || {};
  return Boolean(e.spec_path && e.red_test_evidence && e.green_test_evidence);
}

app.get('/', (req, res) => res.json({ ok: true }));
app.get('/employees', (req, res) => res.json(db.employees));

app.get('/api/tasks', (req, res) => res.json(db.tasks));

app.get('/api/tasks/:id', (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const { title, description, assignee, status, created_by, dod, task_type, tdd_required, tdd_evidence, contributors } = req.body;
  if (!title || title.trim().length < 5) return res.status(400).json({ error: 'Title must be at least 5 characters' });
  if (!dod || !Array.isArray(dod) || dod.length === 0) return res.status(400).json({ error: 'Task must have a Definition of Done (DoD)' });

  const task = {
    id: Date.now().toString(),
    title: title.trim(),
    description: description || '',
    assignee: assignee || 'assi',
    created_by: created_by || 'mr-a',
    dod,
    status: status || WORKFLOW_STATES.BACKLOG,
    reviewers: [],
    reviews: {},
    owner_final_review: null,
    contributors: Array.isArray(contributors) ? contributors : [],
    task_type: task_type || null,
    tdd_required: tdd_required === true || String(task_type || '').toLowerCase() === 'development',
    tdd_evidence: tdd_evidence || null,
    updated_at: now(),
    created_at: now()
  };

  db.tasks.push(task);
  addEvent('task_created', task);
  addConversation(task.id, task.created_by, `Created task. Status: ${task.status}`, { type: 'task_created' });
  save(db);
  io.emit('task:created', task);
  notifyRelevant(task, 'task_created', task.created_by);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  Object.assign(task, req.body, { updated_at: now() });
  addEvent('task_updated', { taskId: task.id, patch: req.body });
  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'task_updated', req.body.actor || req.body.author || 'system');
  res.json(task);
});

app.delete('/api/tasks/:id', (req, res) => {
  db.tasks = db.tasks.filter((x) => x.id !== req.params.id);
  delete db.conversations[req.params.id];
  delete db.activities[req.params.id];
  save(db);
  io.emit('task:deleted', req.params.id);
  res.json({ ok: true });
});

// Backlog/Not Started -> Started
app.post('/api/tasks/:id/take', (req, res) => {
  const { agent } = req.body;
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assignee !== agent) return res.status(403).json({ error: 'Only assignee can take task' });
  if (![WORKFLOW_STATES.BACKLOG, WORKFLOW_STATES.NOT_STARTED, WORKFLOW_STATES.CHANGES_REQUESTED].includes(task.status)) {
    return res.status(400).json({ error: 'Invalid status transition', current: task.status });
  }
  const from = task.status;
  task.status = WORKFLOW_STATES.STARTED;
  task.updated_at = now();
  addConversation(task.id, agent, `${agent} started work`, { type: 'status_change', from, to: task.status });
  addEvent('task_started', { taskId: task.id, by: agent });
  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'task_started', agent);
  res.json({ ok: true, task });
});

// Started -> Ready for Review
app.post('/api/tasks/:id/ready-for-review', (req, res) => {
  const { agent, note } = req.body;
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assignee !== agent) return res.status(403).json({ error: 'Only assignee can mark ready for review' });
  if (task.status !== WORKFLOW_STATES.STARTED) return res.status(400).json({ error: 'Task must be Started', current: task.status });

  // Hard DoD gate for title-change tasks: prevent false "done" claims
  const m = (task.title || '').match(/change page title to\s*['"]([^'"]+)['"]/i);
  if (m) {
    const expectedTitle = m[1].trim();
    const appPath = '/home/assi/.openclaw/workspace/org-observability/frontend/src/App.jsx';
    try {
      const src = fs.readFileSync(appPath, 'utf8');
      // Strict check: title must match the Kanban board header (inside function KanbanBoard)
      const kanbanIdx = src.indexOf('function KanbanBoard()');
      const section = kanbanIdx >= 0 ? src.slice(kanbanIdx) : src;
      const mHeader = section.match(/<h1 style=\{styles\.(?:pageTitle|title)\}>\s*📋\s*([^<]+)<\/h1>/);
      const actual = mHeader ? mHeader[1].trim() : null;
      if (!actual || actual !== expectedTitle) {
        return res.status(400).json({
          error: `DoD check failed: expected Kanban header title "${expectedTitle}", actual "${actual || 'N/A'}"`,
          expectedTitle,
          actualTitle: actual || null
        });
      }
    } catch {
      return res.status(500).json({ error: 'DoD validation failed: cannot read frontend App.jsx' });
    }
  }

  const from = task.status;
  task.status = WORKFLOW_STATES.READY_FOR_REVIEW;
  task.updated_at = now();
  addConversation(task.id, agent, note || `${agent} completed work and moved task to Ready for Review`, { type: 'status_change', from, to: task.status });
  addEvent('ready_for_review', { taskId: task.id, by: agent });

  // Auto-escalate to level-1 review from code (no manual wake/request dependency)
  // For development tasks, require TDD evidence before auto-escalation.
  const devTask = isDevelopmentTask(task);
  const tddOk = !devTask || hasTddEvidence(task);

  if (!tddOk) {
    addConversation(task.id, 'system', 'TDD evidence missing (spec_path + red_test_evidence + green_test_evidence). Staying in Ready for Review until evidence is attached.', {
      type: 'tdd_gate_block',
      required: ['spec_path', 'red_test_evidence', 'green_test_evidence']
    });
    addEvent('tdd_gate_blocked', { taskId: task.id, by: agent });
    save(db);
    io.emit('task:updated', task);
    notifyRelevant(task, 'tdd_gate_blocked', 'system');
    return res.json({ ok: true, task, blocked: 'tdd_evidence_missing' });
  }

  task.status = WORKFLOW_STATES.PENDING_REVIEW;
  task.reviewers = ['manager', 'assi'];
  task.reviews = {};
  task.updated_at = now();
  addConversation(task.id, agent, `${agent} verified completion. Auto-requesting level-1 review from manager and assi`, {
    type: 'review_requested_auto',
    from: WORKFLOW_STATES.READY_FOR_REVIEW,
    to: task.status,
    reviewers: task.reviewers
  });
  addEvent('level1_review_requested_auto', { taskId: task.id, by: agent, reviewers: task.reviewers });

  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'level1_review_requested_auto', agent);
  res.json({ ok: true, task });
});

// Ready for Review -> Pending Review (owner requests level-1 review from manager + assi)
app.post('/api/tasks/:id/verify-and-request-review', (req, res) => {
  const { actor, reviewers, message } = req.body;
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== WORKFLOW_STATES.READY_FOR_REVIEW) return res.status(400).json({ error: 'Task must be Ready for Review', current: task.status });
  if (!ownerMatches(task, actor)) return res.status(403).json({ error: 'Only owner can request level-1 review' });

  if (isDevelopmentTask(task) && !hasTddEvidence(task)) {
    return res.status(400).json({
      error: 'TDD evidence is required for development tasks before requesting review',
      required: ['spec_path', 'red_test_evidence', 'green_test_evidence']
    });
  }

  const expected = ['manager', 'assi'];
  const asked = Array.isArray(reviewers) ? reviewers.map((r) => String(r).toLowerCase()).sort() : [];
  if (asked.length !== 2 || asked[0] !== 'assi' || asked[1] !== 'manager') {
    return res.status(400).json({ error: 'Level-1 reviewers must be exactly: manager and assi' });
  }

  const from = task.status;
  task.status = WORKFLOW_STATES.PENDING_REVIEW;
  task.reviewers = expected;
  task.reviews = {};
  task.updated_at = now();

  addConversation(task.id, actor, message || `${actor} requested level-1 review from manager and assi`, {
    type: 'review_requested',
    from,
    to: task.status,
    reviewers: expected
  });
  addEvent('level1_review_requested', { taskId: task.id, by: actor, reviewers: expected });
  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'level1_review_requested', actor);
  res.json({ ok: true, task });
});

// Pending Review loop
app.post('/api/tasks/:id/approve-review', (req, res) => {
  const { reviewer, approved, feedback } = req.body;
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== WORKFLOW_STATES.PENDING_REVIEW) return res.status(400).json({ error: 'Task must be Pending Review', current: task.status });
  if (!task.reviewers.includes(reviewer)) return res.status(403).json({ error: 'Reviewer not allowed', reviewers: task.reviewers });
  if (approved === false && (!feedback || !feedback.trim())) return res.status(400).json({ error: 'Feedback is required when rejecting' });

  task.reviews[reviewer] = { approved: approved !== false, feedback: feedback || '', timestamp: now() };

  if (approved === false) {
    const from = task.status;
    task.status = WORKFLOW_STATES.CHANGES_REQUESTED;
    task.updated_at = now();
    addConversation(task.id, reviewer, `${reviewer} rejected level-1 review: ${feedback}`, {
      type: 'level1_reject',
      from,
      to: task.status,
      feedback,
      notify: task.assignee
    });
    addEvent('level1_review_rejected', { taskId: task.id, by: reviewer, feedback, notify: task.assignee });
    save(db);
    io.emit('task:updated', task);
    notifyRelevant(task, 'level1_review_rejected', reviewer);
    return res.json({ ok: true, task, notifyAssignee: task.assignee });
  }

  const allApproved = task.reviewers.every((r) => task.reviews[r]?.approved === true);
  if (allApproved) {
    const from = task.status;
    task.status = WORKFLOW_STATES.OWNER_REVIEW;
    task.updated_at = now();
    addConversation(task.id, reviewer, `${reviewer} approved. All level-1 approvals complete. Moving to Owner Review`, {
      type: 'level1_complete',
      from,
      to: task.status
    });
    addEvent('level1_review_completed', { taskId: task.id, reviewers: task.reviewers });
  } else {
    const pending = task.reviewers.filter((r) => !task.reviews[r]);
    addConversation(task.id, reviewer, `${reviewer} approved level-1 review. Pending: ${pending.join(', ')}`, {
      type: 'level1_partial_approval',
      pending
    });
    addEvent('level1_review_partial', { taskId: task.id, by: reviewer, pending });
  }

  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'level1_review_updated', reviewer);
  res.json({ ok: true, task });
});

// Owner level-2 final decision
app.post('/api/tasks/:id/final-approve', (req, res) => {
  const { approver, feedback } = req.body;
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== WORKFLOW_STATES.OWNER_REVIEW) return res.status(400).json({ error: 'Task must be Owner Review', current: task.status });
  if (!ownerMatches(task, approver)) return res.status(403).json({ error: 'Only owner can mark Done' });

  const from = task.status;
  task.status = WORKFLOW_STATES.DONE;
  task.owner_final_review = { approver, approved: true, feedback: feedback || '', timestamp: now() };
  task.approved_by = approver;
  task.updated_at = now();

  addConversation(task.id, approver, `${approver} gave final owner approval. Task marked Done`, {
    type: 'owner_final_approval',
    from,
    to: task.status,
    feedback: feedback || ''
  });
  addEvent('owner_final_approved', { taskId: task.id, by: approver });
  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'owner_final_approved', approver);
  res.json({ ok: true, task });
});

app.post('/api/tasks/:id/final-reject', (req, res) => {
  const { approver, feedback } = req.body;
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status !== WORKFLOW_STATES.OWNER_REVIEW) return res.status(400).json({ error: 'Task must be Owner Review', current: task.status });
  if (!ownerMatches(task, approver)) return res.status(403).json({ error: 'Only owner can perform final rejection' });
  if (!feedback || !feedback.trim()) return res.status(400).json({ error: 'Feedback is required when rejecting' });

  const from = task.status;
  task.status = WORKFLOW_STATES.CHANGES_REQUESTED;
  task.owner_final_review = { approver, approved: false, feedback, timestamp: now() };

  // Keep task contract aligned with owner feedback (button-based rejection path)
  const mQuoted = String(feedback).match(/['"]([^'"]+)['"]/);
  const mTo = String(feedback).match(/(?:title\s*to|ל)\s*([^\n\r.!?]+)/i);
  const requestedTitle = (mQuoted?.[1] || mTo?.[1] || '').trim();
  if (requestedTitle) {
    task.title = `Change page title to '${requestedTitle}'`;
  }

  task.updated_at = now();

  addConversation(task.id, approver, `${approver} requested changes in owner review: ${feedback}`, {
    type: 'owner_final_reject',
    from,
    to: task.status,
    feedback,
    notify: task.assignee,
    requestedTitle: requestedTitle || null
  });
  addEvent('owner_final_rejected', { taskId: task.id, by: approver, feedback, notify: task.assignee, requestedTitle: requestedTitle || null });
  save(db);
  io.emit('task:updated', task);
  notifyRelevant(task, 'owner_final_rejected', approver);
  res.json({ ok: true, task, notifyAssignee: task.assignee });
});

app.get('/api/tasks/:id/workflow', (req, res) => {
  const task = findTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ currentStatus: task.status, reviewers: task.reviewers || [], reviews: task.reviews || {}, ownerFinalReview: task.owner_final_review || null });
});

app.get('/api/tasks/:id/conversation', (req, res) => {
  const id = req.params.id;
  res.json({ task_id: id, messages: db.conversations[id] || [] });
});

app.post('/api/tasks/:id/conversation', (req, res) => {
  const id = req.params.id;
  const { author, message } = req.body;
  if (!author || !message) return res.status(400).json({ error: 'author and message required' });
  addConversation(id, author, message, { type: 'message' });
  const task = findTask(id);

  if (task) {
    // Owner intent auto-action in Owner Review:
    // if owner writes a change request in conversation, automatically convert to final-reject
    // to trigger implementation flow without extra manual click.
    const isOwner = ownerMatches(task, author);
    const text = String(message || '').trim();
    const looksLikeChangeRequest = /(change|modify|update|please change|fix|revise|שנה|תשנה|לתקן|תתקן|עדכן|תעדכן|תשנו|שנו)/i.test(text);
    if (task.status === WORKFLOW_STATES.OWNER_REVIEW && isOwner && looksLikeChangeRequest) {
      const from = task.status;
      task.status = WORKFLOW_STATES.CHANGES_REQUESTED;
      task.owner_final_review = { approver: author, approved: false, feedback: text, timestamp: now() };

      // If owner requested a new title in free text, update task title contract as well
      // so DoD strict check and worker intent stay aligned.
      const mQuoted = text.match(/['"]([^'"]+)['"]/);
      const mTo = text.match(/(?:title\s*to|ל)\s*([^\n\r.!?]+)/i);
      const requestedTitle = (mQuoted?.[1] || mTo?.[1] || '').trim();
      if (requestedTitle) {
        task.title = `Change page title to '${requestedTitle}'`;
      }

      task.updated_at = now();

      addConversation(task.id, author, `${author} requested changes in owner review: ${text}`, {
        type: 'owner_final_reject',
        from,
        to: task.status,
        feedback: text,
        notify: task.assignee,
        source: 'conversation_auto_owner_intent'
      });
      addEvent('owner_final_rejected_auto_from_conversation', {
        taskId: task.id,
        by: author,
        feedback: text,
        notify: task.assignee,
        requestedTitle: requestedTitle || null
      });
    }

    notifyRelevant(task, 'conversation_new', author);

    // Hard rule: owner must always be awakened on new conversation messages
    // (even if owner is the sender / any task stage).
    const owner = String(task.created_by || '').toLowerCase();
    if (owner) {
      const ownerWake = notifyAgentWake(owner, task, 'conversation_new_owner_forced', 'system');
      addEvent('owner_wake_forced', { taskId: task.id, reason: 'conversation_new_owner_forced', owner, result: ownerWake });
    }
  }

  save(db);
  io.emit('conversation:new', { task_id: id, message: db.conversations[id][db.conversations[id].length - 1] });
  io.emit('task:updated', task || findTask(id));
  res.json({ ok: true });
});

app.patch('/api/tasks/:taskId/conversation/:messageIndex', (req, res) => {
  const { taskId, messageIndex } = req.params;
  const idx = Number(messageIndex);
  const { author, message } = req.body;
  const list = db.conversations[taskId] || [];
  if (!list[idx]) return res.status(404).json({ error: 'Message not found' });
  if (list[idx].author !== author) return res.status(403).json({ error: 'Only author can edit message' });
  list[idx].message = message;
  list[idx].edited = true;
  list[idx].edited_at = now();
  save(db);
  io.emit('conversation:updated', { task_id: taskId, messageIndex: idx, message: list[idx] });
  res.json({ ok: true, message: list[idx] });
});

app.delete('/api/tasks/:taskId/conversation/:messageIndex', (req, res) => {
  const { taskId, messageIndex } = req.params;
  const idx = Number(messageIndex);
  const { author } = req.body;
  const list = db.conversations[taskId] || [];
  if (!list[idx]) return res.status(404).json({ error: 'Message not found' });
  if (list[idx].author !== author) return res.status(403).json({ error: 'Only author can delete message' });
  list.splice(idx, 1);
  save(db);
  io.emit('conversation:deleted', { task_id: taskId, messageIndex: idx });
  res.json({ ok: true });
});

app.post('/api/tasks/:id/activity', (req, res) => {
  const id = req.params.id;
  const { agent, action, details } = req.body;
  if (!db.activities[id]) db.activities[id] = [];
  db.activities[id].push({ timestamp: now(), agent, action, details });
  db.activities[id] = db.activities[id].slice(-50);
  save(db);
  io.emit('activity:new', { task_id: id, activity: db.activities[id][db.activities[id].length - 1] });
  res.json({ ok: true });
});

app.get('/api/tasks/:id/activity', (req, res) => {
  res.json({ task_id: req.params.id, activities: db.activities[req.params.id] || [] });
});

app.get('/api/events', (req, res) => res.json(db.events.slice(-200)));

io.on('connection', () => {});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('backend listening', PORT));
