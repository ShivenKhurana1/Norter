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
    
    // Enable WAL mode for better concurrent reads
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
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
            embedding TEXT,
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
            embedding TEXT,
            added_at INTEGER NOT NULL
        );
        "#
    )
    .execute(&pool)
    .await?;
    
    // FTS5 virtual tables for instant full-text search
    sqlx::query(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title, content, folder,
            content=notes,
            content_rowid=id,
            tokenize='porter unicode61'
        );
        "#
    )
    .execute(&pool)
    .await
    .ok(); // May already exist
    
    sqlx::query(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
            title, authors, journal,
            content=papers,
            content_rowid=id,
            tokenize='porter unicode61'
        );
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    // Trigram FTS5 index for substring matching on notes
    sqlx::query(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS notes_trigram USING fts5(
            title, content,
            content=notes,
            content_rowid=id,
            tokenize='trigram'
        );
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    // Keep FTS in sync with triggers
    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(rowid, title, content, folder) VALUES (new.id, new.title, new.content, new.folder);
            INSERT INTO notes_trigram(rowid, title, content) VALUES (new.id, new.title, new.content);
        END;
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content, folder) VALUES('delete', old.id, old.title, old.content, old.folder);
            INSERT INTO notes_trigram(notes_trigram, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
        END;
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            INSERT INTO notes_fts(notes_fts, rowid, title, content, folder) VALUES('delete', old.id, old.title, old.content, old.folder);
            INSERT INTO notes_fts(rowid, title, content, folder) VALUES (new.id, new.title, new.content, new.folder);
            INSERT INTO notes_trigram(notes_trigram, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
            INSERT INTO notes_trigram(rowid, title, content) VALUES (new.id, new.title, new.content);
        END;
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS papers_ai AFTER INSERT ON papers BEGIN
            INSERT INTO papers_fts(rowid, title, authors, journal) VALUES (new.id, new.title, new.authors, new.journal);
        END;
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS papers_ad AFTER DELETE ON papers BEGIN
            INSERT INTO papers_fts(papers_fts, rowid, title, authors, journal) VALUES('delete', old.id, old.title, old.authors, old.journal);
        END;
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS papers_au AFTER UPDATE ON papers BEGIN
            INSERT INTO papers_fts(papers_fts, rowid, title, authors, journal) VALUES('delete', old.id, old.title, old.authors, old.journal);
            INSERT INTO papers_fts(rowid, title, authors, journal) VALUES (new.id, new.title, new.authors, new.journal);
        END;
        "#
    )
    .execute(&pool)
    .await
    .ok();
    
    // Rebuild FTS indexes from existing data (safe to run repeatedly)
    sqlx::query("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("INSERT INTO notes_trigram(notes_trigram) VALUES('rebuild')")
        .execute(&pool)
        .await
        .ok();
    sqlx::query("INSERT INTO papers_fts(papers_fts) VALUES('rebuild')")
        .execute(&pool)
        .await
        .ok();
    
    Ok(pool)
}