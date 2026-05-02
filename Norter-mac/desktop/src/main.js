// Tauri API
const { invoke } = window.__TAURI__.core;

// State
let currentTab = 'notes';
let editingNoteId = null;
let pendingPaper = null;

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// Tab switching
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
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
  noteModal.classList.add('active');
});

document.getElementById('closeNoteModal').addEventListener('click', () => {
  noteModal.classList.remove('active');
});

document.getElementById('saveNoteBtn').addEventListener('click', async () => {
  const title = document.getElementById('noteTitle').value || 'Untitled';
  const folder = document.getElementById('noteFolder').value;
  const tags = document.getElementById('noteTags').value.split(',').map(t => t.trim()).filter(t => t);
  const content = document.getElementById('noteContent').value;
  
  try {
    if (editingNoteId) {
      await invoke('update_note', { id: editingNoteId, req: { title, content, folder, tags } });
    } else {
      await invoke('create_note', { req: { title, content, folder, tags } });
    }
    
    noteModal.classList.remove('active');
    loadNotes();
  } catch (err) {
    console.error('Save note error:', err);
  }
});

document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
  if (editingNoteId) {
    try {
      await invoke('delete_note', { id: editingNoteId });
      noteModal.classList.remove('active');
      loadNotes();
    } catch (err) {
      console.error('Delete note error:', err);
    }
  }
});

document.getElementById('noteSearch').addEventListener('input', async (e) => {
  const query = e.target.value;
  if (query) {
    try {
      const notes = await invoke('fts_search_notes', { query });
      renderNotes(notes);
    } catch {
      const notes = await invoke('search_notes', { query });
      renderNotes(notes);
    }
  } else {
    loadNotes();
  }
});

// Global search
let searchDebounce = null;
const globalSearchInput = document.getElementById('globalSearchInput');
globalSearchInput.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  const query = e.target.value.trim();
  if (!query) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(currentTab + 'Tab').classList.add('active');
    document.getElementById('searchResults').innerHTML = '';
    return;
  }
  searchDebounce = setTimeout(async () => {
    try {
      const results = await invoke('global_search', { query });
      const total = results.notes.length + results.papers.length + results.tasks.length;
      document.getElementById('searchCount').textContent = `${total} result${total !== 1 ? 's' : ''}`;
      
      let html = '';
      if (results.notes.length > 0) {
        html += '<div class="search-group"><div class="search-group-title">Notes</div>';
        html += results.notes.map(n => `
          <div class="search-result-item" data-type="note" data-id="${n.id}">
            <div class="search-result-title"><span class="search-result-type note">Note</span>${n.title}</div>
          </div>
        `).join('');
        html += '</div>';
      }
      if (results.papers.length > 0) {
        html += '<div class="search-group"><div class="search-group-title">Papers</div>';
        html += results.papers.map(p => `
          <div class="search-result-item" data-type="paper" data-id="${p.id}">
            <div class="search-result-title"><span class="search-result-type paper">Paper</span>${p.title}</div>
          </div>
        `).join('');
        html += '</div>';
      }
      if (results.tasks.length > 0) {
        html += '<div class="search-group"><div class="search-group-title">Tasks</div>';
        html += results.tasks.map(t => `
          <div class="search-result-item" data-type="task" data-id="${t.id}">
            <div class="search-result-title"><span class="search-result-type task">Task</span>${t.title}</div>
          </div>
        `).join('');
        html += '</div>';
      }
      if (total === 0) {
        html = '<div class="empty-state">No results found</div>';
      }
      
      document.getElementById('searchResults').innerHTML = html;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('searchTab').classList.add('active');
      
      // Click handlers for search results
      document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', async () => {
          const type = item.dataset.type;
          const id = parseInt(item.dataset.id);
          globalSearchInput.value = '';
          if (type === 'note') {
            const notes = await invoke('get_notes');
            const note = notes.find(n => n.id === id);
            if (note) {
              editingNoteId = note.id;
              document.getElementById('noteTitle').value = note.title;
              document.getElementById('noteFolder').value = note.folder;
              document.getElementById('noteTags').value = note.tags.join(', ');
              document.getElementById('noteContent').value = note.content;
              document.getElementById('deleteNoteBtn').style.display = 'inline';
              noteModal.classList.add('active');
            }
          } else if (type === 'paper') {
            const papers = await invoke('get_papers');
            const paper = papers.find(p => p.id === id);
            if (paper) openCitationModal(paper);
          } else if (type === 'task') {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('tasksTab').classList.add('active');
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-tab="tasks"]').classList.add('active');
            currentTab = 'tasks';
          }
        });
      });
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 300);
});

async function loadNotes() {
  const notes = await invoke('get_notes');
  renderNotes(notes);
}

function renderNotes(notes) {
  document.getElementById('notesCount').textContent = `${notes.length} item${notes.length !== 1 ? 's' : ''}`;
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
        noteModal.classList.add('active');
      }
    });
  });
}

// Tasks
const tasksList = document.getElementById('tasksList');

document.getElementById('addTaskBtn').addEventListener('click', async () => {
  const text = document.getElementById('taskInput').value;
  const dateStr = document.getElementById('taskDueDate').value;
  const timeStr = document.getElementById('taskDueTime').value;
  
  if (!text) return;
  
  let due_date = null;
  if (dateStr) {
    const dateTime = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
    due_date = new Date(dateTime).getTime() / 1000;
  }
  
  try {
    await invoke('create_task', { req: { text, due_date } });
    document.getElementById('taskInput').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskDueTime').value = '';
    loadTasks();
  } catch (err) {
    console.error('Add task error:', err);
  }
});

async function loadTasks() {
  const tasks = await invoke('get_tasks');
  renderTasks(tasks);
}

function renderTasks(tasks) {
  document.getElementById('tasksCount').textContent = `${tasks.length} item${tasks.length !== 1 ? 's' : ''}`;
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
  paperModal.classList.add('active');
});

document.getElementById('closePaperModal').addEventListener('click', () => {
  paperModal.classList.remove('active');
});

document.getElementById('savePaperBtn').addEventListener('click', async () => {
  const paper = {
    title: document.getElementById('paperTitle').value || 'Untitled',
    authors: document.getElementById('paperAuthors').value,
    year: document.getElementById('paperYear').value || null,
    doi: document.getElementById('paperDOI').value || null,
    journal: document.getElementById('paperJournal').value || null
  };
  
  try {
    // Check for duplicates
    const duplicate = await invoke('check_duplicate_paper', { 
      doi: paper.doi, 
      title: paper.title 
    });
    
    if (duplicate) {
      pendingPaper = paper;
      document.getElementById('duplicateMessage').textContent = 
        `"${duplicate.title}" by ${duplicate.authors} already exists. Add anyway?`;
      duplicateModal.classList.add('active');
      return;
    }
    
    await invoke('create_paper', { req: paper });
    paperModal.classList.remove('active');
    loadPapers();
  } catch (err) {
    console.error('Save paper error:', err);
  }
});

document.getElementById('cancelDuplicateBtn').addEventListener('click', () => {
  duplicateModal.classList.remove('active');
  pendingPaper = null;
});

document.getElementById('addAnywayBtn').addEventListener('click', async () => {
  if (pendingPaper) {
    await invoke('create_paper', { req: pendingPaper });
    pendingPaper = null;
  }
  duplicateModal.classList.remove('active');
  paperModal.classList.remove('active');
  loadPapers();
});

async function loadPapers() {
  const papers = await invoke('get_papers');
  renderPapers(papers);
}

function renderPapers(papers) {
  if (papers.length === 0) {
    papersList.innerHTML = '<div class="empty-state">No papers in library. Add your first paper!</div>';
    document.getElementById('papersCount').textContent = '0 items';
    return;
  }
  
  document.getElementById('papersCount').textContent = `${papers.length} item${papers.length !== 1 ? 's' : ''}`;
  
  papersList.innerHTML = papers.map(paper => `
    <div class="paper-item" data-id="${paper.id}">
      <div class="paper-title">${paper.title}</div>
      <div class="paper-meta">${paper.authors || 'Unknown'} • ${paper.year || 'n.d.'}${paper.doi ? ' • DOI: ' + paper.doi : ''}</div>
      <div class="paper-actions">
        <button class="cite-btn" data-id="${paper.id}">Cite</button>
        <button class="delete-btn" data-id="${paper.id}">×</button>
      </div>
    </div>
  `).join('');
  
  // Cite buttons
  papersList.querySelectorAll('.cite-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const papers = await invoke('get_papers');
      const paper = papers.find(p => p.id === id);
      if (paper) openCitationModal(paper);
    });
  });
  
  // Delete buttons
  papersList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      try {
        await invoke('delete_paper', { id });
        loadPapers();
      } catch (err) {
        console.error('Delete paper error:', err);
      }
    });
  });
}

// DOI Search
document.getElementById('doiSearchBtn').addEventListener('click', searchDOI);
document.getElementById('doiSearchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchDOI();
});

async function searchDOI() {
  const doi = document.getElementById('doiSearchInput').value.trim();
  const statusEl = document.getElementById('doiSearchStatus');
  
  if (!doi) return;
  
  statusEl.textContent = 'Searching...';
  statusEl.className = 'search-status';
  
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    
    if (!response.ok) {
      throw new Error('Paper not found');
    }
    
    const data = await response.json();
    const work = data.message;
    
    // Populate form
    document.getElementById('paperTitle').value = work.title?.[0] || '';
    document.getElementById('paperAuthors').value = (work.author || [])
      .map(a => `${a.given || ''} ${a.family || ''}`.trim())
      .join(', ');
    document.getElementById('paperYear').value = work.published?.['date-parts']?.[0]?.[0] || '';
    document.getElementById('paperDOI').value = work.DOI || doi;
    document.getElementById('paperJournal').value = work['container-title']?.[0] || work.publisher || '';
    
    statusEl.textContent = 'Paper found! Fields populated.';
    statusEl.className = 'search-status success';
    
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.className = 'search-status error';
  }
}

// Export Bibliography
document.getElementById('exportBibBtn').addEventListener('click', async () => {
  const papers = await invoke('get_papers');
  if (papers.length === 0) {
    const btn = document.getElementById('exportBibBtn');
    const original = btn.textContent;
    btn.textContent = 'No papers!';
    setTimeout(() => btn.textContent = original, 1500);
    return;
  }
  
  let biblio = '# Bibliography\n\n';
  papers.forEach((paper, i) => {
    biblio += `${i + 1}. ${formatAPA(paper)}\n`;
  });
  
  try {
    await navigator.clipboard.writeText(biblio);
  } catch (err) {
    console.error('Clipboard error:', err);
  }
  
  const btn = document.getElementById('exportBibBtn');
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = original, 1500);
});

// Citation Modal
const citationModal = document.getElementById('citationModal');
let currentPaper = null;

function formatAPA(paper) {
  const authors = paper.authors || 'Unknown';
  const year = paper.year || 'n.d.';
  const title = paper.title || 'Untitled';
  const journal = paper.journal || '';
  const doi = paper.doi ? `https://doi.org/${paper.doi}` : '';
  
  if (journal) {
    return `${authors} (${year}). ${title}. ${journal}. ${doi}`;
  }
  return `${authors} (${year}). ${title}. ${doi}`;
}

function formatMLA(paper) {
  const authors = paper.authors || 'Unknown';
  const year = paper.year || 'n.d.';
  const title = paper.title || 'Untitled';
  const journal = paper.journal || '';
  const doi = paper.doi ? `https://doi.org/${paper.doi}` : '';
  
  return `"${title}." ${journal ? journal + ', ' : ''}${authors}, ${year}. ${doi}`;
}

function formatChicago(paper) {
  const authors = paper.authors || 'Unknown';
  const year = paper.year || 'n.d.';
  const title = paper.title || 'Untitled';
  const journal = paper.journal || '';
  const doi = paper.doi ? `https://doi.org/${paper.doi}` : '';
  
  return `${authors}. "${title}." ${journal ? journal : ''} (${year}). ${doi}`;
}

function formatBibTeX(paper) {
  const key = paper.authors ? paper.authors.split(',')[0].trim().toLowerCase().replace(/[^a-z]/g, '') + (paper.year || '0000') : 'unknown';
  return `@article{${key},
  title={${paper.title || ''}},
  author={${paper.authors || ''}},
  year={${paper.year || ''}},
  journal={${paper.journal || ''}},
  doi={${paper.doi || ''}}
}`;
}

function openCitationModal(paper) {
  currentPaper = paper;
  document.getElementById('apaCitation').value = formatAPA(paper);
  document.getElementById('mlaCitation').value = formatMLA(paper);
  document.getElementById('chicagoCitation').value = formatChicago(paper);
  document.getElementById('bibtexCitation').value = formatBibTeX(paper);
  citationModal.classList.add('active');
}

document.getElementById('closeCitationModal').addEventListener('click', () => {
  citationModal.classList.remove('active');
  currentPaper = null;
});

// Copy buttons
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', async () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    try {
      await navigator.clipboard.writeText(input.value);
      btn.classList.add('copied');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = 'Copy';
      }, 1500);
    } catch (err) {
      console.error('Copy error:', err);
    }
  });
});

// Initial load
loadNotes();