// Tauri API
const { invoke } = window.__TAURI__.core;

// State
let currentTab = 'notes';
let editingNoteId = null;
let pendingPaper = null;

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    currentTab = btn.dataset.tab;
    
    if (currentTab === 'notes') loadNotes();
    if (currentTab === 'tasks') loadTasks();
    if (currentTab === 'research') loadPapers();
  });
});

// Notes
const noteModal = document.getElementById('noteModal');
const notesList = document.getElementById('notesList');

document.getElementById('newNoteBtn').addEventListener('click', () => {
  editingNoteId = null;
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteFolder').value = '';
  document.getElementById('noteTags').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('deleteNoteBtn').style.display = 'none';
  noteModal.style.display = 'flex';
});

document.getElementById('closeNoteModal').addEventListener('click', () => {
  noteModal.style.display = 'none';
});

document.getElementById('saveNoteBtn').addEventListener('click', async () => {
  const title = document.getElementById('noteTitle').value;
  const folder = document.getElementById('noteFolder').value;
  const tags = document.getElementById('noteTags').value.split(',').map(t => t.trim()).filter(t => t);
  const content = document.getElementById('noteContent').value;
  
  if (!title) return;
  
  if (editingNoteId) {
    await invoke('update_note', { id: editingNoteId, req: { title, content, folder, tags } });
  } else {
    await invoke('create_note', { req: { title, content, folder, tags } });
  }
  
  noteModal.style.display = 'none';
  loadNotes();
});

document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
  if (editingNoteId && confirm('Delete this note?')) {
    await invoke('delete_note', { id: editingNoteId });
    noteModal.style.display = 'none';
    loadNotes();
  }
});

document.getElementById('noteSearch').addEventListener('input', async (e) => {
  const query = e.target.value;
  if (query) {
    const notes = await invoke('search_notes', { query });
    renderNotes(notes);
  } else {
    loadNotes();
  }
});

async function loadNotes() {
  const notes = await invoke('get_notes');
  renderNotes(notes);
}

function renderNotes(notes) {
  if (notes.length === 0) {
    notesList.innerHTML = '<div class="empty-state">No notes yet. Create your first note!</div>';
    return;
  }
  
  notesList.innerHTML = notes.map(note => `
    <div class="note-item" data-id="${note.id}">
      <div class="note-title">${note.title || 'Untitled'}</div>
      <div class="note-meta">${note.folder || 'No folder'} • ${new Date(note.updated_at * 1000).toLocaleDateString()}</div>
    </div>
  `).join('');
  
  notesList.querySelectorAll('.note-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = parseInt(item.dataset.id);
      const notes = await invoke('get_notes');
      const note = notes.find(n => n.id === id);
      if (note) {
        editingNoteId = note.id;
        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteFolder').value = note.folder;
        document.getElementById('noteTags').value = (note.tags || []).join(', ');
        document.getElementById('noteContent').value = note.content;
        document.getElementById('deleteNoteBtn').style.display = 'inline-block';
        noteModal.style.display = 'flex';
      }
    });
  });
}

// Tasks
const tasksList = document.getElementById('tasksList');

document.getElementById('addTaskBtn').addEventListener('click', async () => {
  const text = document.getElementById('taskInput').value;
  const dueDateStr = document.getElementById('taskDueDate').value;
  
  if (!text) return;
  
  const due_date = dueDateStr ? new Date(dueDateStr).getTime() / 1000 : null;
  
  await invoke('create_task', { req: { text, due_date } });
  
  document.getElementById('taskInput').value = '';
  document.getElementById('taskDueDate').value = '';
  loadTasks();
});

async function loadTasks() {
  const tasks = await invoke('get_tasks');
  renderTasks(tasks);
}

function renderTasks(tasks) {
  if (tasks.length === 0) {
    tasksList.innerHTML = '<div class="empty-state">No tasks yet. Add your first task!</div>';
    return;
  }
  
  tasksList.innerHTML = tasks.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <span class="task-text">${task.text}</span>
      ${task.due_date ? `<span class="due-date">${new Date(task.due_date * 1000).toLocaleDateString()}</span>` : ''}
      <button class="delete-btn" data-id="${task.id}">×</button>
    </div>
  `).join('');
  
  tasksList.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const id = parseInt(e.target.closest('.task-item').dataset.id);
      await invoke('toggle_task', { id, completed: e.target.checked });
      loadTasks();
    });
  });
  
  tasksList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      await invoke('delete_task', { id });
      loadTasks();
    });
  });
}

// Papers
const paperModal = document.getElementById('paperModal');
const duplicateModal = document.getElementById('duplicateModal');
const papersList = document.getElementById('papersList');

document.getElementById('addPaperBtn').addEventListener('click', () => {
  pendingPaper = null;
  document.getElementById('paperTitle').value = '';
  document.getElementById('paperAuthors').value = '';
  document.getElementById('paperYear').value = '';
  document.getElementById('paperDOI').value = '';
  document.getElementById('paperJournal').value = '';
  paperModal.style.display = 'flex';
});

document.getElementById('closePaperModal').addEventListener('click', () => {
  paperModal.style.display = 'none';
});

document.getElementById('savePaperBtn').addEventListener('click', async () => {
  const paper = {
    title: document.getElementById('paperTitle').value,
    authors: document.getElementById('paperAuthors').value,
    year: document.getElementById('paperYear').value || null,
    doi: document.getElementById('paperDOI').value || null,
    journal: document.getElementById('paperJournal').value || null
  };
  
  if (!paper.title) return;
  
  // Check for duplicates
  const duplicate = await invoke('check_duplicate_paper', { 
    doi: paper.doi, 
    title: paper.title 
  });
  
  if (duplicate) {
    pendingPaper = paper;
    document.getElementById('duplicateMessage').textContent = 
      `"${duplicate.title}" by ${duplicate.authors} already exists. Add anyway?`;
    duplicateModal.style.display = 'flex';
    return;
  }
  
  await invoke('create_paper', { req: paper });
  paperModal.style.display = 'none';
  loadPapers();
});

document.getElementById('cancelDuplicateBtn').addEventListener('click', () => {
  duplicateModal.style.display = 'none';
  pendingPaper = null;
});

document.getElementById('addAnywayBtn').addEventListener('click', async () => {
  if (pendingPaper) {
    await invoke('create_paper', { req: pendingPaper });
    pendingPaper = null;
  }
  duplicateModal.style.display = 'none';
  paperModal.style.display = 'none';
  loadPapers();
});

async function loadPapers() {
  const papers = await invoke('get_papers');
  renderPapers(papers);
}

function renderPapers(papers) {
  if (papers.length === 0) {
    papersList.innerHTML = '<div class="empty-state">No papers in library. Add your first paper!</div>';
    return;
  }
  
  papersList.innerHTML = papers.map(paper => `
    <div class="paper-item" data-id="${paper.id}">
      <div class="paper-title">${paper.title}</div>
      <div class="paper-meta">${paper.authors} • ${paper.year || 'n.d.'}${paper.doi ? ' • DOI: ' + paper.doi : ''}</div>
      <button class="delete-btn" data-id="${paper.id}">×</button>
    </div>
  `).join('');
  
  papersList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (confirm('Delete this paper?')) {
        await invoke('delete_paper', { id });
        loadPapers();
      }
    });
  });
}

// Initial load
loadNotes();