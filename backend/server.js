const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 3001;
const DB_PATH = path.join(__dirname, 'data', 'kanban.json');

// Middleware
app.use(cors());
app.use(express.json());

// Load or initialize DB
function loadDB() {
  if (fs.existsSync(DB_PATH)) {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }
  return { tasks: [], agents: [] };
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// REST API
app.get('/api/tasks', (req, res) => {
  const db = loadDB();
  res.json(db.tasks);
});

app.post('/api/tasks', (req, res) => {
  const db = loadDB();
  const task = {
    id: Date.now().toString(),
    title: req.body.title || 'Untitled',
    description: req.body.description || '',
    assignee: req.body.assignee || null,
    status: req.body.status || 'Backlog',
    created_by: req.body.created_by || 'unknown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.tasks.push(task);
  saveDB(db);
  io.emit('task:created', task);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const db = loadDB();
  const idx = db.tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Task not found' });
  
  db.tasks[idx] = { ...db.tasks[idx], ...req.body, updated_at: new Date().toISOString() };
  saveDB(db);
  io.emit('task:updated', db.tasks[idx]);
  res.json(db.tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  const db = loadDB();
  db.tasks = db.tasks.filter(t => t.id !== req.params.id);
  saveDB(db);
  io.emit('task:deleted', req.params.id);
  res.json({ success: true });
});

// Agent inbox: POST creates task AND writes to agent's inbox file
app.post('/api/inbox/:agent', (req, res) => {
  const agent = req.params.agent;
  const task = {
    id: Date.now().toString(),
    title: req.body.title || `Task for ${agent}`,
    description: req.body.description || '',
    command: req.body.command || '',
    assignee: agent,
    status: req.body.status || 'Backlog',
    created_by: req.body.created_by || 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Write to Kanban DB
  const db = loadDB();
  db.tasks.push(task);
  saveDB(db);
  
  // Write to agent's inbox file
  const inboxPath = `/home/assi/.openclaw/agents/${agent}/workspace/inbox/${task.id}.json`;
  fs.writeFileSync(inboxPath, JSON.stringify(task, null, 2));
  
  io.emit('task:created', task);
  res.json({ task, agent });
});

// Agent result: POST marks task done and writes result
app.post('/api/result/:agent', (req, res) => {
  const agent = req.params.agent;
  const { task_id, output } = req.body;
  
  const db = loadDB();
  const idx = db.tasks.findIndex(t => t.id === task_id);
  if (idx !== -1) {
    db.tasks[idx].status = 'Done';
    db.tasks[idx].result = output;
    db.tasks[idx].completed_at = new Date().toISOString();
    saveDB(db);
    io.emit('task:updated', db.tasks[idx]);
  }
  res.json({ success: true });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Start server
server.listen(PORT, () => {
  console.log(`Kanban server running on http://127.0.0.1:${PORT}`);
});
