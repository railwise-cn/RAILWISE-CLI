use std::time::{Duration, Instant};

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use tokio::task::JoinHandle;

use crate::{
    cli,
    cli::CommandChild,
    constants::{DEFAULT_SERVER_URL_KEY, SETTINGS_STORE, WSL_ENABLED_KEY},
};

#[derive(Clone, serde::Serialize, serde::Deserialize, specta::Type, Debug, Default)]
pub struct WslConfig {
    pub enabled: bool,
}

#[tauri::command]
#[specta::specta]
pub fn get_default_server_url(app: AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    let value = store.get(DEFAULT_SERVER_URL_KEY);
    match value {
        Some(v) => Ok(v.as_str().map(String::from)),
        None => Ok(None),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn set_default_server_url(app: AppHandle, url: Option<String>) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    match url {
        Some(u) => {
            store.set(DEFAULT_SERVER_URL_KEY, serde_json::Value::String(u));
        }
        None => {
            store.delete(DEFAULT_SERVER_URL_KEY);
        }
    }

    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn get_wsl_config(_app: AppHandle) -> Result<WslConfig, String> {
    // let store = app
    //     .store(SETTINGS_STORE)
    //     .map_err(|e| format!("Failed to open settings store: {}", e))?;

    // let enabled = store
    //     .get(WSL_ENABLED_KEY)
    //     .as_ref()
    //     .and_then(|v| v.as_bool())
    //     .unwrap_or(false);

    Ok(WslConfig { enabled: false })
}

#[tauri::command]
#[specta::specta]
pub fn set_wsl_config(app: AppHandle, config: WslConfig) -> Result<(), String> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| format!("Failed to open settings store: {}", e))?;

    store.set(WSL_ENABLED_KEY, serde_json::Value::Bool(config.enabled));

    store
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

pub async fn get_saved_server_url(app: &tauri::AppHandle) -> Option<String> {
    if let Some(url) = get_default_server_url(app.clone()).ok().flatten() {
        tracing::info!(%url, "Using desktop-specific custom URL");
        return Some(url);
    }

    // Do not spawn `railwise debug config` during desktop boot. In packaged builds
    // that can perform a full CLI config/provider load before the local server is
    // even started, making the UI think startup has hung.
    None
}

pub fn spawn_local_server(
    app: AppHandle,
    hostname: String,
    port: u32,
    password: String,
) -> (CommandChild, HealthCheck) {
    let (child, exit) = cli::serve(&app, &hostname, port, &password);

    let health_check = HealthCheck(tokio::spawn(async move {
        let url = format!("http://{hostname}:{port}");
        let timestamp = Instant::now();

        let ready = async {
            // Optimized health check with exponential backoff
            let mut interval = Duration::from_millis(50); // Start faster
            let max_interval = Duration::from_millis(500);

            loop {
                if check_health(&url, Some(&password)).await {
                    tracing::info!(elapsed = ?timestamp.elapsed(), "Server ready");
                    return Ok(());
                }

                tokio::time::sleep(interval).await;

                // Exponential backoff for less aggressive polling
                interval = std::cmp::min(interval * 2, max_interval);
            }
        };

        let terminated = async {
            match exit.await {
                Ok(payload) => Err(format!(
                    "Sidecar terminated before becoming healthy (code={:?} signal={:?})",
                    payload.code, payload.signal
                )),
                Err(_) => Err("Sidecar terminated before becoming healthy".to_string()),
            }
        };

        tokio::select! {
            res = ready => res,
            res = terminated => res,
        }
    }));

    (child, health_check)
}

pub struct HealthCheck(pub JoinHandle<Result<(), String>>);

pub async fn check_health(url: &str, password: Option<&str>) -> bool {
    let Ok(url) = reqwest::Url::parse(url) else {
        return false;
    };

    // Reduced timeout from 3s to 1s for faster failure detection
    let mut builder = reqwest::Client::builder().timeout(Duration::from_secs(1));

    if url_is_localhost(&url) {
        // Some environments set proxy variables (HTTP_PROXY/HTTPS_PROXY/ALL_PROXY) without
        // excluding loopback. reqwest respects these by default, which can prevent the desktop
        // app from reaching its own local sidecar server.
        builder = builder.no_proxy();
    };

    let Ok(client) = builder.build() else {
        return false;
    };
    let Ok(health_url) = url.join("/global/health") else {
        return false;
    };

    let mut req = client.get(health_url);

    if let Some(password) = password {
        req = req.basic_auth("railwise", Some(password));
    }

    req.send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

pub async fn check_health_with_retry(url: &str, password: Option<&str>, max_retries: u32) -> bool {
    for attempt in 1..=max_retries {
        tracing::debug!(
            "Health check attempt {}/{} for {}",
            attempt,
            max_retries,
            url
        );

        if check_health(url, password).await {
            if attempt > 1 {
                tracing::info!(
                    "Health check succeeded on attempt {}/{}",
                    attempt,
                    max_retries
                );
            }
            return true;
        }

        if attempt < max_retries {
            // Exponential backoff: 100ms, 200ms, 400ms
            let delay = Duration::from_millis(100 * (2_u64.pow(attempt - 1)));
            tokio::time::sleep(delay).await;
        }
    }

    tracing::warn!(
        "Health check failed after {} attempts for {}",
        max_retries,
        url
    );
    false
}

fn url_is_localhost(url: &reqwest::Url) -> bool {
    url.host_str().is_some_and(|host| {
        let host = host.trim_start_matches('[').trim_end_matches(']');
        host.eq_ignore_ascii_case("localhost")
            || host
                .parse::<std::net::IpAddr>()
                .is_ok_and(|ip| ip.is_loopback())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_loopback_health_urls() {
        for url in [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://[::1]:3000",
        ] {
            let url = reqwest::Url::parse(url).expect("valid url");
            assert!(url_is_localhost(&url));
        }
    }

    #[test]
    fn rejects_non_loopback_health_urls() {
        for url in ["http://192.168.1.10:3000", "https://railwise.ai"] {
            let url = reqwest::Url::parse(url).expect("valid url");
            assert!(!url_is_localhost(&url));
        }
    }
}
