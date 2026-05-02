#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{State, Manager};
use serde::{Deserialize, Serialize};
use sqlx::Row;

mod database;
use database::Db;

pub struct AppState {
    pub db: Db,
}

// Note types
#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub folder: String,
    pub tags: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: String,
    pub folder: String,
    pub tags: Vec<String>,
}

// Task types
#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub text: String,
    pub due_date: Option<i64>,
    pub completed: bool,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub text: String,
    pub due_date: Option<i64>,
}

// Paper types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Paper {
    pub id: i64,
    pub title: String,
    pub authors: String,
    pub year: Option<String>,
    pub doi: Option<String>,
    pub journal: Option<String>,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub personal_note: String,
    pub added_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaperRequest {
    pub title: String,
    pub authors: String,
    pub year: Option<String>,
    pub doi: Option<String>,
    pub journal: Option<String>,
}

// Commands
#[tauri::command]
async fn get_notes(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<Note>, String> {
    let state = state.lock().await;
    let rows = sqlx::query("SELECT * FROM notes ORDER BY updated_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    
    let notes = rows.iter().map(|row| Note {
        id: row.get("id"),
        title: row.get("title"),
        content: row.get("content"),
        folder: row.get("folder"),
        tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();
    
    Ok(notes)
}

#[tauri::command]
async fn create_note(state: State<'_, Arc<Mutex<AppState>>>, req: CreateNoteRequest) -> Result<Note, String> {
    let state = state.lock().await;
    let now = chrono::Utc::now().timestamp();
    
    let id = sqlx::query(
        "INSERT INTO notes (title, content, folder, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&req.title)
    .bind(&req.content)
    .bind(&req.folder)
    .bind(serde_json::to_string(&req.tags).unwrap())
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();
    
    Ok(Note {
        id,
        title: req.title,
        content: req.content,
        folder: req.folder,
        tags: req.tags,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
async fn update_note(state: State<'_, Arc<Mutex<AppState>>>, id: i64, req: CreateNoteRequest) -> Result<(), String> {
    let state = state.lock().await;
    let now = chrono::Utc::now().timestamp();
    
    sqlx::query(
        "UPDATE notes SET title = ?, content = ?, folder = ?, tags = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&req.title)
    .bind(&req.content)
    .bind(&req.folder)
    .bind(serde_json::to_string(&req.tags).unwrap())
    .bind(now)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn delete_note(state: State<'_, Arc<Mutex<AppState>>>, id: i64) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("DELETE FROM notes WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn search_notes(state: State<'_, Arc<Mutex<AppState>>>, query: String) -> Result<Vec<Note>, String> {
    let state = state.lock().await;
    let search = format!("%{}%", query);
    
    let rows = sqlx::query(
        "SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC"
    )
    .bind(&search)
    .bind(&search)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    let notes = rows.iter().map(|row| Note {
        id: row.get("id"),
        title: row.get("title"),
        content: row.get("content"),
        folder: row.get("folder"),
        tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect();
    
    Ok(notes)
}

#[tauri::command]
async fn get_tasks(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<Task>, String> {
    let state = state.lock().await;
    let rows = sqlx::query("SELECT * FROM tasks ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    
    let tasks = rows.iter().map(|row| Task {
        id: row.get("id"),
        text: row.get("text"),
        due_date: row.get("due_date"),
        completed: row.get("completed"),
        created_at: row.get("created_at"),
    }).collect();
    
    Ok(tasks)
}

#[tauri::command]
async fn create_task(state: State<'_, Arc<Mutex<AppState>>>, req: CreateTaskRequest) -> Result<Task, String> {
    let state = state.lock().await;
    let now = chrono::Utc::now().timestamp();
    
    let id = sqlx::query(
        "INSERT INTO tasks (text, due_date, completed, created_at) VALUES (?, ?, 0, ?)"
    )
    .bind(&req.text)
    .bind(req.due_date)
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();
    
    Ok(Task {
        id,
        text: req.text,
        due_date: req.due_date,
        completed: false,
        created_at: now,
    })
}

#[tauri::command]
async fn toggle_task(state: State<'_, Arc<Mutex<AppState>>>, id: i64, completed: bool) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("UPDATE tasks SET completed = ? WHERE id = ?")
        .bind(completed)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_task(state: State<'_, Arc<Mutex<AppState>>>, id: i64) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_papers(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<Paper>, String> {
    let state = state.lock().await;
    let rows = sqlx::query("SELECT * FROM papers ORDER BY added_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    
    let papers = rows.iter().map(|row| Paper {
        id: row.get("id"),
        title: row.get("title"),
        authors: row.get("authors"),
        year: row.get("year"),
        doi: row.get("doi"),
        journal: row.get("journal"),
        tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
        favorite: row.get("favorite"),
        personal_note: row.get("personal_note"),
        added_at: row.get("added_at"),
    }).collect();
    
    Ok(papers)
}

#[tauri::command]
async fn create_paper(state: State<'_, Arc<Mutex<AppState>>>, req: CreatePaperRequest) -> Result<Paper, String> {
    let state = state.lock().await;
    let now = chrono::Utc::now().timestamp();
    
    let id = sqlx::query(
        "INSERT INTO papers (title, authors, year, doi, journal, tags, favorite, personal_note, added_at) 
         VALUES (?, ?, ?, ?, ?, ?, 0, '', ?)"
    )
    .bind(&req.title)
    .bind(&req.authors)
    .bind(&req.year)
    .bind(&req.doi)
    .bind(&req.journal)
    .bind("[]")
    .bind(now)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();
    
    Ok(Paper {
        id,
        title: req.title,
        authors: req.authors,
        year: req.year,
        doi: req.doi,
        journal: req.journal,
        tags: vec![],
        favorite: false,
        personal_note: String::new(),
        added_at: now,
    })
}

#[tauri::command]
async fn delete_paper(state: State<'_, Arc<Mutex<AppState>>>, id: i64) -> Result<(), String> {
    let state = state.lock().await;
    sqlx::query("DELETE FROM papers WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn check_duplicate_paper(state: State<'_, Arc<Mutex<AppState>>>, doi: Option<String>, title: String) -> Result<Option<Paper>, String> {
    let state = state.lock().await;
    
    if let Some(ref d) = doi {
        let row = sqlx::query("SELECT * FROM papers WHERE doi = ?")
            .bind(d)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?;
            
        if let Some(row) = row {
            return Ok(Some(Paper {
                id: row.get("id"),
                title: row.get("title"),
                authors: row.get("authors"),
                year: row.get("year"),
                doi: row.get("doi"),
                journal: row.get("journal"),
                tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
                favorite: row.get("favorite"),
                personal_note: row.get("personal_note"),
                added_at: row.get("added_at"),
            }));
        }
    }
    
    let row = sqlx::query("SELECT * FROM papers WHERE LOWER(title) = LOWER(?)")
        .bind(&title)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;
        
    Ok(row.map(|r| Paper {
        id: r.get("id"),
        title: r.get("title"),
        authors: r.get("authors"),
        year: r.get("year"),
        doi: r.get("doi"),
        journal: r.get("journal"),
        tags: serde_json::from_str(&r.get::<String, _>("tags")).unwrap_or_default(),
        favorite: r.get("favorite"),
        personal_note: r.get("personal_note"),
        added_at: r.get("added_at"),
    }))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                let db = database::init_db(app.handle()).await.unwrap();
                app.manage(Arc::new(Mutex::new(AppState { db })));
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_notes,
            create_note,
            update_note,
            delete_note,
            search_notes,
            get_tasks,
            create_task,
            toggle_task,
            delete_task,
            get_papers,
            create_paper,
            delete_paper,
            check_duplicate_paper,
            // Search & Intelligence
            fts_search_notes,
            fts_search_papers,
            trigram_search_notes,
            semantic_search_notes,
            semantic_search_papers,
            set_note_embedding,
            set_paper_embedding,
            auto_tag_note,
            suggest_tags,
            global_search,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Helper: Cosine Similarity ──

fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
    if a.len() != b.len() || a.is_empty() { return 0.0; }
    let dot: f64 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let mag_a: f64 = a.iter().map(|x| x * x).sum::<f64>().sqrt();
    let mag_b: f64 = b.iter().map(|x| x * x).sum::<f64>().sqrt();
    if mag_a == 0.0 || mag_b == 0.0 { return 0.0; }
    dot / (mag_a * mag_b)
}

// ── Helper: Keyword Extraction (TF-based) ──

fn extract_keywords(text: &str, max: usize) -> Vec<String> {
    let stop_words = [
        "the","a","an","and","or","but","in","on","at","to","for","of","with","by",
        "from","is","it","that","this","was","are","be","has","have","had","not","they",
        "we","you","he","she","its","my","your","our","their","will","would","can","could",
        "should","may","might","do","did","does","been","being","if","then","than","so",
        "as","up","out","no","just","about","also","into","over","after","all","some",
        "any","each","which","when","where","who","what","how","why","more","most","other",
        "very","much","many","such","only","own","same","still","even","back","well",
    ];
    
    let lower = text.to_lowercase();
    let words: Vec<&str> = lower
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() > 3 && !stop_words.contains(w))
        .collect();
    
    let mut freq: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    for w in &words {
        *freq.entry(w).or_insert(0) += 1;
    }
    
    let mut sorted: Vec<_> = freq.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    sorted.truncate(max);
    sorted.into_iter().map(|(w, _)| w.to_string()).collect()
}

// ── Search & Intelligence Commands ──

/// FTS5 full-text search across notes (ranked by relevance)
#[tauri::command]
async fn fts_search_notes(state: State<'_, Arc<Mutex<AppState>>>, query: String) -> Result<Vec<Note>, String> {
    let state = state.lock().await;
    let rows = sqlx::query(
        "SELECT n.* FROM notes n
         JOIN notes_fts fts ON fts.rowid = n.id
         WHERE notes_fts MATCH ?
         ORDER BY rank LIMIT 50"
    )
    .bind(&query)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(rows.iter().map(|row| Note {
        id: row.get("id"),
        title: row.get("title"),
        content: row.get("content"),
        folder: row.get("folder"),
        tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect())
}

/// FTS5 full-text search across papers
#[tauri::command]
async fn fts_search_papers(state: State<'_, Arc<Mutex<AppState>>>, query: String) -> Result<Vec<Paper>, String> {
    let state = state.lock().await;
    let rows = sqlx::query(
        "SELECT p.* FROM papers p
         JOIN papers_fts fts ON fts.rowid = p.id
         WHERE papers_fts MATCH ?
         ORDER BY rank LIMIT 50"
    )
    .bind(&query)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(rows.iter().map(|row| Paper {
        id: row.get("id"),
        title: row.get("title"),
        authors: row.get("authors"),
        year: row.get("year"),
        doi: row.get("doi"),
        journal: row.get("journal"),
        tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
        favorite: row.get("favorite"),
        personal_note: row.get("personal_note"),
        added_at: row.get("added_at"),
    }).collect())
}

/// Trigram substring search — finds partial word matches
#[tauri::command]
async fn trigram_search_notes(state: State<'_, Arc<Mutex<AppState>>>, query: String) -> Result<Vec<Note>, String> {
    if query.len() < 3 {
        return search_notes(state, query).await;
    }
    let state = state.lock().await;
    let rows = sqlx::query(
        "SELECT n.* FROM notes n
         JOIN notes_trigram trg ON trg.rowid = n.id
         WHERE notes_trigram MATCH ?
         ORDER BY rank LIMIT 50"
    )
    .bind(&query)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(rows.iter().map(|row| Note {
        id: row.get("id"),
        title: row.get("title"),
        content: row.get("content"),
        folder: row.get("folder"),
        tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect())
}

/// Semantic search using cosine similarity on stored embeddings
#[tauri::command]
async fn semantic_search_notes(state: State<'_, Arc<Mutex<AppState>>>, query_embedding: Vec<f64>, limit: Option<i64>) -> Result<Vec<Note>, String> {
    let state = state.lock().await;
    let limit = limit.unwrap_or(20);
    
    let rows = sqlx::query("SELECT * FROM notes WHERE embedding IS NOT NULL")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut scored: Vec<(f64, Note)> = rows.iter().filter_map(|row| {
        let emb_str: String = row.get("embedding");
        let stored: Vec<f64> = serde_json::from_str(&emb_str).ok()?;
        let note = Note {
            id: row.get("id"),
            title: row.get("title"),
            content: row.get("content"),
            folder: row.get("folder"),
            tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        };
        Some((cosine_similarity(&query_embedding, &stored), note))
    }).collect();
    
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit as usize);
    Ok(scored.into_iter().map(|(_, n)| n).collect())
}

/// Semantic search for papers
#[tauri::command]
async fn semantic_search_papers(state: State<'_, Arc<Mutex<AppState>>>, query_embedding: Vec<f64>, limit: Option<i64>) -> Result<Vec<Paper>, String> {
    let state = state.lock().await;
    let limit = limit.unwrap_or(20);
    
    let rows = sqlx::query("SELECT * FROM papers WHERE embedding IS NOT NULL")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    
    let mut scored: Vec<(f64, Paper)> = rows.iter().filter_map(|row| {
        let emb_str: String = row.get("embedding");
        let stored: Vec<f64> = serde_json::from_str(&emb_str).ok()?;
        let paper = Paper {
            id: row.get("id"),
            title: row.get("title"),
            authors: row.get("authors"),
            year: row.get("year"),
            doi: row.get("doi"),
            journal: row.get("journal"),
            tags: serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default(),
            favorite: row.get("favorite"),
            personal_note: row.get("personal_note"),
            added_at: row.get("added_at"),
        };
        Some((cosine_similarity(&query_embedding, &stored), paper))
    }).collect();
    
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit as usize);
    Ok(scored.into_iter().map(|(_, p)| p).collect())
}

/// Store embedding for a note
#[tauri::command]
async fn set_note_embedding(state: State<'_, Arc<Mutex<AppState>>>, id: i64, embedding: Vec<f64>) -> Result<(), String> {
    let state = state.lock().await;
    let emb_json = serde_json::to_string(&embedding).map_err(|e| e.to_string())?;
    sqlx::query("UPDATE notes SET embedding = ? WHERE id = ?")
        .bind(&emb_json).bind(id)
        .execute(&state.db).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Store embedding for a paper
#[tauri::command]
async fn set_paper_embedding(state: State<'_, Arc<Mutex<AppState>>>, id: i64, embedding: Vec<f64>) -> Result<(), String> {
    let state = state.lock().await;
    let emb_json = serde_json::to_string(&embedding).map_err(|e| e.to_string())?;
    sqlx::query("UPDATE papers SET embedding = ? WHERE id = ?")
        .bind(&emb_json).bind(id)
        .execute(&state.db).await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Auto-tag: extract keywords from note and apply as tags
#[tauri::command]
async fn auto_tag_note(state: State<'_, Arc<Mutex<AppState>>>, id: i64, max_tags: Option<usize>) -> Result<Vec<String>, String> {
    let state = state.lock().await;
    let max_tags = max_tags.unwrap_or(5);
    
    let row = sqlx::query("SELECT title, content, tags FROM notes WHERE id = ?")
        .bind(id).fetch_optional(&state.db).await.map_err(|e| e.to_string())?
        .ok_or("Note not found")?;
    
    let title: String = row.get("title");
    let content: String = row.get("content");
    let keywords = extract_keywords(&format!("{} {}", title, content), max_tags);
    
    let mut tags: Vec<String> = serde_json::from_str(&row.get::<String, _>("tags")).unwrap_or_default();
    for kw in &keywords {
        if !tags.contains(kw) { tags.push(kw.clone()); }
    }
    
    sqlx::query("UPDATE notes SET tags = ? WHERE id = ?")
        .bind(serde_json::to_string(&tags).unwrap()).bind(id)
        .execute(&state.db).await.map_err(|e| e.to_string())?;
    
    Ok(keywords)
}

/// Suggest tags for text (preview only, no save)
#[tauri::command]
async fn suggest_tags(state: State<'_, Arc<Mutex<AppState>>>, text: String, max_tags: Option<usize>) -> Result<Vec<String>, String> {
    let _state = state.lock().await;
    Ok(extract_keywords(&text, max_tags.unwrap_or(5)))
}

/// Global search across all entity types
#[tauri::command]
async fn global_search(state: State<'_, Arc<Mutex<AppState>>>, query: String) -> Result<serde_json::Value, String> {
    let state = state.lock().await;
    let like = format!("%{}%", query);
    
    let notes = sqlx::query("SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? LIMIT 20")
        .bind(&like).bind(&like)
        .fetch_all(&state.db).await.map_err(|e| e.to_string())?;
    
    let papers = sqlx::query("SELECT * FROM papers WHERE title LIKE ? OR authors LIKE ? LIMIT 20")
        .bind(&like).bind(&like)
        .fetch_all(&state.db).await.map_err(|e| e.to_string())?;
    
    let tasks = sqlx::query("SELECT * FROM tasks WHERE text LIKE ? LIMIT 20")
        .bind(&like)
        .fetch_all(&state.db).await.map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "notes": notes.iter().map(|r| serde_json::json!({
            "id": r.get::<i64, _>("id"),
            "title": r.get::<String, _>("title"),
            "type": "note"
        })).collect::<Vec<_>>(),
        "papers": papers.iter().map(|r| serde_json::json!({
            "id": r.get::<i64, _>("id"),
            "title": r.get::<String, _>("title"),
            "type": "paper"
        })).collect::<Vec<_>>(),
        "tasks": tasks.iter().map(|r| serde_json::json!({
            "id": r.get::<i64, _>("id"),
            "title": r.get::<String, _>("text"),
            "type": "task"
        })).collect::<Vec<_>>(),
    }))
}