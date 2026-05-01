use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use tauri::{AppHandle, Manager};

pub type Db = Pool<Sqlite>;

pub async fn init_db(app: &AppHandle) -> Result<Db, sqlx::Error> {
    let app_dir = app.path().app_data_dir().unwrap();
    std::fs::create_dir_all(&app_dir).unwrap();
    
    let db_path = app_dir.join("norter.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;
    
    // Create tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            folder TEXT DEFAULT '',
            tags TEXT DEFAULT '[]',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            due_date INTEGER,
            completed BOOLEAN NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS papers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            authors TEXT DEFAULT '',
            year TEXT,
            doi TEXT UNIQUE,
            journal TEXT,
            tags TEXT DEFAULT '[]',
            favorite BOOLEAN NOT NULL DEFAULT 0,
            personal_note TEXT DEFAULT '',
            added_at INTEGER NOT NULL
        );
        "#
    )
    .execute(&pool)
    .await?;
    
    Ok(pool)
}