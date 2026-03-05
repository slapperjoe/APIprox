use std::sync::Arc;
use tokio::sync::Mutex;
use crate::models::{FileWatch, WatcherEvent};

/// Manages file watch configurations and recent events.
#[derive(Debug, Default)]
pub struct FileWatcherService {
    pub watches: Vec<FileWatch>,
    pub events: Vec<WatcherEvent>,
}

pub type SharedFileWatcherService = Arc<Mutex<FileWatcherService>>;

pub fn new_shared() -> SharedFileWatcherService {
    Arc::new(Mutex::new(FileWatcherService::default()))
}

impl FileWatcherService {
    pub fn get_watches(&self) -> Vec<FileWatch> {
        self.watches.clone()
    }

    pub fn add_watch(&mut self, watch: FileWatch) {
        self.watches.push(watch);
    }

    pub fn update_watch(&mut self, id: &str, updated: FileWatch) -> bool {
        if let Some(w) = self.watches.iter_mut().find(|w| w.id == id) {
            *w = updated;
            true
        } else {
            false
        }
    }

    pub fn delete_watch(&mut self, id: &str) -> bool {
        let before = self.watches.len();
        self.watches.retain(|w| w.id != id);
        self.watches.len() != before
    }

    pub fn add_event(&mut self, event: WatcherEvent) {
        self.events.push(event);
        // Keep last 500 events
        if self.events.len() > 500 {
            self.events.drain(..self.events.len() - 500);
        }
    }

    pub fn get_events(&self, limit: Option<usize>) -> Vec<WatcherEvent> {
        let events = &self.events;
        match limit {
            Some(n) => events.iter().rev().take(n).rev().cloned().collect(),
            None => events.clone(),
        }
    }

    pub fn clear_events(&mut self) {
        self.events.clear();
    }
}
