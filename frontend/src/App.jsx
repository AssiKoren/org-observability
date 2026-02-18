import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';

// Styles
const styles = {
  container: { fontFamily: 'system-ui, sans-serif', width: '100%', maxWidth: '100%', minHeight: '100vh', backgroundColor: '#f5f7fa', padding: '20px', overflowX: 'hidden', boxSizing: 'border-box' },
  header: { width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '30px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', boxSizing: 'border-box' },
  title: { margin: 0, color: '#2c3e50', fontSize: '24px' },
  controls: { display: 'flex', gap: '10px', alignItems: 'center' },
  addBtn: { padding: '10px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '14px' },
  searchInput: { padding: '10px 15px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', width: '200px' },
  select: { padding: '10px 15px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', backgroundColor: '#fff' },
  board: { display: 'flex', gap: '12px', width: '100%', maxWidth: '100%', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', overflowX: 'auto', boxSizing: 'border-box' },
  column: { minWidth: '260px', flex: 1, backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflow: 'hidden' },
  columnHeader: { padding: '15px', fontWeight: '600', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  columnHeaderBacklog: { backgroundColor: '#6c757d' },
  columnHeaderInProgress: { backgroundColor: '#007bff' },
  columnHeaderDone: { backgroundColor: '#28a745' },
  taskCount: { backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' },
  taskList: { padding: '10px', minHeight: '200px' },
  task: { backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  taskTitle: { margin: '0 0 8px 0', fontSize: '14px', color: '#2c3e50', fontWeight: '500' },
  taskMeta: { display: 'flex', gap: '10px', fontSize: '12px', color: '#666' },
  tag: { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' },
  tagAssignee: { backgroundColor: '#e3f2fd', color: '#1976d2' },
  tagCreator: { backgroundColor: '#f3e5f5', color: '#7b1fa2' },
  tagStatus: { backgroundColor: '#fff3e0', color: '#f57c00' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#fff', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' },
  modalHeader: { padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, fontSize: '20px', color: '#2c3e50' },
  closeBtn: { background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#999' },
  modalBody: { padding: '20px' },
  section: { marginBottom: '20px' },
  sectionTitle: { fontSize: '14px', color: '#666', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  conversation: { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '15px' },
  message: { padding: '10px 0', borderBottom: '1px solid #eee' },
  messageAuthor: { fontWeight: '600', color: '#2c3e50', marginBottom: '4px' },
  messageText: { color: '#555', fontSize: '14px' },
  messageTime: { fontSize: '11px', color: '#999', marginTop: '4px' },
  inputArea: { display: 'flex', gap: '10px', marginTop: '15px' },
  input: { flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' },
  sendBtn: { padding: '12px 24px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' },
  emptyState: { textAlign: 'center', color: '#999', padding: '40px' },
  // Navigation styles
  nav: { display: 'flex', gap: '5px', marginBottom: '20px', padding: '15px 30px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  navLink: { padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', color: '#2c3e50', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' },
  navLinkActive: { backgroundColor: '#007bff', color: '#fff' },
  pageContent: { padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  pageTitle: { margin: '0 0 20px 0', fontSize: '24px', color: '#2c3e50' },
  orgChart: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '40px' },
  orgPerson: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', backgroundColor: '#f5f7fa', borderRadius: '8px', border: '2px solid #007bff', minWidth: '150px' },
  orgName: { fontWeight: '600', color: '#2c3e50', marginBottom: '5px' },
  orgRole: { fontSize: '12px', color: '#666' },
  orgConnectors: { display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#999' },
  orgConnector: { width: '2px', height: '20px', backgroundColor: '#999' },
  orgArrow: { fontSize: '20px', color: '#999' },
};

// Column definitions
const COLUMNS = [
  { id: 'backlog', headerStyle: styles.columnHeaderBacklog, label: '⏳ Backlog', filterStatuses: ['Backlog', 'Not Started'] },
  {
    id: 'in-progress',
    headerStyle: { ...styles.columnHeader, backgroundColor: '#007bff' },
    label: '🚀 In Progress',
    filterStatuses: ['Started', 'Ready for Review', 'Pending Review', 'Owner Review', 'Changes Requested']
  },
  { id: 'done', headerStyle: styles.columnHeaderDone, label: '✅ Done', filterStatuses: ['Done'] },
];

// API configuration
const API_URL = 'http://localhost:3001';

// Workflow action buttons component
function WorkflowActions({ task, onUpdate, onClose, currentActor, actorLabel }) {
  const [loading, setLoading] = useState(false);
  
  const handleAction = async (action, data = {}) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/tasks/${task.id}/${action}`, data);
      await onUpdate();
      if (onClose) onClose(); // Close modal after successful action
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    }
    setLoading(false);
  };
  
  const workflow = {
    'Backlog': () => (
      <button style={{...styles.sendBtn, backgroundColor: '#007bff'}} onClick={() => handleAction('take', { agent: task.assignee || 'assi' })}>
        👉 Take Task
      </button>
    ),
    'Not Started': () => (
      <button style={{...styles.sendBtn, backgroundColor: '#007bff'}} onClick={() => handleAction('take', { agent: task.assignee || 'assi' })}>
        🚀 Start Working
      </button>
    ),
    'Started': () => (
      <button style={{...styles.sendBtn, backgroundColor: '#6c757d'}} onClick={() => handleAction('ready-for-review', { agent: task.assignee, note: 'Work complete, ready for review' })}>
        📋 Mark Ready for Review
      </button>
    ),
    'Ready for Review': () => {
      const isOwner = (currentActor || '').toLowerCase() === String(task.created_by || '').toLowerCase() ||
        (['mr-a','assaf'].includes((currentActor || '').toLowerCase()) && ['mr-a','assaf'].includes(String(task.created_by || '').toLowerCase()));
      if (!isOwner) {
        return <div style={{ color: '#6c757d', fontSize: '13px' }}>⏳ Waiting for owner to request reviews</div>;
      }
      return (
        <button style={{...styles.sendBtn, backgroundColor: '#28a745'}} onClick={() => handleAction('verify-and-request-review', { actor: currentActor || task.created_by, reviewers: ['manager', 'assi'], message: `${currentActor || task.created_by} requested level-1 review from manager and assi` })}>
          ✅ {actorLabel ? actorLabel(task.created_by) : task.created_by}: Request Level-1 Reviews
        </button>
      );
    },
    'Pending Review': () => {
      const reviewers = Array.isArray(task.reviewers) ? task.reviewers : ['manager', 'assi'];
      const canReview = reviewers.includes(currentActor);
      if (!canReview) {
        return (
          <div style={{ color: '#6c757d', fontSize: '13px' }}>
            ⏳ Waiting for reviewers: {reviewers.join(', ')}
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={{...styles.sendBtn, backgroundColor: '#28a745'}} onClick={() => handleAction('approve-review', { reviewer: currentActor, approved: true })}>
            ✅ {actorLabel ? actorLabel(currentActor) : currentActor} Approve
          </button>
          <button style={{...styles.sendBtn, backgroundColor: '#dc3545'}} onClick={() => {
            const feedback = prompt(`${actorLabel ? actorLabel(currentActor) : currentActor} rejection feedback (required):`);
            if (feedback) handleAction('approve-review', { reviewer: currentActor, approved: false, feedback });
          }}>
            ❌ {actorLabel ? actorLabel(currentActor) : currentActor} Reject
          </button>
        </div>
      );
    },
    'Owner Review': () => {
      const isOwner = (currentActor || '').toLowerCase() === String(task.created_by || '').toLowerCase() ||
        (['mr-a','assaf'].includes((currentActor || '').toLowerCase()) && ['mr-a','assaf'].includes(String(task.created_by || '').toLowerCase()));
      if (!isOwner) {
        return (
          <div style={{ color: '#6c757d', fontSize: '13px' }}>
            ⏳ Waiting for owner decision: {actorLabel ? actorLabel(task.created_by) : task.created_by}
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={{...styles.sendBtn, backgroundColor: '#28a745'}} onClick={() => handleAction('final-approve', { approver: currentActor || task.created_by })}>
            🎉 {actorLabel ? actorLabel(task.created_by) : 'Owner'} Final Approve (Done)
          </button>
          <button style={{...styles.sendBtn, backgroundColor: '#dc3545'}} onClick={() => {
            const feedback = prompt('Owner rejection feedback (required):');
            if (feedback) handleAction('final-reject', { approver: currentActor || task.created_by, feedback });
          }}>
            ❌ {actorLabel ? actorLabel(task.created_by) : 'Owner'} Request Changes
          </button>
        </div>
      );
    },
    'Changes Requested': () => (
      <button style={{...styles.sendBtn, backgroundColor: '#007bff'}} onClick={() => handleAction('take', { agent: task.assignee })}>
        🔁 Resume Work
      </button>
    ),
    'Done': () => (
      <div style={{ color: '#28a745', fontWeight: 'bold', fontSize: '16px' }}>🎉 Task Completed!</div>
    )
  };
  
  if (loading) {
    return <div style={{ color: '#666' }}>Processing...</div>;
  }
  
  const ActionComponent = workflow[task.status];
  if (!ActionComponent) {
    return <div style={{ color: '#999' }}>Unknown status: {task.status}</div>;
  }
  
  return <ActionComponent />;
}

// Navigation Component
function Navigation() {
  const location = useLocation();
  
  const navLinks = [
    { path: '/', label: '📋 Kanban' },
    { path: '/org-chart', label: '👥 Org Chart' },
    { path: '/activity', label: '📊 Activity' },
    { path: '/settings', label: '⚙️ Settings' },
  ];
  
  return (
    <nav style={styles.nav}>
      {navLinks.map(link => (
        <Link
          key={link.path}
          to={link.path}
          style={{
            ...styles.navLink,
            ...(location.pathname === link.path ? styles.navLinkActive : {})
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

// Org Chart Page
function OrgChartPage() {
  const team = [
    { name: 'Assi', role: 'Executive Sponsor' },
    { name: 'Mira Cohen', role: 'Engineering Manager' },
    { name: 'Daniel Levi', role: 'Backend Developer' },
    { name: 'Lior Katz', role: 'Frontend Developer' },
    { name: 'Rina Bar-On', role: 'DevOps' },
    { name: 'Eros', role: 'Romantic Manager' },
  ];
  
  const assistants = [
    { name: 'Legal Expert', role: 'Head of Legal' },
    { name: 'Insurance Expert', role: 'Head of Insurance' },
    { name: 'Finance Expert', role: 'Head of Finance' },
    { name: 'Health Expert', role: 'Health Advisor' },
    { name: 'Home Expert', role: 'Home Maintenance' },
    { name: 'Vehicle Expert', role: 'Vehicle Advisor' },
    { name: 'Communication Expert', role: 'Communications' },
  ];
  
  return (
    <div style={styles.pageContent}>
      <h1 style={styles.pageTitle}>📋 No Manual</h1>
      
      <div style={styles.orgChart}>
        {/* Executive */}
        <div style={styles.orgPerson}>
          <div style={styles.orgName}>Assi</div>
          <div style={styles.orgRole}>Executive Sponsor</div>
        </div>
        <div style={styles.orgConnectors}>
          <div style={styles.orgConnector}></div>
          <div style={styles.orgArrow}>↓</div>
        </div>
        
        {/* Engineering Manager */}
        <div style={styles.orgPerson}>
          <div style={styles.orgName}>Mira Cohen</div>
          <div style={styles.orgRole}>Engineering Manager</div>
        </div>
        <div style={styles.orgConnectors}>
          <div style={styles.orgConnector}></div>
          <div style={styles.orgArrow}>↓</div>
        </div>
        
        {/* Development Team */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={styles.orgPerson}>
            <div style={styles.orgName}>Daniel Levi</div>
            <div style={styles.orgRole}>Backend Developer</div>
          </div>
          <div style={styles.orgPerson}>
            <div style={styles.orgName}>Lior Katz</div>
            <div style={styles.orgRole}>Frontend Developer</div>
          </div>
          <div style={styles.orgPerson}>
            <div style={styles.orgName}>Rina Bar-On</div>
            <div style={styles.orgRole}>DevOps</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '20px' }}>
          <div style={styles.orgPerson}>
            <div style={styles.orgName}>Eros</div>
            <div style={styles.orgRole}>Romantic Manager</div>
          </div>
        </div>
        
        {/* Personal Assistants */}
        <div style={{ marginTop: '40px', width: '100%' }}>
          <h2 style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>Personal Assistants</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {assistants.map(person => (
              <div key={person.name} style={{ ...styles.orgPerson, borderColor: '#28a745' }}>
                <div style={styles.orgName}>{person.name}</div>
                <div style={styles.orgRole}>{person.role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Activity Page
function ActivityPage() {
  return (
    <div style={styles.pageContent}>
      <h1 style={styles.pageTitle}>📊 Activity Feed</h1>
      <p style={{ color: '#666' }}>Activity feed coming soon...</p>
    </div>
  );
}

// Settings Page
function SettingsPage() {
  return (
    <div style={styles.pageContent}>
      <h1 style={styles.pageTitle}>⚙️ Settings</h1>
      <p style={{ color: '#666' }}>Settings coming soon...</p>
    </div>
  );
}

// Kanban Board Component
function KanbanBoard() {
  const ACTOR_OPTIONS = [
    { id: 'mr-a', label: 'Assaf (Boss)' },
    { id: 'assi', label: 'Assi' },
    { id: 'manager', label: 'Manager' },
    { id: 'lior', label: 'Lior' },
  ];
  const actorLabel = (id) => (ACTOR_OPTIONS.find(a => a.id === id)?.label || id);

  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ description: '', dod: '' });
  const [creatingTask, setCreatingTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterCreator, setFilterCreator] = useState('');
  const [timeFilter, setTimeFilter] = useState(() => localStorage.getItem('kanban_timeFilter') || 'all');
  const [dateFrom, setDateFrom] = useState(() => localStorage.getItem('kanban_dateFrom') || '');
  const [dateTo, setDateTo] = useState(() => localStorage.getItem('kanban_dateTo') || '');
  const [editingMessage, setEditingMessage] = useState(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [activity, setActivity] = useState([]);
  const [activityPolling, setActivityPolling] = useState(null);
  const [currentActor, setCurrentActor] = useState(() => localStorage.getItem('kanban_currentActor') || 'mr-a');

  useEffect(() => { localStorage.setItem('kanban_timeFilter', timeFilter); }, [timeFilter]);
  useEffect(() => { localStorage.setItem('kanban_dateFrom', dateFrom); }, [dateFrom]);
  useEffect(() => { localStorage.setItem('kanban_dateTo', dateTo); }, [dateTo]);
  useEffect(() => { localStorage.setItem('kanban_currentActor', currentActor); }, [currentActor]);

  useEffect(() => {
    fetchTasks();
    const newSocket = io(API_URL);
    setSocket(newSocket);
    newSocket.on('task_updated', fetchTasks);
    return () => newSocket.disconnect();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks`);
      setTasks(res.data);
    } catch (err) { console.error('Error fetching tasks:', err); }
    setLoading(false);
  };

  const getConversation = async (taskId) => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks/${taskId}/conversation`);
      setConversation(res.data.messages || []);
    } catch (err) { console.error('Error fetching conversation:', err); }
  };

  const getActivity = async (taskId) => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks/${taskId}/activity`);
      setActivity(res.data.activities || []);
    } catch (err) { console.error('Error fetching activity:', err); }
  };

  const handleTaskClick = async (task) => {
    setSelectedTask(task);
    await getConversation(task.id);
    await getActivity(task.id);
    
    // Poll for new activity every 5 seconds
    const pollInterval = setInterval(() => {
      getActivity(task.id);
    }, 5000);
    setActivityPolling(pollInterval);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTask) return;
    try {
      await axios.post(`${API_URL}/api/tasks/${selectedTask.id}/conversation`, {
        author: currentActor,
        message: newMessage
      });
      setNewMessage('');
      await getConversation(selectedTask.id);
    } catch (err) { console.error('Error sending message:', err); }
  };

  const handleCreateTask = async () => {
    if (!newTaskForm.description.trim()) return;
    
    // Parse DoD from comma-separated values
    const dodArray = newTaskForm.dod
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    if (dodArray.length === 0) {
      alert('Please add at least one Definition of Done criteria');
      return;
    }
    
    setCreatingTask(true);
    try {
      await axios.post(`${API_URL}/api/tasks`, {
        title: newTaskForm.description,
        status: 'Backlog',
        assignee: 'lior',
        created_by: currentActor,
        dod: dodArray
      });
      setShowAddTask(false);
      setNewTaskForm({ description: '', dod: '' });
      fetchTasks();
    } catch (err) { 
      console.error('Error creating task:', err);
      alert(err.response?.data?.error || 'Failed to create task');
    }
    setCreatingTask(false);
  };

  const filterTasks = tasks.filter(t => {
    const matchesSearch = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAssignee = !filterAssignee || t.assignee === filterAssignee;
    const matchesCreator = !filterCreator || t.created_by === filterCreator;
    let matchesTime = true;
    const taskDate = new Date(t.created_at);
    if (timeFilter === '24h') matchesTime = taskDate > new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (timeFilter === 'week') matchesTime = taskDate > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (timeFilter === 'month') matchesTime = taskDate > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (timeFilter === 'custom') {
      if (dateFrom) matchesTime = matchesTime && taskDate >= new Date(dateFrom);
      if (dateTo) matchesTime = matchesTime && taskDate <= new Date(dateTo);
    }
    return matchesSearch && matchesAssignee && matchesCreator && matchesTime;
  });

  const getUniqueValues = (key) => [...new Set(tasks.map(t => t[key]))].filter(Boolean);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>📋 True Check4</h1>
        <div style={styles.controls}>
          <select style={styles.select} value={currentActor} onChange={e => setCurrentActor(e.target.value)}>
            {ACTOR_OPTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
          <button style={styles.addBtn} onClick={() => setShowAddTask(true)}>+ Add Task</button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{ ...styles.header, padding: '15px', flexWrap: 'wrap', gap: '15px' }}>
        <input
          style={styles.searchInput}
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select style={styles.select} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="">All Assignees</option>
          {getUniqueValues('assignee').map(a => <option key={a} value={a}>@{a}</option>)}
        </select>
        <select style={styles.select} value={filterCreator} onChange={e => setFilterCreator(e.target.value)}>
          <option value="">All Creators</option>
          {getUniqueValues('created_by').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={styles.select} value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
          <option value="all">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
          <option value="custom">Custom Range</option>
        </select>
        {timeFilter === 'custom' && (
          <>
            <input type="date" style={styles.select} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <input type="date" style={styles.select} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </>
        )}
      </div>

      <div style={styles.board}>
        {COLUMNS.map(column => {
          // Filter by status AND approval (Done column only shows approved tasks)
          const columnTasks = filterTasks.filter(t => column.filterStatuses.includes(t.status));
          return (
            <div key={column.id} style={styles.column}>
              <div style={{ ...styles.columnHeader, ...column.headerStyle }}>
                <span>{column.label || column.id}</span>
                <span style={styles.taskCount}>{columnTasks.length}</span>
              </div>
              <div style={styles.taskList}>
                {columnTasks.map(task => (
                  <div key={task.id} style={styles.task} onClick={() => handleTaskClick(task)}>
                    <div style={styles.taskTitle}>{task.title}</div>
                    <div style={styles.taskMeta}>
                      <span style={{ ...styles.tag, ...styles.tagAssignee }}>@{task.assignee}</span>
                      <span style={{ ...styles.tag, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>{task.status}</span>
                      <span style={{ ...styles.tag, ...styles.tagCreator }}>{task.created_by}</span>
                    </div>
                    <div style={{ ...styles.taskMeta, marginTop: '8px', fontSize: '11px' }}>
                      Created: {formatTime(task.created_at)}
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && <div style={styles.emptyState}>No tasks</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div style={styles.modal} onClick={() => setSelectedTask(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{selectedTask.title}</h2>
              <button style={styles.closeBtn} onClick={() => setSelectedTask(null)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Details</div>
                <div><strong>Status:</strong> {selectedTask.status}</div>
                <div><strong>Owner (Assignee):</strong> @{selectedTask.assignee}</div>
                <div><strong>Created by:</strong> {selectedTask.created_by}</div>
                {selectedTask.contributors && selectedTask.contributors.length > 1 && (
                  <div><strong>Helpers:</strong> {selectedTask.contributors.filter(c => c !== selectedTask.assignee).map(c => '@' + c).join(', ')}</div>
                )}
                <div><strong>Created:</strong> {formatTime(selectedTask.created_at)}</div>
                <div><strong>Task ID:</strong> {selectedTask.id}</div>
              </div>
              
              {/* Definition of Done (DoD) Section */}
              {selectedTask.dod && (
                <div style={styles.section}>
                  <div style={{...styles.sectionTitle, color: '#28a745'}}>✅ Definition of Done</div>
                  <div style={{ backgroundColor: '#e8f5e9', padding: '12px', borderRadius: '6px' }}>
                    {selectedTask.dod.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <span style={{ color: '#28a745', marginRight: '8px', fontSize: '14px' }}>☐</span>
                        <span style={{ fontSize: '13px', color: '#333' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Workflow Actions Section */}
              <div style={{ ...styles.section, backgroundColor: '#e7f3ff', padding: '15px', borderRadius: '8px', border: '2px solid #007bff' }}>
                <div style={{ ...styles.sectionTitle, color: '#007bff' }}>🎯 Workflow Actions</div>
                <WorkflowActions task={selectedTask} currentActor={currentActor} actorLabel={actorLabel} onUpdate={async () => {
                  await fetchTasks();
                  await getConversation(selectedTask.id);
                }} onClose={() => setSelectedTask(null)} />
              </div>
              
              {/* Artifact Section */}
              <div style={styles.section}>
                <div style={{...styles.sectionTitle, color: '#6f42c1', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span>📦 Artifact</span>
                  {!selectedTask.artifactPath && (
                    <button 
                      style={{...styles.sendBtn, padding: '5px 10px', fontSize: '11px', backgroundColor: '#6f42c1'}}
                      onClick={async () => {
                        try {
                          await axios.post(`${API_URL}/api/tasks/${selectedTask.id}/artifact`);
                          await fetchTasks();
                          await getConversation(selectedTask.id);
                        } catch (err) { console.error(err); }
                      }}
                    >
                      + Create Artifact
                    </button>
                  )}
                </div>
                {selectedTask.artifactPath ? (
                  <div style={{ backgroundColor: '#f3e5f5', padding: '12px', borderRadius: '6px', border: '1px solid #6f42c1' }}>
                    <div style={{ marginBottom: '8px', fontSize: '13px', color: '#6f42c1', fontWeight: '500' }}>
                      📄 {selectedTask.artifactPath}
                    </div>
                    <a 
                      href={`http://localhost:3001/api/tasks/${selectedTask.id}/artifact`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#007bff', textDecoration: 'underline', fontSize: '13px' }}
                    >
                      🔗 Open Artifact File →
                    </a>
                  </div>
                ) : (
                  <div style={{ color: '#999', fontSize: '13px', fontStyle: 'italic' }}>
                    No artifact yet. Click "Create Artifact" to start working on the deliverable.
                  </div>
                )}
              </div>
              
              {/* Live Activity Section */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>📡 Live Activity</div>
                <div style={{ ...styles.conversation, maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                  {activity.length === 0 ? (
                    <div style={{ color: '#6c757d', fontSize: '13px' }}>No activity yet</div>
                  ) : (
                    activity.map((item, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: i < activity.length - 1 ? '1px solid #e9ecef' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: '#495057' }}>@{item.agent}</span>
                          <span style={{ fontSize: '11px', color: '#adb5bd' }}>{formatTime(item.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#212529', marginTop: '4px' }}>
                          <span style={{ 
                            backgroundColor: item.action === 'started' ? '#28a745' : 
                                           item.action === 'check' ? '#17a2b8' : 
                                           item.action === 'acknowledged' ? '#ffc107' : '#6c757d',
                            color: 'white', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', marginRight: '8px'
                          }}>
                            {item.action.toUpperCase()}
                          </span>
                          {item.details}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Conversation</div>
                <div style={styles.conversation}>
                  {conversation.map((msg, i) => (
                    <div key={i} style={styles.message}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={styles.messageAuthor}>{msg.author}</div>
                        {msg.author === currentActor && (
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button 
                              style={{ ...styles.sendBtn, padding: '4px 8px', fontSize: '11px', backgroundColor: '#6c757d' }}
                              onClick={() => {
                                setEditingMessage(i);
                                setEditMessageText(msg.message);
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              style={{ ...styles.sendBtn, padding: '4px 8px', fontSize: '11px', backgroundColor: '#dc3545' }}
                              onClick={async () => {
                                if (confirm('Delete this message?')) {
                                  await axios.delete(`${API_URL}/api/tasks/${selectedTask.id}/conversation/${i}`, {
                                    data: { author: currentActor }
                                  });
                                  await getConversation(selectedTask.id);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                      {editingMessage === i ? (
                        <div style={{ marginTop: '8px' }}>
                          <textarea
                            style={{ ...styles.input, minHeight: '60px', width: '100%' }}
                            value={editMessageText}
                            onChange={e => setEditMessageText(e.target.value)}
                          />
                          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                            <button 
                              style={{ ...styles.sendBtn, padding: '4px 12px', backgroundColor: '#28a745' }}
                              onClick={async () => {
                                await axios.patch(`${API_URL}/api/tasks/${selectedTask.id}/conversation/${i}`, {
                                  author: currentActor,
                                  message: editMessageText
                                });
                                setEditingMessage(null);
                                await getConversation(selectedTask.id);
                              }}
                            >
                              Save
                            </button>
                            <button 
                              style={{ ...styles.sendBtn, padding: '4px 12px', backgroundColor: '#6c757d' }}
                              onClick={() => {
                                setEditingMessage(null);
                                setEditMessageText('');
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={styles.messageText}>{msg.message}</div>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={styles.messageTime}>
                              {formatTime(msg.timestamp)}
                              {msg.edited && ' (edited)'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {conversation.length === 0 && <div style={styles.emptyState}>No messages yet</div>}
                </div>
                <div style={styles.inputArea}>
                  <input
                    style={styles.input}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button style={styles.sendBtn} onClick={handleSendMessage}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div style={styles.modal} onClick={() => setShowAddTask(false)}>
          <div style={{ ...styles.modalContent, maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Create New Task</h2>
              <button style={styles.closeBtn} onClick={() => setShowAddTask(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Task Description</div>
                <textarea
                  style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                  placeholder="Describe what needs to be done"
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                />
              </div>
              
              <div style={styles.section}>
                <div style={{...styles.sectionTitle, color: '#28a745'}}>✅ Definition of Done</div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Add criteria that must be met for this task to be complete (comma-separated)
                </div>
                <textarea
                  style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
                  placeholder="e.g., Code completed, Tested, No errors, Reviewed"
                  value={newTaskForm.dod}
                  onChange={e => setNewTaskForm({ ...newTaskForm, dod: e.target.value })}
                />
              </div>
              
              <button
                style={{ ...styles.sendBtn, width: '100%', opacity: creatingTask ? 0.7 : 1 }}
                onClick={handleCreateTask}
                disabled={creatingTask}
              >
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Main App with Routing
export default function App() {
  return (
    <div style={styles.container}>
      <Navigation />
      <Routes>
        <Route path="/" element={<KanbanBoard />} />
        <Route path="/org-chart" element={<OrgChartPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}

/* Batch Title 1 */

/* Batch Title 2 */

/* Batch Title 3 */

/* Batch Title 5 */

/* Batch Title 6 */

/* Batch Title 9 */

/* Batch Title 4 */

/* Batch Title 8 */

/* Batch Title 7 */

/* Batch Title 10 */

/* Batch Title 12 */

/* Batch Title 13 */

/* Batch Title 14 */

/* Batch Title 11 */

/* Batch Title 15 */

/* Batch Title 16 */

/* Batch Title 17 */

/* Batch Title 19 */

/* Batch Title 20 */

/* Batch Title 18 */

/* Recheck Title 2 */

/* Recheck Title 1 */

/* Recheck Title 5 */

/* Recheck Title 3 */

/* Recheck Title 6 */

/* Recheck Title 7 */

/* Recheck Title 4 */

/* Recheck Title 8 */

/* Recheck Title 9 */

/* Recheck Title 10 */

/* Recheck Title 11 */

/* Recheck Title 12 */

/* Recheck Title 13 */

/* Recheck Title 14 */

/* Recheck Title 15 */

/* Recheck Title 16 */

/* Recheck Title 17 */

/* Recheck Title 18 */

/* Recheck Title 19 */

/* Recheck Title 20 */
