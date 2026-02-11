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

const DATA_FILE = path.join(__dirname,'db','data.json');
function load(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){
    return {employees:[], tasks:[], events:[], conversations:{}};
  }
}
function save(d){ fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2)); }

let db = load();
if (!db.employees || db.employees.length===0){
  db.employees = [
    {id:1,name:'Assaf',role:'CEO',manager:null,status:'active'},
    {id:2,name:'Assi',role:'Digital Clone',manager:'Assaf',status:'active'},
    {id:3,name:'Mira Cohen',role:'Team Leader',manager:'Assi',status:'active'},
    {id:4,name:'Daniel Levi',role:'Backend Developer',manager:'Mira Cohen',status:'idle'},
    {id:5,name:'Lior Katz',role:'Frontend Developer',manager:'Mira Cohen',status:'idle'},
    {id:6,name:'Rina Bar-On',role:'DevOps',manager:'Mira Cohen',status:'idle'},
    {id:7,name:'Eros',role:'Romantic-Manager',manager:'Assi',status:'idle'}
  ];
  save(db);
}

// Ensure conversations object exists
if (!db.conversations) db.conversations = {};

app.get('/employees', (req,res)=>{ res.json(db.employees); });

// Tasks
app.get('/api/tasks', (req,res)=>{ res.json(db.tasks); });

// Task validation
function isMeaningfulTitle(title) {
  // Reject cryptic IDs like "bug fix #123", "e2e117", "task-12345"
  const crypticPatterns = [
    /^bug\s*#?\s*\d+$/i,
    /^e2e\s*\d+$/i,
    /^task\s*[-\s#]\s*\d+$/i,
    /^[a-z]+\s*\d+$/i,
    /^\d+$/,
  ];
  
  return !crypticPatterns.some(pattern => pattern.test(title.trim())) && 
         title.trim().length >= 10;
}

app.post('/api/tasks', (req,res)=>{
  const {title,description,assignee,status,created_by} = req.body;
  
  // Validate meaningful title
  if (!title || title.trim().length < 5) {
    return res.status(400).json({error: 'Title must be at least 5 characters'});
  }
  
  if (!isMeaningfulTitle(title)) {
    return res.status(400).json({
      error: 'Title must be descriptive. Instead of "bug #123", use something like "Fix login timeout issue"',
      hint: 'Make titles human-readable so anyone can understand the task at a glance'
    });
  }
  
  // BLOCK system-created tasks (2026-02-11)
  if (created_by === 'system') {
    return res.status(400).json({error: 'Tasks cannot be created by "system". Use "assi" or a valid agent name.'});
  }
  
  const id = Date.now().toString();
  const task = {id,title,description,assignee,status:status||'Backlog',created_by,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  db.tasks.push(task);
  db.events.push({type:'task_created',payload:task,created_at:new Date().toISOString()});
  save(db);
  io.emit('task:created',task);
  res.json(task);
});

app.patch('/api/tasks/:id', (req,res)=>{
  const id = req.params.id;
  const t = db.tasks.find(x=>x.id===id);
  if(!t) return res.status(404).json({error:'not found'});
  Object.assign(t, req.body, {updated_at:new Date().toISOString()});
  db.events.push({type:'task_updated',payload:t,created_at:new Date().toISOString()});
  save(db);
  io.emit('task:updated',t);
  res.json(t);
});

app.delete('/api/tasks/:id', (req,res)=>{
  const id = req.params.id;
  db.tasks = db.tasks.filter(x=>x.id!==id);
  save(db);
  io.emit('task:deleted',id);
  res.json({ok:true});
});

// Conversation endpoints
app.get('/api/tasks/:id/conversation', (req,res)=>{
  const id = req.params.id;
  const messages = db.conversations[id] || [];
  res.json({task_id:id, messages});
});

app.post('/api/tasks/:id/conversation', (req,res)=>{
  const id = req.params.id;
  const {author, message} = req.body;
  
  // AGENT MESSAGE POLICY (2026-02-11):
  // - Agents can post HELP REQUESTS: "@agent help", "need help from @agent", etc.
  // - Agents can post CONTRIBUTIONS: actual work, findings, artifacts
  // - Agents CANNOT post random free-form chatter
  
  const isAgent = author !== 'assi';
  let finalMessage = message;
  let messageType = 'contribution'; // 'contribution', 'help_request', 'notification'
  
  if (isAgent) {
    // Check if this is a help request (contains @mention)
    const helpPatterns = [
      /@\w+\s+help/i,
      /help\s+from\s+@\w+/i,
      /@\w+\s+please/i,
      /@\w+\s+can\s+you/i,
      /need\s+.*help\s+from\s+@\w+/i,
      /requesting\s+.*from\s+@\w+/i,
      /@\w+\s+needs?\s+to/i,
    ];
    
    // Check if it's a help request
    const isHelpRequest = helpPatterns.some(p => p.test(message));
    
    // Check if it's a contribution (has substance - URL, findings, artifact, etc.)
    const isContribution = /https?:\/\//i.test(message) || 
                          /findings:/i.test(message) ||
                          /research:/i.test(message) ||
                          /artifact:/i.test(message) ||
                          /here's/i.test(message) ||
                          /here is/i.test(message) ||
                          /analysis:/i.test(message) ||
                          /estimate:/i.test(message) ||
                          /budget:/i.test(message) ||
                          /review:/i.test(message) ||
                          /completed/i.test(message) ||
                          /done/i.test(message) ||
                          /results:/i.test(message) ||
                          /summary:/i.test(message) ||
                          /report:/i.test(message) ||
                          /prepared/i.test(message) ||
                          / researched/i.test(message) ||
                          / calculated/i.test(message);
    
    if (isHelpRequest) {
      // Help requests are allowed - they'll trigger immediate notification
      messageType = 'help_request';
      // Keep the message as-is so the @mention is preserved
    } else if (isContribution) {
      // Contributions are allowed - actual work content
      messageType = 'contribution';
      // Keep the message as-is
    } else if (message === `task ${id} requires your attention`) {
      // Standard notification is allowed
      messageType = 'notification';
    } else if (/i[' ]?m on it/i.test(message) || /will work on this/i.test(message) || /acknowledgment/i.test(message)) {
      // Acknowledgment messages are allowed
      messageType = 'acknowledgment';
      // Keep the message as-is
    } else if (/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/i.test(message)) {
      // Activity log format: [YYYY-MM-DD HH:MM:SS] Agent message
      messageType = 'activity';
      // Keep as-is
    } else {
      // Random chatter - restrict it
      finalMessage = `task ${id} requires your attention`;
      messageType = 'notification';
    }
  }
  
  const msg = {author, message: finalMessage, timestamp:new Date().toISOString(), messageType};
  if (!db.conversations[id]) db.conversations[id] = [];
  db.conversations[id].push(msg);
  
  // Track contributor (but assignee stays the same - task owner)
  const t = db.tasks.find(x=>x.id===id);
  if (t) {
    // Add to contributors if not already there (contractors help but don't take ownership)
    if (!t.contributors) t.contributors = [];
    
    // Add message author to contributors
    if (!t.contributors.includes(author)) {
      t.contributors.push(author);
    }
    
    // If Assi mentions agents with @, add them to contributors too
    if (author === 'assi') {
      const mentionedAgents = message.match(/@(\w+)/g);
      if (mentionedAgents) {
        mentionedAgents.forEach(mention => {
          const agentName = mention.replace('@', '').toLowerCase();
          if (!t.contributors.includes(agentName)) {
            t.contributors.push(agentName);
          }
        });
      }
    }
    
    // Assignee (task owner) does NOT change - contributor = helper
    // Only explicit PATCH to /api/tasks/:id can change assignee
    t.updated_at = new Date().toISOString();
  }
  
  save(db);
  io.emit('conversation:new',{task_id:id, message:msg, task: t});
  
  // IMMEDIATE NOTIFICATION: Detect when help is requested from a specific agent
  // Pattern: "@agentname help", "need help from @agentname", "@agentname please", etc.
  const allAgents = ['mira','daniel','lior','rina','eros','legal','insurance','finance','health','home','vehicle','communication'];
  const helpPatterns = [
    /@(\w+)\s+help/i,
    /help\s+from\s+@(\w+)/i,
    /@(\w+)\s+please/i,
    /@(\w+)\s+can\s+you/i,
    /need\s+.*help\s+from\s+@(\w+)/i,
    /@(\w+)\s+needs?\s+to/i,
    /requesting\s+.*from\s+@(\w+)/i,
  ];
  
  // Check if the original message (not the auto-generated one) asks for help
  const messageToCheck = message; // Use original message before restriction
  
  for (const pattern of helpPatterns) {
    const match = messageToCheck.match(pattern);
    if (match) {
      const mentionedAgent = match[1].toLowerCase();
      if (allAgents.includes(mentionedAgent)) {
        // Log the urgent help request - do NOT add SYSTEM messages to conversation
        console.log(`[URGENT] ${author} requested help from @${mentionedAgent} on task ${id}`);
        // The mentioned agent will see this in their task list during hourly check
        // They can also check their tasks via API at any time
      }
    }
  }
  
  res.json({ok:true, message:msg});
});

// Edit a message in conversation
app.patch('/api/tasks/:taskId/conversation/:messageIndex', (req, res) => {
  const taskId = req.params.taskId;
  const messageIndex = parseInt(req.params.messageIndex);
  const { author, message } = req.body;
  
  if (!db.conversations[taskId] || !db.conversations[taskId][messageIndex]) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  const msg = db.conversations[taskId][messageIndex];
  
  // Only the author can edit their message
  if (msg.author !== author) {
    return res.status(403).json({ error: 'Only the author can edit this message' });
  }
  
  // Update the message
  msg.message = message;
  msg.edited = true;
  msg.edited_at = new Date().toISOString();
  
  save(db);
  io.emit('conversation:updated', { task_id: taskId, messageIndex, message: msg });
  res.json({ ok: true, message: msg });
});

// Delete a message from conversation
app.delete('/api/tasks/:taskId/conversation/:messageIndex', (req, res) => {
  const taskId = req.params.taskId;
  const messageIndex = parseInt(req.params.messageIndex);
  const { author } = req.body;
  
  if (!db.conversations[taskId] || !db.conversations[taskId][messageIndex]) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  const msg = db.conversations[taskId][messageIndex];
  
  // Only the author can delete their message
  if (msg.author !== author) {
    return res.status(403).json({ error: 'Only the author can delete this message' });
  }
  
  // Remove the message
  db.conversations[taskId].splice(messageIndex, 1);
  save(db);
  io.emit('conversation:deleted', { task_id: taskId, messageIndex });
  res.json({ ok: true });
});

// Inbox endpoints (for agents)
app.post('/api/inbox/:agent', (req,res)=>{
  const agent = req.params.agent;
  const {title,command,description,status} = req.body;
  const id = Date.now().toString();
  const task = {id,title,command,description,assignee:agent,status:status||'Backlog',created_by:'system',created_at:new Date().toISOString()};
  
  const inboxDir = path.join(process.env.HOME||'/home/assi','.openclaw','agents',agent,'workspace','inbox');
  fs.writeFileSync(path.join(inboxDir,id+'.json'),JSON.stringify(task,null,2));
  
  db.tasks.push(task);
  
  // Auto-acknowledge: Agent posts "I'm on it" message
  const ackMessage = {
    author: agent,
    message: `I'm on it - will work on this task`,
    timestamp: new Date().toISOString(),
    messageType: 'acknowledgment'
  };
  if (!db.conversations[id]) db.conversations[id] = [];
  db.conversations[id].push(ackMessage);
  
  save(db);
  io.emit('task:created',task);
  res.json({task,agent});
});

// Activity Log Endpoints (Live Activity Stream)
app.post('/api/tasks/:id/activity', (req, res) => {
  const id = req.params.id;
  const { agent, action, details } = req.body;
  
  const activity = {
    timestamp: new Date().toISOString(),
    agent,
    action,
    details
  };
  
  if (!db.activities) db.activities = {};
  if (!db.activities[id]) db.activities[id] = [];
  db.activities[id].push(activity);
  
  // Keep only last 50 activities per task
  if (db.activities[id].length > 50) {
    db.activities[id] = db.activities[id].slice(-50);
  }
  
  save(db);
  io.emit('activity:new', { task_id: id, activity });
  res.json({ ok: true, activity });
});

app.get('/api/tasks/:id/activity', (req, res) => {
  const id = req.params.id;
  const activities = db.activities?.[id] || [];
  res.json({ task_id: id, activities });
});

// Result endpoint (for agents)
app.post('/api/result/:agent', (req,res)=>{
  const agent = req.params.agent;
  const {task_id,output} = req.body;
  
  const outboxDir = path.join(process.env.HOME||'/home/assi','.openclaw','agents',agent,'workspace','outbox');
  fs.writeFileSync(path.join(outboxDir,task_id+'.result.json'),JSON.stringify({output,completed_at:new Date().toISOString()},null,2));
  
  res.json({success:true});
});

// Agent Task Endpoints (2026-02-11)
app.get('/api/agents/:agent/tasks', (req, res) => {
  const agent = req.params.agent;
  const status = req.query.status; // Optional: filter by status
  
  // Get tasks where agent is Owner (assignee)
  let tasksAsOwner = db.tasks.filter(t => t.assignee === agent);
  
  // Get tasks where agent is a Contributor (helper)
  let tasksAsContributor = db.tasks.filter(t => 
    t.contributors && t.contributors.includes(agent)
  );
  
  // Combine and deduplicate
  let allAgentTasks = [...tasksAsOwner, ...tasksAsContributor];
  let seen = new Set();
  allAgentTasks = allAgentTasks.filter(t => {
    const duplicate = seen.has(t.id);
    seen.add(t.id);
    return !duplicate;
  });
  
  // Default: return Backlog + In Progress tasks
  if (!status) {
    allAgentTasks = allAgentTasks.filter(t => t.status === 'Backlog' || t.status === 'In Progress');
  } else {
    allAgentTasks = allAgentTasks.filter(t => t.status === status);
  }
  
  res.json({ 
    agent, 
    owned: tasksAsOwner.length,
    contributing: tasksAsContributor.length,
    count: allAgentTasks.length, 
    tasks: allAgentTasks 
  });
});

app.get('/api/agents/:agent/tasks/all', (req, res) => {
  const agent = req.params.agent;
  
  // Get tasks where agent is Owner (assignee)
  let tasksAsOwner = db.tasks.filter(t => t.assignee === agent);
  
  // Get tasks where agent is a Contributor (helper)
  let tasksAsContributor = db.tasks.filter(t => 
    t.contributors && t.contributors.includes(agent)
  );
  
  // Combine and deduplicate
  let allAgentTasks = [...tasksAsOwner, ...tasksAsContributor];
  let seen = new Set();
  allAgentTasks = allAgentTasks.filter(t => {
    const duplicate = seen.has(t.id);
    seen.add(t.id);
    return !duplicate;
  });
  
  res.json({ 
    agent, 
    owned: tasksAsOwner.length,
    contributing: tasksAsContributor.length,
    count: allAgentTasks.length, 
    tasks: allAgentTasks 
  });
});

// Ping endpoint - notify agent to check a task
app.post('/api/agents/:agent/ping', (req, res) => {
  const agent = req.params.agent;
  const { task_id, from_agent, message } = req.body;
  
  // Add ping message to task conversation
  if (task_id) {
    const msg = { 
      author: from_agent || 'system', 
      message: message || `Pinging @${agent} to review this task`,
      timestamp: new Date().toISOString(),
      type: 'ping'
    };
    if (!db.conversations[task_id]) db.conversations[task_id] = [];
    db.conversations[task_id].push(msg);
    save(db);
    io.emit('conversation:new', { task_id, message: msg });
  }
  
  res.json({ ok: true, agent, pinged: true, task_id });
});

// Events
app.get('/api/events', (req,res)=>{ res.json(db.events.slice(-100)); });

io.on('connection', (socket)=>{ console.log('ws connected'); });
app.get('/', (req,res)=>{ res.json({ok:true}); });

const PORT = process.env.PORT || 3001;
server.listen(PORT, ()=>console.log('backend listening',PORT));
