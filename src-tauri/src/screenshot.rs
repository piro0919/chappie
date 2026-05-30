// Screen capture for the take_screenshot tool.
//
// macOS shells out to `screencapture(1)` (which also offers an interactive
// selection marquee). Windows captures the whole virtual screen via GDI
// BitBlt and either writes a PNG to the Desktop or puts the bitmap on the
// clipboard (via arboard). The interactive selection mode has no built-in
// CLI on Windows, so on Windows every mode captures the full screen for now.

use serde::Serialize;

#[derive(Serialize)]
pub struct ScreenshotResult {
    pub path: Option<String>,
    pub copied_to_clipboard: bool,
    pub cancelled: bool,
}

#[cfg(target_os = "macos")]
pub async fn capture(mode: &str, destination: &str) -> Result<ScreenshotResult, String> {
    use std::process::Command;

    let to_clipboard = destination != "file";
    let mut args: Vec<String> = vec!["-x".into()]; // suppress shutter sound
    if mode == "selection" {
        args.push("-i".into());
    }

    let path: Option<String> = if to_clipboard {
        args.push("-c".into());
        None
    } else {
        let dir = dirs::desktop_dir().ok_or_else(|| "desktop dir unavailable".to_string())?;
        let stamp = chrono::Local::now().format("%Y-%m-%d %H.%M.%S");
        let p = dir.join(format!("Screenshot {stamp}.png"));
        let s = p.to_string_lossy().into_owned();
        args.push(s.clone());
        Some(s)
    };

    let path_for_check = path.clone();
    let status = tokio::task::spawn_blocking(move || {
        Command::new("screencapture").args(&args).status()
    })
    .await
    .map_err(|e| format!("join: {e}"))?
    .map_err(|e| format!("spawn: {e}"))?;

    if !status.success() {
        return Err(format!("screencapture exited with status {status}"));
    }

    // `screencapture -i` returns 0 even when the user cancels with Esc.
    // Detect cancellation: file mode → no file created; clipboard mode →
    // we can't tell reliably, so trust exit code (LLM phrasing is fine).
    let cancelled = match &path_for_check {
        Some(p) => !std::path::Path::new(p).exists(),
        None => false,
    };

    Ok(ScreenshotResult {
        path: if cancelled { None } else { path_for_check },
        copied_to_clipboard: to_clipboard && !cancelled,
        cancelled,
    })
}

#[cfg(target_os = "windows")]
pub async fn capture(mode: &str, destination: &str) -> Result<ScreenshotResult, String> {
    let _ = mode; // selection marquee has no built-in CLI on Windows → full screen
    let to_clipboard = destination != "file";
    tokio::task::spawn_blocking(move || win::capture_blocking(to_clipboard))
        .await
        .map_err(|e| format!("join: {e}"))?
}

#[cfg(target_os = "windows")]
mod win {
    use super::ScreenshotResult;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, HGDIOBJ,
        SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN,
    };

    /// Grab the whole virtual screen (spanning all monitors) as top-down
    /// RGBA8. GDI hands back BGRX, which we swizzle to RGBA in place.
    fn capture_rgba() -> Result<(i32, i32, Vec<u8>), String> {
        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            if w <= 0 || h <= 0 {
                return Err("invalid virtual screen size".into());
            }

            let screen_dc = GetDC(HWND::default());
            if screen_dc.is_invalid() {
                return Err("GetDC failed".into());
            }
            let mem_dc = CreateCompatibleDC(screen_dc);
            let bmp = CreateCompatibleBitmap(screen_dc, w, h);
            let old = SelectObject(mem_dc, HGDIOBJ(bmp.0));

            let blt = BitBlt(mem_dc, 0, 0, w, h, screen_dc, x, y, SRCCOPY);

            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            bmi.bmiHeader.biWidth = w;
            bmi.bmiHeader.biHeight = -h; // negative height → top-down rows
            bmi.bmiHeader.biPlanes = 1;
            bmi.bmiHeader.biBitCount = 32;
            bmi.bmiHeader.biCompression = 0; // BI_RGB (uncompressed)

            let mut buf = vec![0u8; (w as usize) * (h as usize) * 4];
            let scanned = GetDIBits(
                mem_dc,
                bmp,
                0,
                h as u32,
                Some(buf.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );

            // Cleanup GDI objects regardless of outcome.
            SelectObject(mem_dc, old);
            let _ = DeleteObject(HGDIOBJ(bmp.0));
            let _ = DeleteDC(mem_dc);
            ReleaseDC(HWND::default(), screen_dc);

            if blt.is_err() {
                return Err("BitBlt failed".into());
            }
            if scanned == 0 {
                return Err("GetDIBits failed".into());
            }

            // BGRX → RGBA (GDI stores blue first; alpha byte is unused).
            for px in buf.chunks_exact_mut(4) {
                px.swap(0, 2);
                px[3] = 255;
            }
            Ok((w, h, buf))
        }
    }

    pub fn capture_blocking(to_clipboard: bool) -> Result<ScreenshotResult, String> {
        let (w, h, rgba) = capture_rgba()?;

        if to_clipboard {
            let mut cb = arboard::Clipboard::new().map_err(|e| format!("clipboard: {e}"))?;
            cb.set_image(arboard::ImageData {
                width: w as usize,
                height: h as usize,
                bytes: std::borrow::Cow::Owned(rgba),
            })
            .map_err(|e| format!("clipboard set_image: {e}"))?;
            Ok(ScreenshotResult {
                path: None,
                copied_to_clipboard: true,
                cancelled: false,
            })
        } else {
            let dir = dirs::desktop_dir().ok_or_else(|| "desktop dir unavailable".to_string())?;
            let stamp = chrono::Local::now().format("%Y-%m-%d %H.%M.%S");
            let p = dir.join(format!("Screenshot {stamp}.png"));
            let img = image::RgbaImage::from_raw(w as u32, h as u32, rgba)
                .ok_or_else(|| "image buffer size mismatch".to_string())?;
            img.save(&p).map_err(|e| format!("save png: {e}"))?;
            Ok(ScreenshotResult {
                path: Some(p.to_string_lossy().into_owned()),
                copied_to_clipboard: false,
                cancelled: false,
            })
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub async fn capture(_mode: &str, _destination: &str) -> Result<ScreenshotResult, String> {
    Err("screenshots are not supported on this platform".into())
}
