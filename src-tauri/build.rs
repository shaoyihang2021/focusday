fn main() {
    // One flag for "this build has desktop windows / tray / autostart".
    // Mobile targets still share the same library crate.
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os != "android" && target_os != "ios" {
        println!("cargo:rustc-cfg=desktop_os");
    }
    tauri_build::build()
}
