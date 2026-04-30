document.addEventListener('DOMContentLoaded', () => {
  const noteInput = document.getElementById('noteInput');
  const addBtn = document.getElementById('addBtn');
  const notesList = document.getElementById('notesList');
  const emptyState = document.getElementById('emptyState');
  const noteCount = document.getElementById('noteCount');
  const searchInput = document.getElementById('searchInput');
  const exportBtn = document.getElementById('exportBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const themeToggle = document.getElementById('themeToggle');

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab + 'Tab').classList.add('active');
    });
  });

  // Rich text editor toolbar - attach event listeners immediately
  document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const command = btn.dataset.command;
      const value = btn.dataset.value || null;
      document.execCommand(command, false, value);
      noteInput.focus();
    });
  });

  // ==================== PRODUCTIVITY FEATURES ====================

  

  let tasks = [];

  

  // Task DOM elements

  const taskInput = document.getElementById('taskInput');

  const taskReminder = document.getElementById('taskReminder');

  const addTaskBtn = document.getElementById('addTaskBtn');

  const tasksList = document.getElementById('tasksList');

  // Load tasks from storage
  chrome.storage.local.get(['tasks'], (result) => {
    tasks = result.tasks || [];
    renderTasks();
  });

  // Save tasks
  function saveTasks() {
    chrome.storage.local.set({ tasks });
  }

  // Render tasks
  function renderTasks() {
    if (tasks.length === 0) {
      tasksList.innerHTML = '<div class="empty-state"><p>No tasks yet.</p></div>';
      return;
    }
    
    tasksList.innerHTML = tasks.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <span class="task-text">${task.text}</span>
        ${task.reminder ? `<span class="task-reminder">${new Date(task.reminder).toLocaleString()}</span>` : ''}
        <button class="btn-icon btn-delete-task">×</button>
      </div>
    `).join('');
    
    // Attach event listeners
    tasksList.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const taskId = e.target.closest('.task-item').dataset.id;
        toggleTask(taskId);
      });
    });
    
    tasksList.querySelectorAll('.btn-delete-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.target.closest('.task-item').dataset.id;
        deleteTask(taskId);
      });
    });
  }

  // Add task
  addTaskBtn.addEventListener('click', () => {
    const text = taskInput.value.trim();
    if (!text) return;
    
    const task = {
      id: Date.now().toString(),
      text,
      completed: false,
      reminder: taskReminder.value || null,
      createdAt: Date.now()
    };
    
    tasks.unshift(task);
    saveTasks();
    renderTasks();
    
    taskInput.value = '';
    taskReminder.value = '';
    
    // Set alarm if reminder is set
    if (task.reminder) {
      const alarmTime = new Date(task.reminder).getTime();
      if (alarmTime > Date.now()) {
        chrome.alarms.create(`task-reminder-${task.id}`, { when: alarmTime });
      }
    }
  });

  // Toggle task completion
  function toggleTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      renderTasks();
    }
  }

  // Delete task
  function deleteTask(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    chrome.alarms.clear(`task-reminder-${taskId}`);
    saveTasks();
    renderTasks();
  }

  // Voice-to-text
  const voiceBtn = document.getElementById('voiceBtn');
  let recognition = null;

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    voiceBtn.addEventListener('click', () => {
      recognition.start();
      voiceBtn.textContent = 'Listening...';
      voiceBtn.disabled = true;
    });
    
    recognition.onresult = (event) => {
      if (event.results[0].isFinal) {
        const transcript = event.results[0][0].transcript;
        noteInput.innerHTML += transcript + ' ';
        voiceBtn.textContent = 'Dictation';
        voiceBtn.disabled = false;
      }
    };
    
    recognition.onerror = (error) => {
      console.error('Speech recognition error:', error);
      voiceBtn.textContent = 'Dictation';
      voiceBtn.disabled = false;
    };
    
    recognition.onend = () => {
      voiceBtn.textContent = 'Dictation';
      voiceBtn.disabled = false;
    };
  } else {
    voiceBtn.style.display = 'none';
  }





  let notes = [];
  let paperLibrary = [];
  let citationHistory = [];

  // Load notes, theme, paper library, citation history, and paper views
  chrome.storage.local.get(['notes', 'darkMode', 'paperLibrary', 'citationHistory', 'paperViews'], (result) => {
    notes = result.notes || [];
    paperLibrary = result.paperLibrary || [];
    citationHistory = result.citationHistory || [];
    paperViews = result.paperViews || [];
    if (result.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    renderNotes();
    renderPaperLibrary();
    updateYearFilter();
    updateTagFilter();
  });

  // Theme toggle
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      chrome.storage.local.set({ darkMode: false });
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      chrome.storage.local.set({ darkMode: true });
    }
  });

  // Add note
  addBtn.addEventListener('click', addNote);
  noteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addNote();
    }
  });

  function addNote() {
    const text = noteInput.value.trim();
    if (!text) return;

    const note = {
      id: Date.now(),
      text: text,
      createdAt: Date.now(),
      pinned: false
    };

    notes.unshift(note);
    saveNotes();
    noteInput.value = '';
    renderNotes();
  }

  function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
  }

  function copyNote(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard');
    });
  }

  function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
      note.pinned = !note.pinned;
      saveNotes();
      renderNotes();
    }
  }

  function saveNotes() {
    chrome.storage.local.set({ notes });
  }

  function savePaperLibrary() {
    chrome.storage.local.set({ paperLibrary });
  }

  function saveCitationHistory() {
    chrome.storage.local.set({ citationHistory });
  }

  function savePaperViews() {
    chrome.storage.local.set({ paperViews });
  }

  function renderNotes() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredNotes = notes.filter(note => 
      note.text.toLowerCase().includes(searchTerm)
    );

    // Sort: pinned first, then by date
    filteredNotes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.id - a.id;
    });

    const pinnedCount = notes.filter(n => n.pinned).length;
    noteCount.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}${pinnedCount > 0 ? ` (${pinnedCount} pinned)` : ''}`;

    if (filteredNotes.length === 0) {
      notesList.innerHTML = '';
      notesList.appendChild(emptyState);
      emptyState.style.display = 'block';
      if (notes.length > 0 && searchTerm) {
        emptyState.innerHTML = '<p>No notes match your search.</p>';
      } else {
        emptyState.innerHTML = '<p>No notes yet. Create your first note above!</p>';
      }
      return;
    }

    notesList.innerHTML = '';
    filteredNotes.forEach(note => {
      const noteEl = createNoteElement(note);
      notesList.appendChild(noteEl);
    });
  }

  function createNoteElement(note) {
    const div = document.createElement('div');
    div.className = `note-item${note.pinned ? ' pinned' : ''}`;
    div.innerHTML = `
      <div class="note-text">${renderMarkdown(note.text)}</div>
      <div class="note-meta">
        <span class="note-date">${formatRelativeTime(note.createdAt)}</span>
        <div class="note-actions">
          <button class="btn-icon btn-pin${note.pinned ? ' active' : ''}" title="${note.pinned ? 'Unpin' : 'Pin'}">
            <svg viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z"/></svg>
          </button>
          <button class="btn-icon btn-copy" title="Copy">
            <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="btn-icon btn-delete" title="Delete">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `;

    div.querySelector('.btn-delete').addEventListener('click', () => deleteNote(note.id));
    div.querySelector('.btn-copy').addEventListener('click', () => copyNote(note.text));
    div.querySelector('.btn-pin').addEventListener('click', () => togglePin(note.id));

    return div;
  }

  // Simple markdown renderer
  function renderMarkdown(text) {
    // Escape HTML first
    let html = text.replace(/&/g, '&​amp;').replace(/</g, '&​lt;').replace(/>/g, '&​gt;');
    
    // URLs to links
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    
    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Inline code: `text`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Date(timestamp).toLocaleDateString();
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e293b;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // Search
  searchInput.addEventListener('input', renderNotes);

  // Export notes
  exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(notes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notes-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  // Clear all
  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all notes?')) {
      notes = [];
      saveNotes();
      renderNotes();
    }
  });

  // ==================== PAPER LIBRARY ====================

  const librarySection = document.getElementById('librarySection');
  const libraryList = document.getElementById('libraryList');
  const libraryEmpty = document.getElementById('libraryEmpty');
  const librarySearch = document.getElementById('librarySearch');
  const libraryYearFilter = document.getElementById('libraryYearFilter');
  const libraryTagFilter = document.getElementById('libraryTagFilter');
  const toggleAbstractBtn = document.getElementById('toggleAbstractBtn');
  const historySection = document.getElementById('historySection');
  const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
  const historyContent = document.getElementById('historyContent');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const totalCitations = document.getElementById('totalCitations');
  const uniquePapers = document.getElementById('uniquePapers');

  let abstractExpanded = false;

  function renderPaperLibrary() {
    const searchTerm = librarySearch.value.toLowerCase();
    const yearFilter = libraryYearFilter.value;
    const tagFilter = libraryTagFilter.value;

    let filteredPapers = paperLibrary.filter(paper => {
      const matchesSearch = paper.title.toLowerCase().includes(searchTerm) ||
        paper.authors.some(a => a.toLowerCase().includes(searchTerm)) ||
        paper.journal.toLowerCase().includes(searchTerm);
      const matchesYear = !yearFilter || paper.year === yearFilter;
      const matchesTag = !tagFilter || (paper.tags && paper.tags.includes(tagFilter));
      return matchesSearch && matchesYear && matchesTag;
    });

    if (filteredPapers.length === 0) {
      libraryList.innerHTML = '';
      libraryList.appendChild(libraryEmpty);
      libraryEmpty.style.display = 'block';
      return;
    }

    libraryList.innerHTML = '';
    filteredPapers.forEach(paper => {
      const paperEl = createPaperElement(paper);
      libraryList.appendChild(paperEl);
    });
  }

  function createPaperElement(paper) {
    const div = document.createElement('div');
    div.className = `paper-item${paper.favorite ? ' favorite' : ''}`;
    div.innerHTML = `
      <div class="paper-item-header">
        <div class="paper-item-title">${paper.title}</div>
        <button class="btn-icon btn-star${paper.favorite ? ' active' : ''}" title="Toggle favorite">
          <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
        </button>
      </div>
      <div class="paper-item-meta">
        <span class="paper-item-authors">${paper.authors.slice(0, 2).join(', ')}${paper.authors.length > 2 ? ' et al.' : ''}</span>
        <span class="paper-item-journal">${paper.journal} (${paper.year})</span>
      </div>
      <div class="paper-item-tags">
        ${(paper.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
        <button class="btn-icon btn-add-tag" title="Add tag">+</button>
      </div>
      <div class="paper-item-note">
        <textarea class="personal-note" placeholder="Add personal note..." rows="1">${paper.personalNote || ''}</textarea>
      </div>
      <div class="paper-item-actions">
        <button class="btn-icon btn-copy-citation" title="Copy Citation">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        </button>
        <button class="btn-icon btn-delete-paper" title="Remove from Library">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;

    div.querySelector('.btn-copy-citation').addEventListener('click', () => {
      const citation = generateCitationForPaper(paper, 'apa');
      navigator.clipboard.writeText(citation).then(() => {
        showToast('Citation copied');
        addToCitationHistory(paper.doi, 'apa');
      });
    });

    div.querySelector('.btn-delete-paper').addEventListener('click', () => {
      paperLibrary = paperLibrary.filter(p => p.doi !== paper.doi);
      savePaperLibrary();
      renderPaperLibrary();
      updateYearFilter();
      updateTagFilter();
    });

    div.querySelector('.btn-star').addEventListener('click', () => {
      paper.favorite = !paper.favorite;
      savePaperLibrary();
      renderPaperLibrary();
    });

    div.querySelector('.btn-add-tag').addEventListener('click', () => {
      const tag = prompt('Enter tag:');
      if (tag && tag.trim()) {
        if (!paper.tags) paper.tags = [];
        if (!paper.tags.includes(tag.trim())) {
          paper.tags.push(tag.trim());
          savePaperLibrary();
          renderPaperLibrary();
          updateTagFilter();
        }
      }
    });

    div.querySelector('.personal-note').addEventListener('input', (e) => {
      paper.personalNote = e.target.value;
      savePaperLibrary();
    });

    div.querySelector('.personal-note').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.target.blur();
      }
    });

    return div;
  }

  function updateYearFilter() {
    const years = [...new Set(paperLibrary.map(p => p.year).filter(Boolean))].sort().reverse();
    const currentValue = libraryYearFilter.value;
    libraryYearFilter.innerHTML = '<option value="">All Years</option>';
    years.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      libraryYearFilter.appendChild(option);
    });
    libraryYearFilter.value = currentValue;
  }

  function updateTagFilter() {
    const allTags = [...new Set(paperLibrary.flatMap(p => p.tags || []))].sort();
    const currentValue = libraryTagFilter.value;
    libraryTagFilter.innerHTML = '<option value="">All Tags</option>';
    allTags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      libraryTagFilter.appendChild(option);
    });
    libraryTagFilter.value = currentValue;
  }

  librarySearch.addEventListener('input', renderPaperLibrary);
  libraryYearFilter.addEventListener('change', renderPaperLibrary);
  libraryTagFilter.addEventListener('change', renderPaperLibrary);

  const analyticsSection = document.getElementById('analyticsSection');
  const toggleAnalyticsBtn = document.getElementById('toggleAnalyticsBtn');
  const analyticsContent = document.getElementById('analyticsContent');
  const papersReadWeek = document.getElementById('papersReadWeek');
  const papersReadMonth = document.getElementById('papersReadMonth');
  const totalCitationsAnalytics = document.getElementById('totalCitationsAnalytics');
  const librarySize = document.getElementById('librarySize');
  const topJournalsList = document.getElementById('topJournalsList');
  const topAuthorsList = document.getElementById('topAuthorsList');
  const citationTrendsList = document.getElementById('citationTrendsList');

  let paperViews = [];

  // ==================== RESEARCH ASSISTANT ====================

  const researchSection = document.getElementById('researchSection');
  const paperTitle = document.getElementById('paperTitle');
  const paperAuthors = document.getElementById('paperAuthors');
  const paperDoi = document.getElementById('paperDoi');
  const paperAbstract = document.getElementById('paperAbstract');
  const citationOutput = document.getElementById('citationOutput');
  const doiInput = document.getElementById('doiInput');
  const lookupDoiBtn = document.getElementById('lookupDoiBtn');
  const saveCitationBtn = document.getElementById('saveCitationBtn');
  const saveToLibraryBtn = document.getElementById('saveToLibraryBtn');
  const batchDoiInput = document.getElementById('batchDoiInput');
  const batchLookupBtn = document.getElementById('batchLookupBtn');
  const exportCitationsBtn = document.getElementById('exportCitationsBtn');
  
  let currentPaper = null;
  let currentCitation = '';

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/cmd + N: Add note
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      noteInput.focus();
    }
    // Ctrl/Cmd + F: Search notes
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
    // Ctrl/Cmd + L: DOI lookup
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      doiInput.focus();
    }
    // Escape: Clear focus
    if (e.key === 'Escape') {
      document.activeElement.blur();
    }
  });

  // Detect DOI from current tab
  async function detectPaperFromTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith('chrome://')) return;
    
    // Try to extract DOI from URL or page content
    const doi = await extractDoiFromTab(tab);
    if (doi) {
      await fetchPaperMetadata(doi);
    }
  }

  async function extractDoiFromTab(tab) {
    // Check for arXiv ID first
    const arxivMatch = tab.url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
    if (arxivMatch) return `arxiv:${arxivMatch[1]}`;

    // Common DOI patterns in URLs
    const doiPatterns = [
      /doi\.org\/(10\.\d{4,}\/[^\s]+)/,
      /doi=(10\.\d{4,}\/[^\s&]+)/,
      /\/(10\.\d{4,}\/[^\s/]+)/,
      /(10\.\d{4,}\/[^\s]+)/
    ];
    
    for (const pattern of doiPatterns) {
      const match = tab.url.match(pattern);
      if (match) return match[1];
    }
    
    // Try to get from page content via content script injection
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Look for DOI in meta tags
          const doiMeta = document.querySelector('meta[name="citation_doi"], meta[name="DC.identifier"]');
          if (doiMeta) return doiMeta.content;
          
          // Look for DOI in page text
          const text = document.body.innerText;
          const doiMatch = text.match(/10\.\d{4,}\/[^\s]+/);
          return doiMatch ? doiMatch[0] : null;
        }
      });
      return result;
    } catch {
      return null;
    }
  }

  async function fetchPaperMetadata(doi) {
    try {
      // Check if it's an arXiv ID
      if (doi.startsWith('arxiv:')) {
        const arxivId = doi.replace('arxiv:', '');
        return await fetchArxivMetadata(arxivId);
      }

      const response = await fetch(`https://api.crossref.org/works/${doi}`);
      if (!response.ok) throw new Error('Paper not found');
      
      const data = await response.json();
      const work = data.message;
      
      currentPaper = {
        doi: doi,
        title: work.title[0],
        authors: work.author?.map(a => `${a.given || ''} ${a.family || ''}`.trim()) || [],
        journal: work['container-title']?.[0] || '',
        year: work.published?.['date-parts']?.[0]?.[0] || work.created?.['date-parts']?.[0]?.[0] || '',
        volume: work.volume || '',
        issue: work.issue || '',
        pages: work.page || '',
        url: work.URL || `https://doi.org/${doi}`,
        abstract: work.abstract || ''
      };
      
      displayPaperInfo(currentPaper);
      generateCitation('apa'); // Default to APA
    } catch (err) {
      showToast('Could not fetch paper metadata');
    }
  }

  async function fetchArxivMetadata(arxivId) {
    try {
      const response = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`);
      if (!response.ok) throw new Error('Paper not found');
      
      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      
      const entry = xml.querySelector('entry');
      if (!entry) throw new Error('Invalid arXiv response');
      
      const authors = Array.from(entry.querySelectorAll('author')).map(a => {
        const name = a.querySelector('name')?.textContent || '';
        return name;
      });
      
      const published = entry.querySelector('published')?.textContent || '';
      const year = published ? new Date(published).getFullYear() : '';
      
      currentPaper = {
        doi: `arxiv:${arxivId}`,
        title: entry.querySelector('title')?.textContent?.trim() || '',
        authors: authors,
        journal: 'arXiv',
        year: year.toString(),
        volume: '',
        issue: '',
        pages: '',
        url: entry.querySelector('id')?.textContent || `https://arxiv.org/abs/${arxivId}`,
        abstract: entry.querySelector('summary')?.textContent?.trim() || ''
      };
      
      displayPaperInfo(currentPaper);
      generateCitation('apa');
    } catch (err) {
      showToast('Could not fetch arXiv paper');
    }
  }

  function displayPaperInfo(paper) {
    researchSection.style.display = 'block';
    paperTitle.textContent = paper.title;
    paperAuthors.textContent = paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ' et al.' : '');
    paperDoi.textContent = `DOI: ${paper.doi}`;
    
    if (paper.abstract) {
      paperAbstract.textContent = paper.abstract.substring(0, 300) + (paper.abstract.length > 300 ? '...' : '');
      paperAbstract.style.display = 'block';
      toggleAbstractBtn.style.display = paper.abstract.length > 300 ? 'inline-block' : 'none';
      toggleAbstractBtn.textContent = 'Show more';
      abstractExpanded = false;
    } else {
      paperAbstract.style.display = 'none';
      toggleAbstractBtn.style.display = 'none';
    }

    // Track paper view
    const existingView = paperViews.find(v => v.doi === paper.doi);
    if (existingView) {
      existingView.lastViewed = Date.now();
      existingView.viewCount++;
    } else {
      paperViews.unshift({
        doi: paper.doi,
        title: paper.title,
        firstViewed: Date.now(),
        lastViewed: Date.now(),
        viewCount: 1
      });
    }
    savePaperViews();
  }

  // Toggle abstract
  toggleAbstractBtn.addEventListener('click', () => {
    if (!currentPaper) return;
    abstractExpanded = !abstractExpanded;
    if (abstractExpanded) {
      paperAbstract.textContent = currentPaper.abstract;
      toggleAbstractBtn.textContent = 'Show less';
    } else {
      paperAbstract.textContent = currentPaper.abstract.substring(0, 300) + '...';
      toggleAbstractBtn.textContent = 'Show more';
    }
  });

  function generateCitation(format) {
    if (!currentPaper) return;
    currentCitation = generateCitationForPaper(currentPaper, format);
    citationOutput.textContent = currentCitation;
    citationOutput.style.display = 'block';
  }

  function generateCitationForPaper(paper, format) {
    const { title, authors, journal, year, volume, issue, pages, doi, url } = paper;
    let citation = '';
    
    switch(format) {
      case 'apa':
        const apaAuthors = authors.length > 2 
          ? `${authors[0].split(' ').pop()}, ${getInitials(authors[0])}, et al.`
          : authors.map(a => `${a.split(' ').pop()}, ${getInitials(a)}`).join(', ');
        citation = `${apaAuthors} (${year}). ${title}. ${journal}${volume ? `, ${volume}` : ''}${issue ? `(${issue})` : ''}${pages ? `, ${pages}` : ''}. ${doi.startsWith('arxiv:') ? `https://arxiv.org/abs/${doi.replace('arxiv:', '')}` : `https://doi.org/${doi}`}`;
        break;
        
      case 'mla':
        const mlaAuthors = authors.length > 2 
          ? `${authors[0].split(' ').pop()}, ${getFirstName(authors[0])}, et al.`
          : authors.map(a => `${a.split(' ').pop()}, ${getFirstName(a)}`).join(', and ');
        citation = `${mlaAuthors}. "${title}." ${journal}, vol. ${volume}, no. ${issue}, ${year}, pp. ${pages}.`;
        break;
        
      case 'chicago':
        const chiAuthors = authors.length > 3
          ? `${authors[0]} et al.`
          : authors.join(', ');
        citation = `${chiAuthors}. "${title}." ${journal} ${volume}, no. ${issue} (${year}): ${pages}.`;
        break;
        
      case 'bibtex':
        const key = `${authors[0]?.split(' ').pop()?.toLowerCase() || 'unknown'}${year}`;
        citation = `@article{${key},\n  title={${title}},\n  author={${authors.join(' and ')}},\n  journal={${journal}},\n  year={${year}},\n  volume={${volume}},\n  number={${issue}},\n  pages={${pages}},\n  doi={${doi}}\n}`;
        break;
    }
    
    return citation;
  }

  function getInitials(name) {
    return name.split(' ').map(n => n[0]?.toUpperCase()).filter(Boolean).join('. ') + '.';
  }

  function getFirstName(name) {
    return name.split(' ')[0];
  }

  // Citation format buttons
  document.querySelectorAll('.citation-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.citation-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      generateCitation(btn.dataset.format);
    });
  });

  // Manual DOI lookup
  lookupDoiBtn.addEventListener('click', () => {
    const doi = doiInput.value.trim();
    if (doi) fetchPaperMetadata(doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, ''));
  });

  doiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupDoiBtn.click();
  });

  // Batch DOI lookup
  batchLookupBtn.addEventListener('click', async () => {
    const dois = batchDoiInput.value.trim().split('\n').map(d => d.trim()).filter(d => d);
    if (dois.length === 0) return;

    showToast(`Looking up ${dois.length} papers...`);
    
    for (const doi of dois) {
      const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
      await fetchPaperMetadata(cleanDoi);
      if (currentPaper) {
        saveToLibrary(currentPaper);
      }
    }
    
    showToast(`Added ${dois.length} papers to library`);
    batchDoiInput.value = '';
  });

  // Save citation as note
  saveCitationBtn.addEventListener('click', () => {
    if (!currentCitation || !currentPaper) return;
    
    const noteText = `📄 **${currentPaper.title}**\n\n` +
      `**Authors:** ${currentPaper.authors.join(', ')}\n` +
      `**Journal:** ${currentPaper.journal} (${currentPaper.year})\n` +
      `**DOI:** ${currentPaper.doi}\n\n` +
      `**Citation:**\n${currentCitation}`;
    
    const note = {
      id: Date.now(),
      text: noteText,
      createdAt: Date.now(),
      pinned: false,
      type: 'paper',
      doi: currentPaper.doi
    };
    
    notes.unshift(note);
    saveNotes();
    renderNotes();
    addToCitationHistory(currentPaper.doi, 'apa');
    showToast('Paper saved to notes');
  });

  // Save to library
  saveToLibraryBtn.addEventListener('click', () => {
    if (!currentPaper) return;
    addPaperToLibrary(currentPaper);
  });

  function saveToLibrary(paper) {
    // Use new duplicate detection
    addPaperToLibrary(paper);
  }

  // Export all citations
  exportCitationsBtn.addEventListener('click', () => {
    if (paperLibrary.length === 0) {
      showToast('No papers in library');
      return;
    }

    const format = 'apa';
    const citations = paperLibrary.map(paper => generateCitationForPaper(paper, format)).join('\n\n');
    
    const dataBlob = new Blob([citations], { type: 'text/plain' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bibliography-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast('Bibliography exported');
  });

  // Citation history tracking
  function addToCitationHistory(doi, format) {
    const existing = citationHistory.find(h => h.doi === doi && h.format === format);
    if (existing) {
      existing.lastUsed = Date.now();
      existing.count++;
    } else {
      citationHistory.unshift({
        doi,
        format,
        firstUsed: Date.now(),
        lastUsed: Date.now(),
        count: 1
      });
    }
    saveCitationHistory();
  }

  // Toggle history dashboard
  toggleHistoryBtn.addEventListener('click', () => {
    const isHidden = historyContent.style.display === 'none';
    historyContent.style.display = isHidden ? 'block' : 'none';
    if (isHidden) renderCitationHistory();
  });

  // Toggle analytics dashboard
  toggleAnalyticsBtn.addEventListener('click', () => {
    const isHidden = analyticsContent.style.display === 'none';
    analyticsContent.style.display = isHidden ? 'block' : 'none';
    if (isHidden) renderAnalytics();
  });

  function renderAnalytics() {
    // Reading statistics
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    const papersReadWeekCount = paperViews.filter(v => v.lastViewed >= weekAgo).length;
    const papersReadMonthCount = paperViews.filter(v => v.lastViewed >= monthAgo).length;
    const totalCitationsCount = citationHistory.reduce((sum, h) => sum + h.count, 0);
    
    papersReadWeek.textContent = papersReadWeekCount;
    papersReadMonth.textContent = papersReadMonthCount;
    totalCitationsAnalytics.textContent = totalCitationsCount;
    librarySize.textContent = paperLibrary.length;
    
    // Top journals
    const journalCounts = {};
    paperLibrary.forEach(p => {
      if (p.journal) {
        journalCounts[p.journal] = (journalCounts[p.journal] || 0) + 1;
      }
    });
    const topJournals = Object.entries(journalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topJournalsList.innerHTML = topJournals.length === 0 
      ? '<div class="empty-state">No data yet</div>'
      : topJournals.map(([journal, count]) => `
        <div class="analytics-list-item">
          <span class="item-name">${journal}</span>
          <span class="item-count">${count}</span>
        </div>
      `).join('');
    
    // Top authors
    const authorCounts = {};
    paperLibrary.forEach(p => {
      p.authors.forEach(a => {
        authorCounts[a] = (authorCounts[a] || 0) + 1;
      });
    });
    const topAuthors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topAuthorsList.innerHTML = topAuthors.length === 0
      ? '<div class="empty-state">No data yet</div>'
      : topAuthors.map(([author, count]) => `
        <div class="analytics-list-item">
          <span class="item-name">${author}</span>
          <span class="item-count">${count}</span>
        </div>
      `).join('');
    
    // Citation trends (last 7 days)
    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i * 24 * 60 * 60 * 1000);
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      const dayCitations = citationHistory.filter(h => h.lastUsed >= dayStart && h.lastUsed < dayEnd).length;
      const date = new Date(dayStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      trends.push({ date, count: dayCitations });
    }
    
    citationTrendsList.innerHTML = trends.map(t => `
      <div class="analytics-list-item">
        <span class="item-name">${t.date}</span>
        <span class="item-count">${t.count}</span>
      </div>
    `).join('');
  }

  function renderCitationHistory() {
    const total = citationHistory.reduce((sum, h) => sum + h.count, 0);
    const unique = new Set(citationHistory.map(h => h.doi)).size;
    
    totalCitations.textContent = total;
    uniquePapers.textContent = unique;

    if (citationHistory.length === 0) {
      historyList.innerHTML = '';
      historyList.appendChild(historyEmpty);
      historyEmpty.style.display = 'block';
      return;
    }

    historyList.innerHTML = '';
    citationHistory.slice(0, 10).forEach(h => {
      const paper = paperLibrary.find(p => p.doi === h.doi);
      const title = paper ? paper.title : h.doi;
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-item-title">${title}</div>
        <div class="history-item-meta">
          <span class="history-count">${h.count}x</span>
          <span class="history-format">${h.format.toUpperCase()}</span>
        </div>
      `;
      historyList.appendChild(div);
    });
  }

  // Initialize research assistant
  detectPaperFromTab();

  // ==================== NOTE ENHANCEMENTS ====================
  
  let folders = ['uncategorized'];
  let currentFolder = 'all';
  let editingNoteId = null;

  // Templates
  const templates = {
    meeting: {
      title: 'Meeting Notes',
      content: '<h2>Meeting Notes</h2><p><b>Date:</b> </p><p><b>Attendees:</b> </p><p><b>Agenda:</b></p><ul><li></li></ul><p><b>Action Items:</b></p><ul><li></li></ul>'
    },
    research: {
      title: 'Research Notes',
      content: '<h2>Research Notes</h2><p><b>Topic:</b> </p><p><b>Source:</b> </p><p><b>Key Points:</b></p><ul><li></li></ul><p><b>Questions:</b></p><ul><li></li></ul><p><b>Next Steps:</b></p><ul><li></li></ul>'
    },
    idea: {
      title: 'Idea/Brainstorm',
      content: '<h2>Idea</h2><p><b>Description:</b> </p><p><b>Potential Benefits:</b></p><ul><li></li></ul><p><b>Challenges:</b></p><ul><li></li></ul><p><b>Related Ideas:</b></p><ul><li></li></ul>'
    }
  };

  // New DOM elements
  const noteTitle = document.getElementById('noteTitle');
  const templateSelector = document.getElementById('templateSelector');
  const versionHistoryBtn = document.getElementById('versionHistoryBtn');
  const versionModal = document.getElementById('versionModal');
  const versionList = document.getElementById('versionList');
  const closeVersionModal = document.getElementById('closeVersionModal');
  const linkNoteBtn = document.getElementById('linkNoteBtn');
  const linkModal = document.getElementById('linkModal');
  const linkSearch = document.getElementById('linkSearch');
  const linkList = document.getElementById('linkList');
  const closeLinkModal = document.getElementById('closeLinkModal');
  const foldersBar = document.getElementById('foldersBar');
  const tagCloud = document.getElementById('tagCloud');
  const addFolderBtn = document.getElementById('addFolderBtn');

  // Update storage loading
  chrome.storage.local.get(['notes', 'darkMode', 'paperLibrary', 'citationHistory', 'paperViews', 'folders'], (result) => {
    notes = result.notes || [];
    paperLibrary = result.paperLibrary || [];
    citationHistory = result.citationHistory || [];
    paperViews = result.paperViews || [];
    folders = result.folders || ['uncategorized'];
    if (result.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    renderNotes();
    renderPaperLibrary();
    updateYearFilter();
    updateTagFilter();
    renderFolders();
    renderTagCloud();
  });

  // Save folders
  function saveFolders() {
    chrome.storage.local.set({ folders });
  }

  // Template selector
  templateSelector.addEventListener('change', (e) => {
    const template = templates[e.target.value];
    if (template) {
      noteTitle.value = template.title;
      noteInput.innerHTML = template.content;
    } else {
      noteTitle.value = '';
      noteInput.innerHTML = '';
    }
  });

  // Extract tags from content (hashtags)
  function extractTags(content) {
    const tagRegex = /#(\w+)/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }

  // Render folders
  function renderFolders() {
    foldersBar.innerHTML = `
      <button class="folder-btn ${currentFolder === 'all' ? 'active' : ''}" data-folder="all">All Notes</button>
      <button class="folder-btn ${currentFolder === 'uncategorized' ? 'active' : ''}" data-folder="uncategorized">Uncategorized</button>
    `;
    
    folders.forEach(folder => {
      if (folder !== 'uncategorized') {
        foldersBar.innerHTML += `
          <button class="folder-btn ${currentFolder === folder ? 'active' : ''}" data-folder="${folder}">${folder}</button>
        `;
      }
    });
    
    foldersBar.innerHTML += `<button class="folder-btn" id="addFolderBtn">+ New Folder</button>`;
    
    // Re-attach event listeners
    document.querySelectorAll('.folder-btn[data-folder]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFolder = btn.dataset.folder;
        renderFolders();
        renderNotes();
      });
    });
    
    document.getElementById('addFolderBtn').addEventListener('click', () => {
      const folderName = prompt('Enter folder name:');
      if (folderName && folderName.trim()) {
        folders.push(folderName.trim());
        saveFolders();
        renderFolders();
      }
    });
  }

  // Render tag cloud
  function renderTagCloud() {
    const allTags = {};
    notes.forEach(note => {
      if (note.tags) {
        note.tags.forEach(tag => {
          allTags[tag] = (allTags[tag] || 0) + 1;
        });
      }
    });
    
    const sortedTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]);
    
    tagCloud.innerHTML = sortedTags.length === 0 
      ? '<span class="no-tags">No tags yet. Use #tag in notes.</span>'
      : sortedTags.map(([tag, count]) => `
        <span class="tag-cloud-item" data-tag="${tag}">#${tag} (${count})</span>
      `).join('');
    
    document.querySelectorAll('.tag-cloud-item').forEach(item => {
      item.addEventListener('click', () => {
        searchInput.value = '#' + item.dataset.tag;
        renderNotes();
      });
    });
  }

  // Update renderNotes to include folder filtering and new note structure
  function renderNotes() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredNotes = notes.filter(note => {
      const matchesSearch = note.text.toLowerCase().includes(searchTerm) ||
        note.title.toLowerCase().includes(searchTerm) ||
        (note.tags && note.tags.some(t => t.toLowerCase().includes(searchTerm)));
      const matchesFolder = currentFolder === 'all' || note.folder === currentFolder;
      return matchesSearch && matchesFolder;
    });

    // Sort: pinned first, then by date
    filteredNotes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });

    notesList.innerHTML = '';
    filteredNotes.forEach(note => {
      const noteEl = createNoteElement(note);
      notesList.appendChild(noteEl);
    });

    if (filteredNotes.length === 0) {
      notesList.appendChild(emptyState);
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  }

  // Update createNoteElement to show new features
  function createNoteElement(note) {
    const div = document.createElement('div');
    div.className = `note-item${note.pinned ? ' pinned' : ''}`;
    div.draggable = true;
    
    const linkedNotesHtml = note.linkedNotes && note.linkedNotes.length > 0 
      ? `<div class="linked-notes">📎 ${note.linkedNotes.length} linked</div>`
      : '';
    
    const tagsHtml = note.tags && note.tags.length > 0
      ? `<div class="note-tags">${note.tags.map(t => `<span class="note-tag">#${t}</span>`).join('')}</div>`
      : '';
    
    const folderHtml = note.folder 
      ? `<span class="note-folder">${note.folder}</span>`
      : '';
    
    div.innerHTML = `
      <div class="note-header">
        <div class="note-title">${note.title || 'Untitled'}</div>
        <div class="note-actions">
          <button class="btn-icon btn-pin" title="Pin note">
            <svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
          </button>
          <button class="btn-icon btn-edit" title="Edit note">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="btn-icon btn-delete" title="Delete note">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
      <div class="note-content">${note.text}</div>
      ${tagsHtml}
      ${linkedNotesHtml}
      <div class="note-meta">
        ${folderHtml}
        <span class="note-time">${formatRelativeTime(note.updatedAt || note.createdAt)}</span>
      </div>
    `;

    // Drag and drop
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', note.id);
    });
    
    div.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = note.id;
      if (draggedId !== targetId) {
        const draggedIndex = notes.findIndex(n => n.id === draggedId);
        const targetIndex = notes.findIndex(n => n.id === targetId);
        [notes[draggedIndex], notes[targetIndex]] = [notes[targetIndex], notes[draggedIndex]];
        saveNotes();
        renderNotes();
      }
    });

    // Event listeners
    div.querySelector('.btn-pin').addEventListener('click', () => {
      note.pinned = !note.pinned;
      saveNotes();
      renderNotes();
    });

    div.querySelector('.btn-delete').addEventListener('click', () => {
      notes = notes.filter(n => n.id !== note.id);
      saveNotes();
      renderNotes();
      renderTagCloud();
    });

    div.querySelector('.btn-edit').addEventListener('click', () => {
      noteTitle.value = note.title || '';
      noteInput.innerHTML = note.text;
      editingNoteId = note.id;
      addBtn.textContent = 'Update Note';
      addBtn.onclick = () => updateNote(note.id);
    });

    return div;
  }

  // Update addBtn to use new structure
  addBtn.onclick = () => {
    const title = noteTitle.value.trim() || 'Untitled Note';
    const content = noteInput.innerHTML.trim();
    const tags = extractTags(content);
    
    if (!content) {
      showToast('Please enter a note');
      return;
    }

    const note = {
      id: Date.now().toString(),
      title,
      text: content,
      tags,
      folder: currentFolder === 'all' ? 'uncategorized' : currentFolder,
      linkedNotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versions: [{ content, timestamp: Date.now() }],
      pinned: false
    };

    notes.unshift(note);
    saveNotes();
    renderNotes();
    renderTagCloud();
    
    noteTitle.value = '';
    noteInput.innerHTML = '';
    templateSelector.value = '';
    showToast('Note added');
  };

  // Update note function
  function updateNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.title = noteTitle.value.trim() || 'Untitled Note';
      note.text = noteInput.innerHTML.trim();
      note.tags = extractTags(note.text);
      note.updatedAt = Date.now();
      if (!note.versions) note.versions = [];
      note.versions.push({ content: note.text, timestamp: Date.now() });
      
      saveNotes();
      renderNotes();
      renderTagCloud();
      
      noteTitle.value = '';
      noteInput.innerHTML = '';
      editingNoteId = null;
      addBtn.textContent = 'Add Note';
      addBtn.onclick = null;
      showToast('Note updated');
    }
  }

  // Version history
  versionHistoryBtn.addEventListener('click', () => {
    if (editingNoteId) {
      const note = notes.find(n => n.id === editingNoteId);
      if (note) {
        renderVersionHistory(note);
        versionModal.style.display = 'flex';
      }
    } else {
      showToast('Edit a note first to view history');
    }
  });

  function renderVersionHistory(note) {
    const versions = note.versions || [];
    versionList.innerHTML = versions.map((v, i) => `
      <div class="version-item">
        <div class="version-meta">
          <span class="version-number">Version ${versions.length - i}</span>
          <span class="version-date">${new Date(v.timestamp).toLocaleString()}</span>
        </div>
        <div class="version-content">${v.content}</div>
        <button class="btn-small btn-secondary" onclick="restoreVersion('${note.id}', ${i})">Restore</button>
      </div>
    `).join('');
  }

  window.restoreVersion = function(noteId, versionIndex) {
    const note = notes.find(n => n.id === noteId);
    if (note && note.versions) {
      note.text = note.versions[versionIndex].content;
      note.updatedAt = Date.now();
      note.versions.push({ content: note.text, timestamp: Date.now() });
      saveNotes();
      noteInput.innerHTML = note.text;
      renderVersionHistory(note);
      showToast('Version restored');
    }
  };

  closeVersionModal.addEventListener('click', () => {
    versionModal.style.display = 'none';
  });

  // Note linking
  linkNoteBtn.addEventListener('click', () => {
    if (editingNoteId) {
      linkModal.style.display = 'flex';
      renderLinkList();
    } else {
      showToast('Edit a note first to link');
    }
  });

  linkSearch.addEventListener('input', renderLinkList);

  function renderLinkList() {
    const searchTerm = linkSearch.value.toLowerCase();
    
    const filteredNotes = notes.filter(n => 
      n.id !== editingNoteId && 
      (n.title.toLowerCase().includes(searchTerm) || n.text.toLowerCase().includes(searchTerm))
    );
    
    linkList.innerHTML = filteredNotes.map(n => `
      <div class="link-item" data-id="${n.id}">
        <div class="link-title">${n.title || 'Untitled'}</div>
        <div class="link-preview">${n.text.substring(0, 100)}...</div>
        <button class="btn-small btn-primary" onclick="linkNote('${n.id}')">Link</button>
      </div>
    `).join('');
  }

  window.linkNote = function(targetId) {
    const currentNote = notes.find(n => n.id === editingNoteId);
    const targetNote = notes.find(n => n.id === targetId);
    
    if (currentNote && targetNote) {
      if (!currentNote.linkedNotes) currentNote.linkedNotes = [];
      if (!targetNote.linkedNotes) targetNote.linkedNotes = [];
      if (!currentNote.linkedNotes.includes(targetId)) {
        currentNote.linkedNotes.push(targetId);
        targetNote.linkedNotes.push(editingNoteId);
        saveNotes();
        linkModal.style.display = 'none';
        showToast('Notes linked');
      }
    }
  };

  closeLinkModal.addEventListener('click', () => {
    linkModal.style.display = 'none';
  });

  // Full-text search
  const searchResults = document.getElementById('searchResults');
  const searchResultsList = document.getElementById('searchResultsList');
  const searchResultCount = document.getElementById('searchResultCount');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const closeSearchBtn = document.getElementById('closeSearchBtn');

  function performSearch(query) {
    if (!query.trim()) {
      searchResults.style.display = 'none';
      notesList.style.display = 'block';
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results = notes.filter(note => {
      const titleMatch = note.title && note.title.toLowerCase().includes(lowerQuery);
      const contentMatch = note.text && note.text.toLowerCase().includes(lowerQuery);
      return titleMatch || contentMatch;
    });

    displaySearchResults(results, query);
  }

  function displaySearchResults(results, query) {
    searchResults.style.display = 'block';
    notesList.style.display = 'none';
    searchResultCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    
    searchResultsList.innerHTML = '';
    
    if (results.length === 0) {
      searchResultsList.innerHTML = '<div class="empty-state"><p>No matches found.</p></div>';
      return;
    }

    results.forEach(note => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      
      const snippet = getSearchSnippet(note.text, query);
      const highlightedSnippet = highlightMatches(snippet, query);
      
      div.innerHTML = `
        <div class="search-result-title">${highlightMatches(note.title || 'Untitled', query)}</div>
        <div class="search-result-snippet">${highlightedSnippet}</div>
      `;
      
      div.addEventListener('click', () => {
        editNote(note.id);
        searchResults.style.display = 'none';
        notesList.style.display = 'block';
        searchInput.value = '';
      });
      
      searchResultsList.appendChild(div);
    });
  }

  function getSearchSnippet(text, query) {
    if (!text) return '';
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) {
      // Query matched title but not content, show beginning of content
      return text.substring(0, 150) + (text.length > 150 ? '...' : '');
    }
    
    // Show snippet around the match
    const start = Math.max(0, index - 60);
    const end = Math.min(text.length, index + query.length + 60);
    let snippet = text.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    return snippet;
  }

  function highlightMatches(text, query) {
    if (!text) return '';
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<span class="search-result-match">$1</span>');
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Search event listeners
  searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchResults.style.display = 'none';
    notesList.style.display = 'block';
    searchInput.focus();
  });

  closeSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchResults.style.display = 'none';
    notesList.style.display = 'block';
  });

  // Duplicate detection
  const duplicateModal = document.getElementById('duplicateModal');
  const duplicateMessage = document.getElementById('duplicateMessage');
  const closeDuplicateModal = document.getElementById('closeDuplicateModal');
  const cancelDuplicateBtn = document.getElementById('cancelDuplicateBtn');
  const addAnywayBtn = document.getElementById('addAnywayBtn');
  const viewExistingBtn = document.getElementById('viewExistingBtn');
  
  let pendingPaper = null;

  function checkDuplicate(paper) {
    // Check by DOI first (most reliable)
    const doiMatch = paperLibrary.find(p => p.doi && p.doi === paper.doi);
    if (doiMatch) {
      return { isDuplicate: true, existing: doiMatch, field: 'DOI' };
    }
    
    // Check by title (case-insensitive, trimmed)
    const titleMatch = paperLibrary.find(p => 
      p.title && paper.title && 
      p.title.toLowerCase().trim() === paper.title.toLowerCase().trim()
    );
    if (titleMatch) {
      return { isDuplicate: true, existing: titleMatch, field: 'title' };
    }
    
    return { isDuplicate: false };
  }

  function showDuplicateWarning(paper, duplicateInfo) {
    pendingPaper = paper;
    duplicateMessage.textContent = `A paper with this ${duplicateInfo.field} already exists in your library: "${duplicateInfo.existing.title}" by ${duplicateInfo.existing.authors}. Do you want to add it anyway?`;
    duplicateModal.style.display = 'block';
  }

  function addPaperToLibrary(paper, skipCheck = false) {
    if (!skipCheck) {
      const duplicateCheck = checkDuplicate(paper);
      if (duplicateCheck.isDuplicate) {
        showDuplicateWarning(paper, duplicateCheck);
        return false; // Don't add yet, waiting for user choice
      }
    }
    
    // Add timestamp and ID
    paper.addedAt = Date.now();
    paper.id = Date.now().toString();
    paper.tags = paper.tags || [];
    paper.favorite = paper.favorite || false;
    paper.personalNote = paper.personalNote || '';
    
    paperLibrary.unshift(paper);
    chrome.storage.local.set({ paperLibrary });
    renderPaperLibrary();
    updateYearFilter();
    updateTagFilter();
    showToast('Paper added to library');
    return true;
  }

  // Duplicate modal event listeners
  closeDuplicateModal.addEventListener('click', () => {
    duplicateModal.style.display = 'none';
    pendingPaper = null;
  });

  cancelDuplicateBtn.addEventListener('click', () => {
    duplicateModal.style.display = 'none';
    pendingPaper = null;
  });

  addAnywayBtn.addEventListener('click', () => {
    if (pendingPaper) {
      addPaperToLibrary(pendingPaper, true); // skip check this time
    }
    duplicateModal.style.display = 'none';
    pendingPaper = null;
  });

  viewExistingBtn.addEventListener('click', () => {
    // Switch to research tab and scroll to the duplicate
    document.querySelector('[data-tab="research"]').click();
    duplicateModal.style.display = 'none';
    pendingPaper = null;
  });
});