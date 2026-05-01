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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
