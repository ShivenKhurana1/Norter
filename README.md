# Norter
My kewl amazing research assistant with features for note taking, citations, and productivity tools!!
- available as a chrome extension and a macOS app!

## Time to meet the FEATURESSS

### THE Notes
- Create, edit, and delete notes with title, content, folder, and tags
- Auto-tagging with TF-based keyword extraction
- u can do a full test search with FTS5
- Trigram substring search (WITH partial matches)
- Semantic search through embedding vectors + cosine similarity

### THE Tasks
- can add due dates and times
- as always you can mark tasks complete/incomplete

### LAST BUT NOT LEASTTT: Research & Papers
- can add papers manually or through the DOI lookup (CrossRef API)
- checks for dupes with DOI or title
- can generate cites in APA, MLA, Chicago, and BibTeX formats
- bibliography export to clipboard
- FTS5 search across paper titles, authors, and journals

---

## Chrome Extension

Located in `chrome extension/`.

### Installation
1. Open Chrome: `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked": select the `chrome extension` folder

### Tech Stack
- Manifest V3
- Chrome Storage API for persistence
- Context menus for in-page citation picking
- CrossRef, arXiv, Semantic Scholar APIs for DOI lookup
- Keyboard shortcut: `Cmd+Shift+C` to open citation picker

### Files
| File | Purpose |
|------|---------|
| `manifest.json` | extension config, permissions, commands |
| `popup.html` | has the main UI |
| `popup.js` | contains all the frontend logic |
| `background.js` | has all the service worker for context menus and alarms |
| `content.js` | has all the in-page citation injection logic |
| `styles.css` | styling stuff duh|

---

## macOS Desktop App

Located in `Norter-mac/desktop/`.

### Prerequisites
- [Rust](https://rustup.rs/) (stable)
- Node.js 18+
- macOS 12+

### Development
```bash
cd Norter-mac/desktop
npm install
npm run tauri dev
```

### Build
```bash
npm run tauri build
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Backend | Rust + Tauri v2 |
| Database | SQLite via `sqlx` (async) |
| Search | FTS5 + trigram indexes |
| Semantic | Embedding storage + cosine similarity |
| Plugins | global-shortcut, store, notification, fs, dialog, shell |

### Architecture
```
desktop/
├── src/                    # Frontend
│   ├── index.html          # all the UI structure
│   ├── main.js             # has the frontend logic & IPC calls
│   └── styles.css          # for styling
└── src-tauri/              # Rust backend YAY
    ├── src/
    │   ├── main.rs         # Tauri commands (CRUD + search)
    │   ├── lib.rs          # Data structures (Note, Task, Paper)
    │   └── database.rs     # SQLite init, FTS5 tables, triggers
    ├── Cargo.toml          # Rust dependencies
    └── tauri.conf.json     # Tauri configs
```

### Backend Commands

| Command | Description |
|---------|-------------|
| `get_notes` / `create_note` / `update_note` / `delete_note` | Note CRUD |
| `search_notes` | LIKE-based note search |
| `fts_search_notes` | FTS5 full-text search (ranked) |
| `fts_search_papers` | FTS5 paper search (ranked) |
| `trigram_search_notes` | Substring/partial match search |
| `semantic_search_notes` | Cosine similarity search on embeddings |
| `semantic_search_papers` | Semantic paper search |
| `set_note_embedding` / `set_paper_embedding` | Store embedding vectors |
| `auto_tag_note` | Extract keywords → apply as tags |
| `suggest_tags` | Preview keyword extraction |
| `global_search` | Search across notes, papers, tasks |
| `get_tasks` / `create_task` / `toggle_task` / `delete_task` | Task CRUD |
| `get_papers` / `create_paper` / `delete_paper` | Paper CRUD |
| `check_duplicate_paper` | Detect duplicates by DOI/title |

---

