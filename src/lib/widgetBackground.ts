import { isTauri } from "./env";

/** Longest side kept after downscaling, enough for a 2x widget at any size. */
const MAX_DIMENSION = 1280;
const WEBP_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取该图片"));
    image.src = src;
  });
}

/**
 * Re-encodes a picked image at a sensible size so the whole state (and its
 * JSON backup) does not balloon when a 12MP photo is selected.
 */
async function shrink(source: string): Promise<string> {
  const image = await loadImage(source);
  const largest = Math.max(image.naturalWidth, image.naturalHeight);
  if (!largest) return source;

  const scale = Math.min(1, MAX_DIMENSION / largest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(image, 0, 0, width, height);

  const encoded = canvas.toDataURL("image/webp", WEBP_QUALITY);
  // WebKit cannot encode WebP and silently falls back to PNG, which may be
  // bigger than a small original — keep the original in that case.
  if (scale === 1 && encoded.length >= source.length) return source;
  return encoded;
}

/**
 * Opens a file picker and returns a downscaled data URL for the widget
 * background, or null when the user cancelled or the app is not in Tauri.
 */
export async function pickWidgetBackground(): Promise<string | null> {
  if (!isTauri()) return null;
  const [{ open }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);

  const picked = await open({
    title: "选择小组件背景图片",
    multiple: false,
    filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
  });
  if (!picked || typeof picked !== "string") return null;

  const source = await invoke<string>("read_image_data_url", { path: picked });
  return shrink(source);
}
