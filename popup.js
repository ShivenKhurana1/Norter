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

  let notes = [];
  let paperLibrary = [];
  let citationHistory = [];

  // Load notes, theme, paper library, and citation history
  chrome.storage.local.get(['notes', 'darkMode', 'paperLibrary', 'citationHistory'], (result) => {
    notes = result.notes || [];
    paperLibrary = result.paperLibrary || [];
    citationHistory = result.citationHistory || [];
    if (result.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    renderNotes();
    renderPaperLibrary();
    updateYearFilter();
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

  function renderPaperLibrary() {
    const searchTerm = librarySearch.value.toLowerCase();
    const yearFilter = libraryYearFilter.value;

    let filteredPapers = paperLibrary.filter(paper => {
      const matchesSearch = paper.title.toLowerCase().includes(searchTerm) ||
        paper.authors.some(a => a.toLowerCase().includes(searchTerm)) ||
        paper.journal.toLowerCase().includes(searchTerm);
      const matchesYear = !yearFilter || paper.year === yearFilter;
      return matchesSearch && matchesYear;
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
    div.className = 'paper-item';
    div.innerHTML = `
      <div class="paper-item-title">${paper.title}</div>
      <div class="paper-item-meta">
        <span class="paper-item-authors">${paper.authors.slice(0, 2).join(', ')}${paper.authors.length > 2 ? ' et al.' : ''}</span>
        <span class="paper-item-journal">${paper.journal} (${paper.year})</span>
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

  librarySearch.addEventListener('input', renderPaperLibrary);
  libraryYearFilter.addEventListener('change', renderPaperLibrary);

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
    paperAbstract.textContent = paper.abstract ? paper.abstract.substring(0, 300) + (paper.abstract.length > 300 ? '...' : '') : '';
    paperAbstract.style.display = paper.abstract ? 'block' : 'none';
  }

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
    saveToLibrary(currentPaper);
  });

  function saveToLibrary(paper) {
    const exists = paperLibrary.find(p => p.doi === paper.doi);
    if (exists) {
      showToast('Paper already in library');
      return;
    }
    
    paperLibrary.unshift({
      ...paper,
      addedAt: Date.now()
    });
    savePaperLibrary();
    renderPaperLibrary();
    updateYearFilter();
    showToast('Paper added to library');
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

  // Initialize research assistant
  detectPaperFromTab();
});