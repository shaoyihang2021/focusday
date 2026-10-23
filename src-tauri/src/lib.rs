// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, LogicalSize, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// Label of the detached, always-on-top desktop widget window.
const WIDGET_LABEL: &str = "widget";
const MAIN_LABEL: &str = "main";
const WIDGET_ROUTE: &str = "index.html#/widget";
const TRAY_ID: &str = "focusday-tray";

/// Base (100%) size of the widget window, in logical pixels.
const WIDGET_BASE_W: f64 = 324.0;
const WIDGET_BASE_H: f64 = 216.0;

/// Label prefix of the per-countdown desktop widget windows.
const COUNTDOWN_PREFIX: &str = "cd-";
const COUNTDOWN_BASE_W: f64 = 360.0;
const COUNTDOWN_BASE_H: f64 = 214.0;

/// Builds a valid Tauri window label from a countdown id.
/// Tauri labels may only contain alphanumerics, `-`, `/`, `:`, `_` and `.`.
fn countdown_label(id: &str) -> String {
    let safe: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    format!("{COUNTDOWN_PREFIX}{safe}")
}

/// Cascades freshly opened countdown widgets so they do not cover each other.
fn cascade_position(index: usize) -> (f64, f64) {
    (80.0 + index as f64 * 28.0, 120.0 + index as f64 * 28.0)
}

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

/// Shows the main window when it is hidden, hides it when it is visible.
fn toggle_main<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_LABEL) else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
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

/// Opens one borderless desktop window per pinned countdown and closes the
/// rest. Idempotent: the main window calls it whenever the pinned set changes.
#[tauri::command]
async fn sync_countdown_widgets(app: AppHandle, ids: Vec<String>) -> Result<(), String> {
    use std::collections::HashSet;

    let wanted: HashSet<String> = ids.iter().map(|id| countdown_label(id)).collect();

    let existing: Vec<(String, WebviewWindow)> = app
        .webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with(COUNTDOWN_PREFIX))
        .collect();

    // `destroy` bypasses close-request handlers, so a pin toggle can never be
    // fought over by the widget window itself.
    for (label, window) in &existing {
        if !wanted.contains(label) {
            let _ = window.destroy();
        }
    }

    let mut index = existing.iter().filter(|(label, _)| wanted.contains(label)).count();
    for id in ids {
        let label = countdown_label(&id);
        if app.get_webview_window(&label).is_some() {
            continue;
        }

        let (x, y) = cascade_position(index);
        index += 1;
        let route = format!("index.html#/cd/{id}");
        WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(route.into()))
            .title("FocusDay · 倒数日")
            .inner_size(COUNTDOWN_BASE_W, COUNTDOWN_BASE_H)
            .position(x, y)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .visible(true)
            .build()
            .map_err(|e| e.to_string())?;
    }

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

/// Updates the tray icon's hover tooltip, e.g. the live countdown.
#[tauri::command]
fn update_tray_tooltip(app: AppHandle, text: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_tooltip(Some(&text)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 3x5 bitmap glyphs for the digits drawn inside the tray icon.
const DIGIT_GLYPHS: [[u8; 5]; 10] = [
    [0b111, 0b101, 0b101, 0b101, 0b111], // 0
    [0b010, 0b110, 0b010, 0b010, 0b111], // 1
    [0b111, 0b001, 0b111, 0b100, 0b111], // 2
    [0b111, 0b001, 0b111, 0b001, 0b111], // 3
    [0b101, 0b101, 0b111, 0b001, 0b001], // 4
    [0b111, 0b100, 0b111, 0b001, 0b111], // 5
    [0b111, 0b100, 0b111, 0b101, 0b111], // 6
    [0b111, 0b001, 0b001, 0b001, 0b001], // 7
    [0b111, 0b101, 0b111, 0b101, 0b111], // 8
    [0b111, 0b101, 0b111, 0b001, 0b111], // 9
];

/// Tray icons are rendered at 32x32 so they stay crisp on high DPI taskbars.
const ICON_SIZE: usize = 32;
const GLYPH_SCALE: usize = 2;

fn parse_hex_color(value: &str) -> (u8, u8, u8) {
    let hex = value.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return (247, 74, 44);
    }
    let channel = |range: std::ops::Range<usize>| {
        u8::from_str_radix(&hex[range], 16).unwrap_or(255)
    };
    (channel(0..2), channel(2..4), channel(4..6))
}

fn set_pixel(rgba: &mut [u8], size: usize, x: usize, y: usize, r: u8, g: u8, b: u8, a: u8) {
    if x >= size || y >= size {
        return;
    }
    let index = (y * size + x) * 4;
    rgba[index] = r;
    rgba[index + 1] = g;
    rgba[index + 2] = b;
    rgba[index + 3] = a;
}

/// Draws a progress ring plus the remaining minutes into an RGBA buffer.
///
/// The digits use a 3x5 bitmap font scaled up, with a one pixel dark halo so
/// they stay readable on both light and dark taskbars. `minutes` is shown as
/// two digits inside the ring; the full time lives in the tooltip, because a
/// 16px tray icon cannot legibly fit `24:31`.
fn render_tray_icon(minutes: u32, fraction: f64, color_hex: &str) -> Vec<u8> {
    let size = ICON_SIZE;
    let mut rgba = vec![0u8; size * size * 4];

    let (br, bg, bb) = parse_hex_color(color_hex);
    let center = size as f64 / 2.0;
    let outer = 15.0_f64;
    let inner = 11.5_f64;
    let start = -std::f64::consts::FRAC_PI_2; // 12 o'clock
    let sweep = std::f64::consts::TAU * fraction.clamp(0.0, 1.0);

    for y in 0..size {
        for x in 0..size {
            let dx = x as f64 + 0.5 - center;
            let dy = y as f64 + 0.5 - center;
            let distance = (dx * dx + dy * dy).sqrt();
            if distance > outer || distance < inner {
                continue;
            }
            let mut angle = dy.atan2(dx) - start;
            if angle < 0.0 {
                angle += std::f64::consts::TAU;
            }
            if angle <= sweep {
                set_pixel(&mut rgba, size, x, y, br, bg, bb, 255);
            } else {
                set_pixel(&mut rgba, size, x, y, 255, 255, 255, 70);
            }
        }
    }

    // Rasterise the minute count into a mask first, then draw halo + glyph.
    let label = format!("{:02}", minutes.min(99));
    let glyph_w = 3 * GLYPH_SCALE;
    let glyph_h = 5 * GLYPH_SCALE;
    let spacing = 2;
    let total_w = label.len() * glyph_w + label.len().saturating_sub(1) * spacing;
    let origin_x = (size.saturating_sub(total_w)) / 2;
    let origin_y = (size.saturating_sub(glyph_h)) / 2;

    let mut mask = vec![false; size * size];
    for (index, ch) in label.chars().enumerate() {
        let Some(digit) = ch.to_digit(10) else { continue };
        let glyph_x = origin_x + index * (glyph_w + spacing);
        for row in 0..5 {
            let bits = DIGIT_GLYPHS[digit as usize][row];
            for col in 0..3 {
                if bits & (0b100 >> col) == 0 {
                    continue;
                }
                for oy in 0..GLYPH_SCALE {
                    for ox in 0..GLYPH_SCALE {
                        let px = glyph_x + col * GLYPH_SCALE + ox;
                        let py = origin_y + row * GLYPH_SCALE + oy;
                        if px < size && py < size {
                            mask[py * size + px] = true;
                        }
                    }
                }
            }
        }
    }

    for y in 0..size {
        for x in 0..size {
            if mask[y * size + x] {
                continue;
            }
            // Halo: any empty pixel touching a glyph pixel gets a dark tint.
            let touches = [(1, 0), (0, 1), (-1, 0), (0, -1)].iter().any(|(dx, dy)| {
                let nx = x as isize + dx;
                let ny = y as isize + dy;
                nx >= 0
                    && ny >= 0
                    && (nx as usize) < size
                    && (ny as usize) < size
                    && mask[ny as usize * size + nx as usize]
            });
            if touches && rgba[(y * size + x) * 4 + 3] < 200 {
                set_pixel(&mut rgba, size, x, y, 0, 0, 0, 180);
            }
        }
    }

    for y in 0..size {
        for x in 0..size {
            if mask[y * size + x] {
                set_pixel(&mut rgba, size, x, y, 255, 255, 255, 255);
            }
        }
    }

    rgba
}

/// Paints the tray icon with the current focus progress.
/// `minutes: None` restores the default application icon.
#[tauri::command]
fn set_tray_progress(
    app: AppHandle,
    minutes: Option<u32>,
    fraction: f64,
    color: String,
) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };

    let icon = match minutes {
        Some(remaining) => {
            let rgba = render_tray_icon(remaining, fraction, &color);
            Some(tauri::image::Image::new_owned(
                rgba,
                ICON_SIZE as u32,
                ICON_SIZE as u32,
            ))
        }
        None => app.default_window_icon().cloned(),
    };

    if let Some(icon) = icon {
        tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Registers the global shortcut used to toggle the main window.
/// Passing `None` (or an empty string) unregisters everything.
/// Returns whether a shortcut is active afterwards.
#[tauri::command]
fn set_global_shortcut(app: AppHandle, accelerator: Option<String>) -> Result<bool, String> {
    let shortcuts = app.global_shortcut();
    shortcuts.unregister_all().map_err(|e| e.to_string())?;

    let Some(accelerator) = accelerator.filter(|acc| !acc.trim().is_empty()) else {
        return Ok(false);
    };

    shortcuts
        .on_shortcut(accelerator.as_str(), move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                toggle_main(app);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(true)
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

/// Writes a base64 encoded PNG (used by the stats share card export).
#[tauri::command]
fn write_png(path: String, base64: String) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

/// Opens the Windows "专注助手 / 勿扰" settings page.
///
/// Windows exposes no public API that lets a third-party app toggle system-wide
/// Do Not Disturb, and writing the registry ourselves would be neither safe nor
/// stable. So instead of pretending to control it, we only open the page and let
/// the user switch it on deliberately.
#[tauri::command]
fn open_system_focus_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // `start "" ms-settings:quiethours` opens the Focus assist page.
        std::process::Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:quiethours"])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("系统专注助手设置入口仅支持 Windows".into())
    }
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            toggle_widget,
            set_widget_always_on_top,
            set_widget_size,
            focus_main_window,
            sync_countdown_widgets,
            set_auto_launch,
            update_tray_tooltip,
            set_tray_progress,
            set_global_shortcut,
            write_backup,
            read_backup,
            write_png,
            open_system_focus_settings,
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

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: usize = ICON_SIZE;
    const ACCENT: (u8, u8, u8) = (37, 99, 235);

    fn pixel(rgba: &[u8], x: usize, y: usize) -> (u8, u8, u8, u8) {
        let i = (y * SIZE + x) * 4;
        (rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3])
    }

    fn count(rgba: &[u8], test: impl Fn((u8, u8, u8, u8)) -> bool) -> usize {
        (0..SIZE * SIZE)
            .filter(|i| test(pixel(rgba, i % SIZE, i / SIZE)))
            .count()
    }

    #[test]
    fn parses_hex_colours_and_falls_back() {
        assert_eq!(parse_hex_color("#2563eb"), ACCENT);
        assert_eq!(parse_hex_color("2563eb"), ACCENT);
        assert_eq!(parse_hex_color("  #F74A2C "), (247, 74, 44));
        assert_eq!(parse_hex_color("nope"), (247, 74, 44));
    }

    #[test]
    fn draws_a_progress_ring_proportional_to_the_fraction() {
        let empty = render_tray_icon(25, 0.0, "#2563eb");
        let half = render_tray_icon(25, 0.5, "#2563eb");
        let full = render_tray_icon(25, 1.0, "#2563eb");

        let is_accent = |p: (u8, u8, u8, u8)| (p.0, p.1, p.2) == ACCENT && p.3 == 255;
        let accent_empty = count(&empty, is_accent);
        let accent_half = count(&half, is_accent);
        let accent_full = count(&full, is_accent);

        // Nothing elapsed, half elapsed, everything elapsed.
        assert_eq!(accent_empty, 0);
        assert!(accent_half > 0, "half progress should light up the ring");
        assert!(
            accent_full > accent_half,
            "full progress ({accent_full}) should exceed half ({accent_half})"
        );

        // The track ring is still drawn behind the progress arc.
        let is_track = |p: (u8, u8, u8, u8)| p.3 > 0 && p.3 < 200;
        assert!(count(&empty, is_track) > 100, "the empty ring needs a visible track");
    }

    #[test]
    fn digit_halo_keeps_the_number_readable_on_any_background() {
        let rgba = render_tray_icon(12, 0.3, "#2563eb");
        let white = count(&rgba, |p| p == (255, 255, 255, 255));
        let halo = count(&rgba, |p| p == (0, 0, 0, 180));

        // "12": 8 filled cells for the glyph '1' plus 11 for '2', at 2x2 px.
        assert_eq!(white, 76, "expected both digits to be fully painted");
        assert!(
            halo >= white / 2,
            "the glyphs need a dark halo for contrast, got {halo} vs {white} white pixels"
        );

        // A halo pixel must never sit on top of the progress ring.
        for y in 0..SIZE {
            for x in 0..SIZE {
                if pixel(&rgba, x, y) == (0, 0, 0, 180) {
                    let dx = x as f64 + 0.5 - (SIZE / 2) as f64;
                    let dy = y as f64 + 0.5 - (SIZE / 2) as f64;
                    assert!(
                        (dx * dx + dy * dy).sqrt() < 11.5,
                        "halo pixel at ({x},{y}) overlaps the ring"
                    );
                }
            }
        }

        // Glyphs and halo sit inside the ring, never overlapping it.
        let (cx, cy) = (SIZE / 2, SIZE / 2);
        for y in 0..SIZE {
            for x in 0..SIZE {
                let p = pixel(&rgba, x, y);
                if p == (255, 255, 255, 255) {
                    let dx = x as f64 + 0.5 - cx as f64;
                    let dy = y as f64 + 0.5 - cy as f64;
                    assert!(
                        (dx * dx + dy * dy).sqrt() < 11.5,
                        "digit pixel at ({x},{y}) overlaps the ring"
                    );
                }
            }
        }
    }

    #[test]
    fn countdown_labels_are_prefixed_and_sanitized() {
        assert_eq!(countdown_label("abc-123"), "cd-abc-123");
        assert_eq!(countdown_label("a/b c"), "cd-a-b-c");
        assert!(countdown_label("x y").starts_with("cd-"));
    }

    #[test]
    fn countdown_widgets_cascade_by_28px() {
        assert_eq!(cascade_position(0), (80.0, 120.0));
        assert_eq!(cascade_position(2), (136.0, 176.0));
    }

    #[test]
    fn minutes_are_clamped_to_two_digits() {
        let high = render_tray_icon(150, 0.5, "#2563eb");
        let capped = render_tray_icon(99, 0.5, "#2563eb");
        assert_eq!(high, capped, "values above 99 should render as 99");
    }
}
