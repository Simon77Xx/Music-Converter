# Music-Converter
Softcreate is a lightweight desktop application for Windows and macOS, built with Electron. Its main interface is a small, transparent, always-on-top mascot window. Users drag and drop audio files or folders onto the character; the app detects whether a folder or audio file was dropped, then opens a dedicated processing window.
# Softcreate

A small **Electron** desktop utility: a transparent desktop mascot acts as the drag-and-drop entry point. It supports **ZIP archiving for folders** and **transcoding / lossy re-encoding for common audio formats**. Output is written by default to a `SoftcreateOutput` folder under the user’s home directory.

## Features

- **Mascot window**: Always on top, transparent background; drop files or folders onto the character area.
- **Auto-detection**: A single folder → archive; one or more audio files → compress or convert format.
- **Processing window**: Choose **Compress** (lossy **MP3** or lossless **FLAC** with selectable FLAC compression level) or **Convert format**, with a progress bar; when finished, shows the output path and can reveal the file in the file manager.
- **Optional**: Click-through mode (may affect drag-and-drop reliability; turn off if needed).

## Tech stack

- **Electron** + **electron-vite** + **Vite** + **TypeScript** + **React**
- **ffmpeg-static**: Bundled FFmpeg binary for audio transcoding
- **archiver**: ZIP creation

## Requirements

- **Node.js** 18+ (LTS recommended)
- **Windows** or **macOS** (same codebase, separate builds)

## Install and run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Build artifacts are emitted under `out/`.

## Mascot image

Place your artwork as **`mascot.png`** in the **`public/`** directory at the project root. If the file is missing, a placeholder icon is shown.

## Output directory

Default output locations:

- **Windows**: `%USERPROFILE%\SoftcreateOutput`
- **macOS / Linux**: `~/SoftcreateOutput`

## Supported audio (formats FFmpeg can decode directly)

Examples: MP3, FLAC, WAV, AAC, M4A, OGG, OPUS, WMA, MP4 (audio track), etc. **Proprietary encrypted containers** from streaming apps (e.g. some NCM, KGM, QMC variants) are usually **not** decodable by FFmpeg alone. If you need to handle them, ensure you have the legal right and any required decoding path yourself; this project does not ship decryption logic by default.

## Project layout

```
src/
  main/           # Main process: windows, IPC, FFmpeg, ZIP
  preload/        # Preload script; exposes a safe API
  renderer/       # Mascot UI and processing UI (React)
  shared/         # Shared TypeScript types
public/           # Static assets (e.g. mascot.png)
```

## Compliance

Use this tool only on audio you are entitled to process. You are responsible for compliance with copyright, platform terms of service, and applicable local laws.

## License

Unless specified otherwise, see the `LICENSE` file in the repository (to be added if missing).
