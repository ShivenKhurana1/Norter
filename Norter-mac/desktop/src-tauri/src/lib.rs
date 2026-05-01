use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod database;
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
