use tauri_helper::auto_collect_command;

/// every secret lives in the OS credential store under this service. It is the service the
/// account logins were first saved under, so they keep working.
const SERVICE: &str = "glimmer";

fn entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

// credential-store blobs on Windows are capped at 2560 bytes and a password is stored as UTF-16,
// which would cap a secret at 1280 characters. Storing the raw bytes doubles that.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn keyring_set(key: String, secret: String) -> Result<(), String> {
    entry(&key)?
        .set_secret(secret.as_bytes())
        .map_err(|e| e.to_string())
}

/// the secret saved under `key`, or null when there is none
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn keyring_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_secret() {
        Ok(bytes) => String::from_utf8(bytes).map(Some).map_err(|e| e.to_string()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// deletes the secret saved under `key`. Deleting a secret that is not there is fine.
#[tauri::command]
#[specta::specta]
#[auto_collect_command]
pub fn keyring_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_secret_round_trips_and_can_be_deleted() {
        let key = "glimmer-test-keyring-round-trip".to_string();
        // longer than 1280 characters, which a UTF-16 password would not fit
        let secret = "x".repeat(2000);

        keyring_set(key.clone(), secret.clone()).unwrap();
        assert_eq!(keyring_get(key.clone()).unwrap(), Some(secret));

        keyring_delete(key.clone()).unwrap();
        assert_eq!(keyring_get(key.clone()).unwrap(), None);
        keyring_delete(key).unwrap();
    }
}
