// Shared persistence for the small JSON stores under ~/.chappie
// (notes.json / memory.json / reminders.json).
//
// These files hold things the user cannot regenerate — long-term memory,
// voice memos, reminders — so the rules here are about never losing them:
//
// - A file that exists but can't be parsed is moved aside to
//   `<name>.corrupt-<timestamp>.json` before the store starts empty, so the
//   next write can't overwrite the only copy. If the move fails, writes are
//   blocked for the rest of the session instead.
// - A file that can't be read at all (permissions, I/O error) or that was
//   written by a newer app version blocks writes too: we'd rather refuse a
//   save than clobber data we couldn't see.
// - Writes go to a temp file in the same directory, are fsynced, then
//   renamed over the target, so a crash or full disk mid-write leaves the
//   previous file intact.
//
// On-disk format: `{"version": N, "entries": [...]}`. Files written before
// the envelope existed are a bare JSON array and still load (treated as
// version 0); the next save upgrades them. When adding a field to an entry
// type, give it `#[serde(default)]` so older files stay readable — bump
// `CURRENT_VERSION` only for changes that defaults can't express.

use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub const CURRENT_VERSION: u32 = 1;

#[derive(Serialize)]
struct Envelope<'a, T> {
    version: u32,
    entries: &'a [T],
}

/// What `load_file` found. `write_block` is `Some(reason)` when saving
/// would risk destroying data we couldn't load.
pub struct Loaded<T> {
    pub entries: Vec<T>,
    pub write_block: Option<String>,
}

/// A store file under ~/.chappie plus the session's write-block state.
pub struct Store {
    file_name: &'static str,
    tag: &'static str,
    write_block: Mutex<Option<String>>,
}

impl Store {
    pub const fn new(file_name: &'static str, tag: &'static str) -> Self {
        Self {
            file_name,
            tag,
            write_block: Mutex::new(None),
        }
    }

    fn path(&self) -> Option<PathBuf> {
        let mut p = dirs::home_dir()?;
        p.push(".chappie");
        let _ = fs::create_dir_all(&p);
        p.push(self.file_name);
        Some(p)
    }

    /// Load the store. Never fails: problems are logged, the bad file is
    /// backed up when possible, and writes are blocked when it isn't.
    pub fn load<T: DeserializeOwned>(&self) -> Vec<T> {
        let Some(path) = self.path() else {
            *self.write_block.lock().unwrap() = Some("home directory not found".into());
            return Vec::new();
        };
        let loaded = load_file(&path, self.tag);
        *self.write_block.lock().unwrap() = loaded.write_block;
        loaded.entries
    }

    pub fn save<T: Serialize>(&self, entries: &[T]) -> Result<(), String> {
        if let Some(reason) = self.write_block.lock().unwrap().as_ref() {
            return Err(format!(
                "{} is not being saved to protect existing data: {reason}",
                self.file_name
            ));
        }
        let path = self
            .path()
            .ok_or_else(|| "home directory not found".to_string())?;
        save_file(&path, entries).map_err(|e| {
            let msg = format!("failed to save {}: {e}", path.display());
            eprintln!("[{}] {msg}", self.tag);
            msg
        })
    }
}

pub fn load_file<T: DeserializeOwned>(path: &Path, tag: &str) -> Loaded<T> {
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            return Loaded {
                entries: Vec::new(),
                write_block: None,
            };
        }
        Err(e) => {
            let msg = format!("could not read {}: {e}", path.display());
            eprintln!("[{tag}] {msg}; saving disabled for this session");
            return Loaded {
                entries: Vec::new(),
                write_block: Some(msg),
            };
        }
    };
    match parse(&bytes) {
        Ok(Parsed::Entries(entries)) => Loaded {
            entries,
            write_block: None,
        },
        Ok(Parsed::TooNew(v)) => {
            let msg = format!(
                "{} was written by a newer version (format {v}, this build reads up to {CURRENT_VERSION})",
                path.display()
            );
            eprintln!("[{tag}] {msg}; saving disabled for this session");
            Loaded {
                entries: Vec::new(),
                write_block: Some(msg),
            }
        }
        Err(parse_err) => match back_up_corrupt(path) {
            Ok(backup) => {
                eprintln!(
                    "[{tag}] failed to parse {} ({parse_err}); moved it to {} and starting empty",
                    path.display(),
                    backup.display()
                );
                Loaded {
                    entries: Vec::new(),
                    write_block: None,
                }
            }
            Err(e) => {
                let msg = format!(
                    "{} is unreadable ({parse_err}) and could not be backed up ({e})",
                    path.display()
                );
                eprintln!("[{tag}] {msg}; saving disabled for this session");
                Loaded {
                    entries: Vec::new(),
                    write_block: Some(msg),
                }
            }
        },
    }
}

enum Parsed<T> {
    Entries(Vec<T>),
    TooNew(u64),
}

fn parse<T: DeserializeOwned>(bytes: &[u8]) -> Result<Parsed<T>, serde_json::Error> {
    let value: serde_json::Value = serde_json::from_slice(bytes)?;
    if value.is_array() {
        // Pre-envelope format: a bare array.
        return serde_json::from_value(value).map(Parsed::Entries);
    }
    let version = value.get("version").and_then(|v| v.as_u64()).unwrap_or(0);
    if version > u64::from(CURRENT_VERSION) {
        return Ok(Parsed::TooNew(version));
    }
    let entries = value
        .get("entries")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    serde_json::from_value(entries).map(Parsed::Entries)
}

fn back_up_corrupt(path: &Path) -> io::Result<PathBuf> {
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("store");
    let ts = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let mut backup = dir.join(format!("{stem}.corrupt-{ts}.json"));
    let mut n = 1;
    while backup.exists() {
        backup = dir.join(format!("{stem}.corrupt-{ts}-{n}.json"));
        n += 1;
    }
    fs::rename(path, &backup)?;
    Ok(backup)
}

pub fn save_file<T: Serialize>(path: &Path, entries: &[T]) -> io::Result<()> {
    let json = serde_json::to_vec_pretty(&Envelope {
        version: CURRENT_VERSION,
        entries,
    })
    .map_err(io::Error::other)?;
    write_atomic(path, |f| f.write_all(&json))
}

/// Write via a temp file in the same directory, fsync, then rename over
/// `path`. On any error the temp file is removed and `path` is untouched.
fn write_atomic(path: &Path, write: impl FnOnce(&mut File) -> io::Result<()>) -> io::Result<()> {
    let dir = path.parent().unwrap_or_else(|| Path::new("."));
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("store.json");
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let tmp = dir.join(format!(".{name}.tmp-{}-{nanos}", std::process::id()));
    let result = (|| {
        let mut f = File::create(&tmp)?;
        write(&mut f)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
        return result;
    }
    // Persist the rename itself. Best-effort: not every platform lets you
    // open a directory for syncing.
    #[cfg(unix)]
    if let Ok(d) = File::open(dir) {
        let _ = d.sync_all();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
    struct Item {
        id: u32,
        text: String,
        #[serde(default)]
        added_later: Option<String>,
    }

    fn temp_dir(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "chappie-json-store-{name}-{}-{nanos}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn item(id: u32) -> Item {
        Item {
            id,
            text: format!("item {id}"),
            added_later: None,
        }
    }

    #[test]
    fn missing_file_loads_empty_and_writable() {
        let dir = temp_dir("missing");
        let loaded: Loaded<Item> = load_file(&dir.join("x.json"), "test");
        assert!(loaded.entries.is_empty());
        assert!(loaded.write_block.is_none());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn round_trip_writes_versioned_envelope() {
        let dir = temp_dir("roundtrip");
        let path = dir.join("x.json");
        save_file(&path, &[item(1), item(2)]).unwrap();
        let raw: serde_json::Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(raw["version"], CURRENT_VERSION);
        let loaded: Loaded<Item> = load_file(&path, "test");
        assert_eq!(loaded.entries, vec![item(1), item(2)]);
        assert!(loaded.write_block.is_none());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn legacy_bare_array_without_new_fields_loads() {
        let dir = temp_dir("legacy");
        let path = dir.join("x.json");
        fs::write(&path, r#"[{"id":7,"text":"old"}]"#).unwrap();
        let loaded: Loaded<Item> = load_file(&path, "test");
        assert_eq!(
            loaded.entries,
            vec![Item {
                id: 7,
                text: "old".into(),
                added_later: None
            }]
        );
        assert!(loaded.write_block.is_none());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn corrupt_file_is_backed_up_not_lost() {
        let dir = temp_dir("corrupt");
        let path = dir.join("notes.json");
        let garbage = b"{ this is not json";
        fs::write(&path, garbage).unwrap();

        let loaded: Loaded<Item> = load_file(&path, "test");
        assert!(loaded.entries.is_empty());
        assert!(loaded.write_block.is_none());
        assert!(!path.exists(), "corrupt file should have been moved aside");

        let backups: Vec<PathBuf> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("notes.corrupt-")
            })
            .collect();
        assert_eq!(backups.len(), 1);
        assert_eq!(fs::read(&backups[0]).unwrap(), garbage);

        // A later save must not touch the backup.
        save_file(&path, &[item(1)]).unwrap();
        assert_eq!(fs::read(&backups[0]).unwrap(), garbage);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn wrong_shape_is_treated_as_corrupt() {
        let dir = temp_dir("shape");
        let path = dir.join("x.json");
        fs::write(&path, r#"[{"id":"not a number"}]"#).unwrap();
        let loaded: Loaded<Item> = load_file(&path, "test");
        assert!(loaded.entries.is_empty());
        assert!(!path.exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn newer_version_blocks_writes_and_keeps_file() {
        let dir = temp_dir("newer");
        let path = dir.join("x.json");
        let body = format!(r#"{{"version":{},"entries":[]}}"#, CURRENT_VERSION + 1);
        fs::write(&path, &body).unwrap();
        let loaded: Loaded<Item> = load_file(&path, "test");
        assert!(loaded.write_block.is_some());
        assert_eq!(fs::read_to_string(&path).unwrap(), body);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn failed_atomic_write_leaves_old_file_intact() {
        let dir = temp_dir("atomic");
        let path = dir.join("x.json");
        save_file(&path, &[item(1)]).unwrap();
        let before = fs::read(&path).unwrap();

        let err = write_atomic(&path, |f| {
            f.write_all(b"[{\"id\": 2, \"te")?;
            Err(io::Error::other("disk full"))
        });
        assert!(err.is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        let leftovers = fs::read_dir(&dir).unwrap().count();
        assert_eq!(leftovers, 1, "temp file should be cleaned up");
        fs::remove_dir_all(dir).unwrap();
    }
}
