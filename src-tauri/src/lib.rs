// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, LogicalSize, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// Label of the detached, always-on-top desktop widget window.
const WIDGET_LABEL: &str = "widget";
const MAIN_LABEL: &str = "main";
const WIDGET_ROUTE: &str = "index.html#/widget";
const TRAY_ID: &str = "focusday-tray";

/// Base (100%) size of the widget window, in logical pixels.
const WIDGET_BASE_W: f64 = 324.0;
const WIDGET_BASE_H: f64 = 216.0;

fn create_widget<R: Runtime>(app: &AppHandle<R>, visible: bool) -> Result<WebviewWindow<R>, String> {
    WebviewWindowBuilder::new(app, WIDGET_LABEL, WebviewUrl::App(WIDGET_ROUTE.into()))
        .title("FocusDay 小组件")
        .inner_size(WIDGET_BASE_W, WIDGET_BASE_H)
        .min_inner_size(240.0, 160.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible(visible)
        .build()
        .map_err(|e| e.to_string())
}

/// Brings the main window back to the front.
fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn show_widget<R: Runtime>(app: &AppHandle<R>) {
    match app.get_webview_window(WIDGET_LABEL) {
        Some(window) => {
            let _ = window.show();
        }
        None => {
            let _ = create_widget(app, true);
        }
    }
}

fn hide_widget<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(WIDGET_LABEL) {
        let _ = window.hide();
    }
}

/// Shows or hides the desktop widget, creating it on demand the first time.
#[tauri::command]
async fn toggle_widget(app: AppHandle, visible: bool) -> Result<(), String> {
    if visible {
        show_widget(&app);
    } else {
        hide_widget(&app);
    }
    Ok(())
}

/// Keeps the widget window's always-on-top flag in sync with user settings.
#[tauri::command]
async fn set_widget_always_on_top(app: AppHandle, value: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WIDGET_LABEL) {
        window.set_always_on_top(value).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Resizes the widget window. `scale` is a multiplier of the base size.
#[tauri::command]
async fn set_widget_size(app: AppHandle, scale: f64) -> Result<(), String> {
    let clamped = scale.clamp(0.7, 1.6);
    if let Some(window) = app.get_webview_window(WIDGET_LABEL) {
        window
            .set_size(LogicalSize::new(WIDGET_BASE_W * clamped, WIDGET_BASE_H * clamped))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Brings the main window back to the front (used from the widget).
#[tauri::command]
async fn focus_main_window(app: AppHandle) -> Result<(), String> {
    show_main(&app);
    Ok(())
}

/// Registers / removes FocusDay from the OS auto-start list.
/// Returns the state the OS actually reports afterwards.
#[tauri::command]
fn set_auto_launch(app: AppHandle, value: bool) -> Result<bool, String> {
    let autolaunch = app.autolaunch();
    let outcome = if value {
        autolaunch.enable()
    } else {
        autolaunch.disable()
    };
    outcome.map_err(|e| e.to_string())?;
    autolaunch.is_enabled().map_err(|e| e.to_string())
}

/// Writes an exported backup to a user-chosen path.
#[tauri::command]
fn write_backup(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// Reads a backup file picked by the user.
#[tauri::command]
fn read_backup(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Fully exits the app, closing tray and widget windows as well.
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_main_item = MenuItem::with_id(app, "show_main", "显示主窗口", true, None::<&str>)?;
    let show_widget_item =
        MenuItem::with_id(app, "show_widget", "显示桌面小组件", true, None::<&str>)?;
    let hide_widget_item =
        MenuItem::with_id(app, "hide_widget", "隐藏桌面小组件", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出 FocusDay", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_main_item,
            &show_widget_item,
            &hide_widget_item,
            &separator,
            &quit_item,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("FocusDay · 番茄待办与倒数日")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_main" => show_main(app),
            "show_widget" => show_widget(app),
            "hide_widget" => hide_widget(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            toggle_widget,
            set_widget_always_on_top,
            set_widget_size,
            focus_main_window,
            set_auto_launch,
            write_backup,
            read_backup,
            quit_app
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            // Pre-create the widget hidden so toggling it feels instant.
            let _ = create_widget(&handle, false);
            setup_tray(&handle)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FocusDay");
}
