const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/jarvis.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initialize(db);
  }
  return db;
}

function initialize(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      event_time TEXT,
      location TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// --- Reminders ---
function createReminder(text, scheduledAt) {
  const stmt = getDb().prepare(
    'INSERT INTO reminders (text, scheduled_at) VALUES (?, ?)'
  );
  return stmt.run(text, scheduledAt);
}

function getPendingReminders() {
  return getDb()
    .prepare("SELECT * FROM reminders WHERE sent = 0 AND scheduled_at <= datetime('now') ORDER BY scheduled_at ASC")
    .all();
}

function getAllReminders() {
  return getDb()
    .prepare("SELECT * FROM reminders WHERE sent = 0 ORDER BY scheduled_at ASC")
    .all();
}

function markReminderSent(id) {
  getDb().prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(id);
}

function deleteReminder(id) {
  getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id);
}

// --- Events ---
function createEvent(title, description, eventDate, eventTime, location) {
  const stmt = getDb().prepare(
    'INSERT INTO events (title, description, event_date, event_time, location) VALUES (?, ?, ?, ?, ?)'
  );
  return stmt.run(title, description || null, eventDate, eventTime || null, location || null);
}

function getUpcomingEvents(days = 30) {
  return getDb()
    .prepare(`
      SELECT * FROM events
      WHERE event_date >= date('now')
        AND event_date <= date('now', '+${days} days')
      ORDER BY event_date ASC, event_time ASC
    `)
    .all();
}

function getAllEvents() {
  return getDb()
    .prepare("SELECT * FROM events ORDER BY event_date ASC, event_time ASC")
    .all();
}

function deleteEvent(id) {
  getDb().prepare('DELETE FROM events WHERE id = ?').run(id);
}

// --- Ideas ---
function createIdea(title, content, tags) {
  const stmt = getDb().prepare(
    'INSERT INTO ideas (title, content, tags) VALUES (?, ?, ?)'
  );
  return stmt.run(title, content, tags || null);
}

function getIdeas(limit = 20) {
  return getDb()
    .prepare('SELECT * FROM ideas ORDER BY created_at DESC LIMIT ?')
    .all(limit);
}

function searchIdeas(query) {
  return getDb()
    .prepare("SELECT * FROM ideas WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY created_at DESC")
    .all(`%${query}%`, `%${query}%`, `%${query}%`);
}

function deleteIdea(id) {
  getDb().prepare('DELETE FROM ideas WHERE id = ?').run(id);
}

// --- Conversation history (last N messages for context) ---
function addMessage(role, content) {
  getDb().prepare('INSERT INTO conversation_history (role, content) VALUES (?, ?)').run(role, content);
  // Keep only last 50 messages
  getDb().prepare(`
    DELETE FROM conversation_history
    WHERE id NOT IN (
      SELECT id FROM conversation_history ORDER BY id DESC LIMIT 50
    )
  `).run();
}

function getRecentHistory(limit = 20) {
  const rows = getDb()
    .prepare('SELECT role, content FROM conversation_history ORDER BY id DESC LIMIT ?')
    .all(limit);
  return rows.reverse();
}

module.exports = {
  createReminder, getPendingReminders, getAllReminders, markReminderSent, deleteReminder,
  createEvent, getUpcomingEvents, getAllEvents, deleteEvent,
  createIdea, getIdeas, searchIdeas, deleteIdea,
  addMessage, getRecentHistory,
};
