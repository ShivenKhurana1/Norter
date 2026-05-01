// Content script for page interaction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    const content = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText.substring(0, 5000)
    };
    sendResponse(content);
  }
});

// Track active element
let activeInput = null;
let citationPicker = null;

// Listen for focus on text inputs
document.addEventListener('focusin', (e) => {
  if (isTextInput(e.target)) {
    activeInput = e.target;
  }
});

document.addEventListener('focusout', (e) => {
  if (!isTextInput(e.target)) {
    // Don't clear immediately to allow picker interaction
    setTimeout(() => {
      if (!citationPicker?.matches(':hover')) {
        activeInput = null;
      }
    }, 200);
  }
});

function isTextInput(element) {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  const type = element.type?.toLowerCase();
  
  return (
    tag === 'textarea' ||
    tag === 'input' && (type === 'text' || type === 'search') ||
    element.contentEditable === 'true' ||
    element.classList.contains('ql-editor') || // Quill editor
    element.classList.contains('ProseMirror') || // ProseMirror
    element.classList.contains('ck-content') // CKEditor
  );
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openCitationPicker') {
    if (!activeInput) {
      showNotification('Please focus a text field first');
      return;
    }
    openCitationPicker(activeInput);
  }
});

// Create picker UI
function createCitationPicker() {
  const picker = document.createElement('div');
  picker.className = 'norter-citation-picker';
  picker.innerHTML = `
    <div class="norter-picker-header">
      <h4>Insert Citation</h4>
    </div>
    <input type="text" class="norter-picker-search" placeholder="Search your papers..." autocomplete="off">
    <div class="norter-picker-results"></div>
    <div class="norter-picker-footer">
      <select class="norter-picker-format">
        <option value="apa">APA</option>
        <option value="mla">MLA</option>
        <option value="chicago">Chicago</option>
        <option value="ieee">IEEE</option>
        <option value="bibtex">BibTeX</option>
      </select>
      <span class="norter-picker-hint">↑↓ Navigate | Enter Insert | Esc Close</span>
    </div>
  `;
  
  document.body.appendChild(picker);
  return picker;
}

function openCitationPicker(targetInput) {
  if (!citationPicker) {
    citationPicker = createCitationPicker();
  }
  
  // Get input position
  const rect = targetInput.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  
  // Position picker below input
  let top = rect.bottom + scrollY + 5;
  let left = rect.left + scrollX;
  
  // Adjust if off-screen
  if (left + 400 > window.innerWidth) {
    left = window.innerWidth - 420;
  }
  if (top + 350 > window.innerHeight + scrollY) {
    top = rect.top + scrollY - 360; // Show above
  }
  
  citationPicker.style.top = `${top}px`;
  citationPicker.style.left = `${left}px`;
  citationPicker.style.display = 'block';
  
  const searchInput = citationPicker.querySelector('.norter-picker-search');
  const resultsDiv = citationPicker.querySelector('.norter-picker-results');
  const formatSelect = citationPicker.querySelector('.norter-picker-format');
  
  // Load papers from storage
  chrome.storage.local.get(['paperLibrary'], (result) => {
    const papers = result.paperLibrary || [];
    renderResults(papers, resultsDiv, targetInput, formatSelect.value);
  });
  
  // Focus search
  searchInput.value = '';
  searchInput.focus();
  
  // Search handler
  let selectedIndex = -1;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    chrome.storage.local.get(['paperLibrary'], (result) => {
      const papers = result.paperLibrary || [];
      const filtered = papers.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.authors?.toLowerCase().includes(query) ||
        p.doi?.toLowerCase().includes(query)
      );
      selectedIndex = -1;
      renderResults(filtered, resultsDiv, targetInput, formatSelect.value);
    });
  });
  
  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const items = resultsDiv.querySelectorAll('.norter-picker-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items, selectedIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].click();
      }
    } else if (e.key === 'Escape') {
      closePicker();
    }
  });
  
  // Format change handler
  formatSelect.addEventListener('change', () => {
    searchInput.dispatchEvent(new Event('input'));
  });
  
  // Click outside to close
  document.addEventListener('click', clickOutsideHandler);
}

function clickOutsideHandler(e) {
  if (citationPicker && !citationPicker.contains(e.target) && !e.target.matches(isTextInput)) {
    closePicker();
  }
}

function closePicker() {
  if (citationPicker) {
    citationPicker.style.display = 'none';
    document.removeEventListener('click', clickOutsideHandler);
  }
}

function updateSelection(items, index) {
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === index);
  });
  if (items[index]) {
    items[index].scrollIntoView({ block: 'nearest' });
  }
}

function renderResults(papers, container, targetInput, format) {
  container.innerHTML = '';
  
  if (papers.length === 0) {
    container.innerHTML = '<div class="norter-picker-empty">No papers found</div>';
    return;
  }
  
  papers.forEach((paper, index) => {
    const item = document.createElement('div');
    item.className = 'norter-picker-item';
    item.innerHTML = `
      <div class="norter-picker-title">${escapeHtml(paper.title || 'Untitled')}</div>
      <div class="norter-picker-meta">${escapeHtml(paper.authors || 'Unknown')} • ${paper.year || 'n.d.'}</div>
    `;
    
    item.addEventListener('click', () => {
      insertCitation(paper, format, targetInput);
      closePicker();
    });
    
    container.appendChild(item);
  });
}

function insertCitation(paper, format, targetInput) {
  const citation = formatCitation(paper, format);
  
  if (targetInput.contentEditable === 'true') {
    // Rich text editor
    document.execCommand('insertText', false, citation);
  } else {
    // Regular input
    const start = targetInput.selectionStart || targetInput.value.length;
    const end = targetInput.selectionEnd || start;
    const value = targetInput.value;
    targetInput.value = value.substring(0, start) + citation + value.substring(end);
    targetInput.selectionStart = targetInput.selectionEnd = start + citation.length;
  }
  
  // Notify
  chrome.runtime.sendMessage({ action: 'citationInserted', paper: paper.title });
}

function formatCitation(paper, format) {
  const authors = paper.authors || 'Unknown';
  const year = paper.year || 'n.d.';
  const title = paper.title || 'Untitled';
  const journal = paper.journal || '';
  const doi = paper.doi || '';
  
  switch(format) {
    case 'apa':
      return `${authors} (${year}). ${title}. ${journal ? journal + '.' : ''}${doi ? ' https://doi.org/' + doi : ''}`;
    case 'mla':
      return `${authors}. "${title}." ${journal}, ${year}.`;
    case 'chicago':
      return `${authors}, "${title}," ${journal} (${year}).`;
    case 'ieee':
      const authorList = authors.split(',').map(a => a.trim().split(' ').pop()).join(', ');
      return `[1] ${authorList}, "${title}," ${journal}, ${year}.`;
    case 'bibtex':
      const citeKey = authors.split(',')[0].split(' ').pop().toLowerCase() + year;
      return `@article{${citeKey},\n  author = {${authors}},\n  title = {${title}},\n  journal = {${journal}},\n  year = {${year}},\n  doi = {${doi}}\n}`;
    default:
      return `${authors} (${year}). ${title}.`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message) {
  // Create temporary notification
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 9999999;
    font-family: system-ui, sans-serif;
    font-size: 14px;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// Initialize on load
console.log('Norter citation picker loaded');