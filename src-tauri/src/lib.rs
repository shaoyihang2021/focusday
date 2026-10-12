use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// Label of the detached, always-on-top desktop widget window.
const WIDGET_LABEL: &str = "widget";
const MAIN_LABEL: &str = "main";
const WIDGET_ROUTE: &str = "index.html#/widget";

/// Shows or hides the desktop widget. The window is created on demand the first
/// time it is requested, then reused.
#[tauri::command]
async fn toggle_widget(app: AppHandle, visible: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WIDGET_LABEL) {
        if visible {
            window.show().map_err(|e| e.to_string())?;
            let _ = window.set_focus();
        } else {
            window.hide().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    if visible {
        create_widget(&app, true)?;
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

/// Brings the main window back to the front (used from the widget).
#[tauri::command]
async fn focus_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        window.show().map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn create_widget(app: &AppHandle, visible: bool) -> Result<WebviewWindow, String> {
    WebviewWindowBuilder::new(
        app,
        WIDGET_LABEL,
        WebviewUrl::App(WIDGET_ROUTE.into()),
    )
    .title("FocusDay 小组件")
    .inner_size(324.0, 216.0)
    .min_inner_size(300.0, 190.0)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            toggle_widget,
            set_widget_always_on_top,
            focus_main_window
        ])
        .setup(|app| {
            // Pre-create the widget hidden so that toggling it is instant.
            let _ = create_widget(app.handle(), false);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FocusDay");
}
