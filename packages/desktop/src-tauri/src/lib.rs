mod cad;
mod cli;
mod constants;
mod crash;
mod logging;
mod markdown;
mod office;
mod server;
mod window_customizer;
mod windows;

use crate::cli::CommandChild;
use futures::{
    FutureExt, TryFutureExt,
    future::{self, Shared},
};
use std::{
    net::TcpListener,
    process::Command,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Listener, Manager, RunEvent, State, ipc::Channel};
#[cfg(all(debug_assertions, windows))]
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_specta::Event;
use tokio::{
    sync::{oneshot, watch},
    time::{sleep, timeout},
};

use crate::cli::{railwise_db_path, sqlite_migration::SqliteMigrationProgress, sync_cli};
use crate::constants::*;
use crate::server::get_saved_server_url;
use crate::windows::{LoadingWindow, MainWindow};

#[derive(Clone, serde::Serialize, specta::Type, Debug)]
struct ServerReadyData {
    url: String,
    password: Option<String>,
}

#[derive(Clone, Copy, serde::Serialize, specta::Type, Debug)]
#[serde(tag = "phase", rename_all = "snake_case")]
enum InitStep {
    ServerWaiting,
    SqliteWaiting,
    Done,
}

#[derive(serde::Deserialize, specta::Type)]
#[serde(rename_all = "snake_case")]
enum WslPathMode {
    Windows,
    Linux,
}

struct InitState {
    current: watch::Receiver<InitStep>,
}

#[derive(Clone)]
struct ServerState {
    child: Arc<Mutex<Option<CommandChild>>>,
    status: future::Shared<oneshot::Receiver<Result<ServerReadyData, String>>>,
}

impl ServerState {
    pub fn new(
        child: Option<CommandChild>,
        status: Shared<oneshot::Receiver<Result<ServerReadyData, String>>>,
    ) -> Self {
        Self {
            child: Arc::new(Mutex::new(child)),
            status,
        }
    }

    pub fn set_child(&self, child: Option<CommandChild>) {
        *self.child.lock().unwrap() = child;
    }
}

#[tauri::command]
#[specta::specta]
fn kill_sidecar(app: AppHandle) {
    let Some(server_state) = app.try_state::<ServerState>() else {
        tracing::info!("Server not running");
        return;
    };

    let Some(server_state) = server_state
        .child
        .lock()
        .expect("Failed to acquire mutex lock")
        .take()
    else {
        tracing::info!("Server state missing");
        return;
    };

    let _ = server_state.kill();

    tracing::info!("Killed server");
}

fn get_logs() -> String {
    logging::tail()
}

#[tauri::command]
#[specta::specta]
fn get_log_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_log_dir()
        .map(|dir| dir.to_string_lossy().to_string())
        .map_err(|err| format!("Failed to resolve app log dir: {err}"))
}

#[tauri::command]
#[specta::specta]
async fn await_initialization(
    state: State<'_, ServerState>,
    init_state: State<'_, InitState>,
    events: Channel<InitStep>,
) -> Result<ServerReadyData, String> {
    let mut rx = init_state.current.clone();

    let events = async {
        let e = *rx.borrow();
        let _ = events.send(e);

        while rx.changed().await.is_ok() {
            let step = *rx.borrow_and_update();

            let _ = events.send(step);

            if matches!(step, InitStep::Done) {
                break;
            }
        }
    };

    future::join(state.status.clone(), events)
        .await
        .0
        .map_err(|_| "Failed to get server status".to_string())?
}

#[tauri::command]
#[specta::specta]
fn check_app_exists(app_name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        check_windows_app(app_name)
    }

    #[cfg(target_os = "macos")]
    {
        check_macos_app(app_name)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        false
    }
}

#[cfg(target_os = "windows")]
fn check_windows_app(_app_name: &str) -> bool {
    // Check if command exists in PATH, including .exe
    return true;
}

#[cfg(target_os = "windows")]
fn resolve_windows_app_path(app_name: &str) -> Option<String> {
    use std::path::{Path, PathBuf};

    // Try to find the command using 'where'
    let output = Command::new("where").arg(app_name).output().ok()?;

    if !output.status.success() {
        return None;
    }

    let paths = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .collect::<Vec<_>>();

    let has_ext = |path: &Path, ext: &str| {
        path.extension()
            .and_then(|v| v.to_str())
            .map(|v| v.eq_ignore_ascii_case(ext))
            .unwrap_or(false)
    };

    if let Some(path) = paths.iter().find(|path| has_ext(path, "exe")) {
        return Some(path.to_string_lossy().to_string());
    }

    let resolve_cmd = |path: &Path| -> Option<String> {
        let content = std::fs::read_to_string(path).ok()?;

        for token in content.split('"') {
            let lower = token.to_ascii_lowercase();
            if !lower.contains(".exe") {
                continue;
            }

            if let Some(index) = lower.find("%~dp0") {
                let base = path.parent()?;
                let suffix = &token[index + 5..];
                let mut resolved = PathBuf::from(base);

                for part in suffix.replace('/', "\\").split('\\') {
                    if part.is_empty() || part == "." {
                        continue;
                    }
                    if part == ".." {
                        let _ = resolved.pop();
                        continue;
                    }
                    resolved.push(part);
                }

                if resolved.exists() {
                    return Some(resolved.to_string_lossy().to_string());
                }
            }

            let resolved = PathBuf::from(token);
            if resolved.exists() {
                return Some(resolved.to_string_lossy().to_string());
            }
        }

        None
    };

    for path in &paths {
        if has_ext(path, "cmd") || has_ext(path, "bat") {
            if let Some(resolved) = resolve_cmd(path) {
                return Some(resolved);
            }
        }

        if path.extension().is_none() {
            let cmd = path.with_extension("cmd");
            if cmd.exists() {
                if let Some(resolved) = resolve_cmd(&cmd) {
                    return Some(resolved);
                }
            }

            let bat = path.with_extension("bat");
            if bat.exists() {
                if let Some(resolved) = resolve_cmd(&bat) {
                    return Some(resolved);
                }
            }
        }
    }

    let key = app_name
        .chars()
        .filter(|v| v.is_ascii_alphanumeric())
        .flat_map(|v| v.to_lowercase())
        .collect::<String>();

    if !key.is_empty() {
        for path in &paths {
            let dirs = [
                path.parent(),
                path.parent().and_then(|dir| dir.parent()),
                path.parent()
                    .and_then(|dir| dir.parent())
                    .and_then(|dir| dir.parent()),
            ];

            for dir in dirs.into_iter().flatten() {
                if let Ok(entries) = std::fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let candidate = entry.path();
                        if !has_ext(&candidate, "exe") {
                            continue;
                        }

                        let Some(stem) = candidate.file_stem().and_then(|v| v.to_str()) else {
                            continue;
                        };

                        let name = stem
                            .chars()
                            .filter(|v| v.is_ascii_alphanumeric())
                            .flat_map(|v| v.to_lowercase())
                            .collect::<String>();

                        if name.contains(&key) || key.contains(&name) {
                            return Some(candidate.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    paths.first().map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
#[specta::specta]
fn resolve_app_path(app_name: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        resolve_windows_app_path(app_name)
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On macOS, just return the app_name as-is since the opener plugin handles it.
        Some(app_name.to_string())
    }
}

#[cfg(target_os = "macos")]
fn check_macos_app(app_name: &str) -> bool {
    // Check common installation locations
    let mut app_locations = vec![
        format!("/Applications/{}.app", app_name),
        format!("/System/Applications/{}.app", app_name),
    ];

    if let Ok(home) = std::env::var("HOME") {
        app_locations.push(format!("{}/Applications/{}.app", home, app_name));
    }

    for location in app_locations {
        if std::path::Path::new(&location).exists() {
            return true;
        }
    }

    // Also check if command exists in PATH
    Command::new("which")
        .arg(app_name)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[tauri::command]
#[specta::specta]
fn wsl_path(path: String, mode: Option<WslPathMode>) -> Result<String, String> {
    if !cfg!(windows) {
        return Ok(path);
    }

    let flag = match mode.unwrap_or(WslPathMode::Linux) {
        WslPathMode::Windows => "-w",
        WslPathMode::Linux => "-u",
    };

    let output = if path.starts_with('~') {
        let suffix = path.strip_prefix('~').unwrap_or("");
        let escaped = suffix.replace('"', "\\\"");
        let cmd = format!("wslpath {flag} \"$HOME{escaped}\"");
        Command::new("wsl")
            .args(["-e", "sh", "-lc", &cmd])
            .output()
            .map_err(|e| format!("Failed to run wslpath: {e}"))?
    } else {
        Command::new("wsl")
            .args(["-e", "wslpath", flag, &path])
            .output()
            .map_err(|e| format!("Failed to run wslpath: {e}"))?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err("wslpath failed".to_string());
        }
        return Err(stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
#[specta::specta]
async fn git_log_agent(name: String, directory: String) -> Result<String, String> {
    let agent_path = format!(".railwise/agent/{name}.md");
    let output = tokio::process::Command::new("git")
        .args(["log", "--oneline", "-10", "--", &agent_path])
        .current_dir(directory)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
#[specta::specta]
async fn git_diff_agent(name: String, directory: String) -> Result<String, String> {
    let agent_path = format!(".railwise/agent/{name}.md");
    let output = tokio::process::Command::new("git")
        .args(["diff", "HEAD", "--", &agent_path])
        .current_dir(directory)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let crash = crash::init();
    let builder = make_specta_builder();

    #[cfg(debug_assertions)] // <- Only export on non-release builds
    export_types(&builder);

    #[cfg(all(target_os = "macos", not(debug_assertions)))]
    let _ = std::process::Command::new("killall")
        .arg("railwise-cli")
        .output();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window when another instance is launched
            if let Some(window) = app.get_webview_window(MainWindow::LABEL) {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(window_state_flags())
                .with_denylist(&[LoadingWindow::LABEL])
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(crate::window_customizer::PinchZoomDisablePlugin)
        .plugin(tauri_plugin_decorum::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            let handle = app.handle().clone();

            let log_dir = app
                .path()
                .app_log_dir()
                .expect("failed to resolve app log dir");
            // Hold the guard in managed state so it lives for the app's lifetime,
            // ensuring all buffered logs are flushed on shutdown.
            handle.manage(logging::init(&log_dir));

            builder.mount_events(&handle);
            tauri::async_runtime::spawn(initialize(handle));

            Ok(())
        });

    if UPDATER_ENABLED {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    if let Some(client) = crash.as_ref() {
        builder = builder.plugin(tauri_plugin_sentry::init_with_no_injection(client));
    }

    builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                tracing::info!("Received Exit");

                kill_sidecar(app.clone());
            }
        });
}

fn make_specta_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        // Then register them (separated by a comma)
        .commands(tauri_specta::collect_commands![
            kill_sidecar,
            get_log_dir,
            cli::install_cli,
            await_initialization,
            server::get_default_server_url,
            server::set_default_server_url,
            server::get_wsl_config,
            server::set_wsl_config,
            markdown::parse_markdown_command,
            cad::parse_dxf,
            cad::convert_dwg_to_dxf,
            office::read_text_file,
            office::convert_pptx_to_images,
            office::convert_sheet_to_csv,
            office::convert_docx_to_html,
            check_app_exists,
            wsl_path,
            resolve_app_path,
            git_log_agent,
            git_diff_agent
        ])
        .events(tauri_specta::collect_events![
            LoadingWindowComplete,
            SqliteMigrationProgress
        ])
        .error_handling(tauri_specta::ErrorHandlingMode::Throw)
}

fn export_types(builder: &tauri_specta::Builder<tauri::Wry>) {
    builder
        .export(
            specta_typescript::Typescript::default(),
            "../src/bindings.ts",
        )
        .expect("Failed to export typescript bindings");
}

#[cfg(test)]
#[test]
fn test_export_types() {
    let builder = make_specta_builder();
    export_types(&builder);
}

#[derive(tauri_specta::Event, serde::Deserialize, specta::Type)]
struct LoadingWindowComplete;

async fn initialize(app: AppHandle) {
    tracing::info!("Initializing app");

    let (init_tx, init_rx) = watch::channel(InitStep::ServerWaiting);

    setup_app(&app, init_rx);
    spawn_cli_sync_task(app.clone());

    let (server_ready_tx, server_ready_rx) = oneshot::channel();
    let server_ready_rx = server_ready_rx.shared();
    app.manage(ServerState::new(None, server_ready_rx.clone()));

    let loading_window_complete = event_once_fut::<LoadingWindowComplete>(&app);

    tracing::info!("Main and loading windows created");

    // SQLite migration handling:
    // We only do this if the sqlite db doesn't exist, and we're expecting the sidecar to create it
    // First, we spawn a task that listens for SqliteMigrationProgress events that can
    // come from any invocation of the sidecar CLI. The progress is captured by a stdout stream interceptor.
    // Then in the loading task, we wait for sqlite migration to complete before
    // starting our health check against the server, otherwise long migrations could result in a timeout.
    let needs_sqlite_migration = !sqlite_file_exists(&app);
    let sqlite_done = needs_sqlite_migration.then(|| {
        tracing::info!(
            path = %railwise_db_path(&app).display(),
            "Sqlite file not found, waiting for it to be generated"
        );

        let (done_tx, done_rx) = oneshot::channel::<()>();
        let done_tx = Arc::new(Mutex::new(Some(done_tx)));

        let init_tx = init_tx.clone();
        let id = SqliteMigrationProgress::listen(&app, move |e| {
            let _ = init_tx.send(InitStep::SqliteWaiting);

            if matches!(e.payload, SqliteMigrationProgress::Done)
                && let Some(done_tx) = done_tx.lock().unwrap().take()
            {
                let _ = done_tx.send(());
            }
        });

        let app = app.clone();
        tokio::spawn(done_rx.map(async move |_| {
            app.unlisten(id);
        }))
    });

    let loading_task = tokio::spawn({
        let app = app.clone();

        async move {
            tracing::info!("Setting up server connection");
            let server_connection = setup_server_connection(app.clone()).await;
            tracing::info!("Server connection setup");

            // we delay spawning this future so that the timeout is created lazily
            let cli_health_check = match server_connection {
                ServerConnection::CLI {
                    child,
                    health_check,
                    url,
                    password,
                } => {
                    let app = app.clone();
                    Some(
                        async move {
                            // Cold starts can load user config, providers, and MCP metadata before
                            // the health endpoint is ready. Keep fast polling in server.rs, but do
                            // not fail the desktop shell before the packaged sidecar has a fair
                            // chance to finish initialization.
                            let res = timeout(Duration::from_secs(60), health_check.0).await;
                            let err = match res {
                                Ok(Ok(Ok(()))) => None,
                                Ok(Ok(Err(e))) => Some(e),
                                Ok(Err(e)) => Some(format!("Health check task failed: {e}")),
                                Err(_) => Some("Health check timed out".to_string()),
                            };

                            if let Some(err) = err {
                                let _ = child.kill();

                                return Err(format!(
                                    "Failed to spawn RAILWISE Server ({err}). Logs:\n{}",
                                    get_logs()
                                ));
                            }

                            tracing::info!("CLI health check OK");

                            app.state::<ServerState>().set_child(Some(child));

                            Ok(ServerReadyData { url, password })
                        }
                        .map(move |res| {
                            let _ = server_ready_tx.send(res);
                        }),
                    )
                }
                ServerConnection::Existing { url } => {
                    let _ = server_ready_tx.send(Ok(ServerReadyData {
                        url: url.to_string(),
                        password: None,
                    }));
                    None
                }
            };

            tracing::info!("server connection started");

            if let Some(cli_health_check) = cli_health_check {
                if let Some(sqlite_done_rx) = sqlite_done {
                    let _ = sqlite_done_rx.await;
                }
                tokio::spawn(cli_health_check);
            }

            let _ = server_ready_rx.await;

            tracing::info!("Loading task finished");
        }
    })
    .map_err(|_| ())
    .shared();

    let loading_window = if needs_sqlite_migration
        && timeout(Duration::from_secs(1), loading_task.clone())
            .await
            .is_err()
    {
        tracing::debug!("Loading task timed out, showing loading window");
        let loading_window = LoadingWindow::create(&app).expect("Failed to create loading window");
        sleep(Duration::from_secs(1)).await;
        Some(loading_window)
    } else {
        tracing::debug!("Showing main window without loading window");
        MainWindow::create(&app).expect("Failed to create main window");

        None
    };

    let _ = loading_task.await;

    tracing::info!("Loading done, completing initialisation");
    let _ = init_tx.send(InitStep::Done);

    if loading_window.is_some() {
        loading_window_complete.await;

        tracing::info!("Loading window completed");
    }

    MainWindow::create(&app).expect("Failed to create main window");

    if let Some(loading_window) = loading_window {
        let _ = loading_window.close();
    }
}

fn setup_app(app: &tauri::AppHandle, init_rx: watch::Receiver<InitStep>) {
    #[cfg(all(debug_assertions, windows))]
    app.deep_link().register_all().ok();

    app.manage(InitState { current: init_rx });
}

fn spawn_cli_sync_task(app: AppHandle) {
    tokio::spawn(async move {
        if let Err(e) = sync_cli(app) {
            tracing::error!("Failed to sync CLI: {e}");
        }
    });
}

enum ServerConnection {
    Existing {
        url: String,
    },
    CLI {
        url: String,
        password: Option<String>,
        child: CommandChild,
        health_check: server::HealthCheck,
    },
}

async fn setup_server_connection(app: AppHandle) -> ServerConnection {
    let custom_url = get_saved_server_url(&app).await;

    tracing::info!(?custom_url, "Attempting server connection");

    // Try custom URL with retry logic if configured
    if let Some(url) = custom_url {
        if server::check_health_with_retry(&url, None, 2).await {
            tracing::info!(%url, "Connected to custom server");
            return ServerConnection::Existing { url: url.clone() };
        } else {
            tracing::warn!(%url, "Custom server not available, falling back to local server");
        }
    }

    // Try existing local server with retry
    let hostname = "127.0.0.1";
    let local_port = get_sidecar_port();
    let local_url = format!("http://{hostname}:{local_port}");

    tracing::debug!(url = %local_url, "Checking health of local server with retry");
    if server::check_health_with_retry(&local_url, None, 2).await {
        tracing::info!(url = %local_url, "Health check OK, using existing server");
        return ServerConnection::Existing { url: local_url };
    }

    // Spawn new local server with fallback port strategy
    let password = uuid::Uuid::new_v4().to_string();

    tracing::info!(port = local_port, "Spawning new local server");
    let (child, health_check) =
        server::spawn_local_server(app, hostname.to_string(), local_port, password.clone());

    ServerConnection::CLI {
        url: local_url,
        password: Some(password),
        child,
        health_check,
    }
}

fn get_sidecar_port() -> u32 {
    option_env!("RAILWISE_PORT")
        .map(|s| s.to_string())
        .or_else(|| std::env::var("RAILWISE_PORT").ok())
        .and_then(|port_str| port_str.parse().ok())
        .unwrap_or_else(|| find_free_port()) as u32
}

fn find_free_port() -> u32 {
    // Try a few common port ranges for RAILWISE, fallback to system allocation
    let preferred_ports = [3000, 3001, 3002, 8080, 8081, 8082];

    for &port in &preferred_ports {
        if port_is_available(port) {
            tracing::debug!("Using preferred port {}", port);
            return port;
        }
    }

    // Fallback to system-allocated port
    let port = TcpListener::bind("127.0.0.1:0")
        .expect("Failed to bind to find free port")
        .local_addr()
        .expect("Failed to get local address")
        .port();

    tracing::debug!("Using system-allocated port {}", port);
    port as u32
}

fn port_is_available(port: u32) -> bool {
    TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

fn sqlite_file_exists(app: &AppHandle) -> bool {
    railwise_db_path(app).exists()
}

// Creates a `once` listener for the specified event and returns a future that resolves
// when the listener is fired.
// Since the future creation and awaiting can be done separately, it's possible to create the listener
// synchronously before doing something, then awaiting afterwards.
fn event_once_fut<T: tauri_specta::Event + serde::de::DeserializeOwned>(
    app: &AppHandle,
) -> impl Future<Output = ()> {
    let (tx, rx) = oneshot::channel();
    T::once(app, |_| {
        let _ = tx.send(());
    });
    async {
        let _ = rx.await;
    }
}
