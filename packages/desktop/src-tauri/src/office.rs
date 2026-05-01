use serde::Serialize;
use specta::Type;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tokio::process::Command;

#[derive(Clone, Debug, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct OfficeImage {
    path: String,
    name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|err| format!("读取文件失败：{err}"))
}

#[tauri::command]
#[specta::specta]
pub async fn convert_pptx_to_images(path: String) -> Result<Vec<OfficeImage>, String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err(format!("PPTX 文件不存在：{path}"));
    }

    let dir = temp_dir("pptx")?;
    run_office(&src, &dir, "png").await?;

    let mut images = fs::read_dir(&dir)
        .map_err(|err| format!("读取 PPTX 缩略图失败：{err}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| extension(path) == "png")
        .map(|path| OfficeImage {
            name: path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("slide.png")
                .to_string(),
            path: path.to_string_lossy().to_string(),
        })
        .collect::<Vec<_>>();
    images.sort_by(|a, b| a.name.cmp(&b.name));

    if images.is_empty() {
        return Err("PPTX 转换未生成缩略图，请确认本机 LibreOffice 支持 PNG 导出。".to_string());
    }

    Ok(images)
}

#[tauri::command]
#[specta::specta]
pub async fn convert_sheet_to_csv(path: String) -> Result<String, String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err(format!("表格文件不存在：{path}"));
    }

    let dir = temp_dir("sheet")?;
    run_office(&src, &dir, "csv").await?;

    let csv = fs::read_dir(&dir)
        .map_err(|err| format!("读取表格 CSV 失败：{err}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| extension(path) == "csv")
        .ok_or_else(|| "表格转换未生成 CSV，请确认本机 LibreOffice 支持表格导出。".to_string())?;

    fs::read_to_string(&csv).map_err(|err| format!("读取表格 CSV 失败：{err}"))
}

#[tauri::command]
#[specta::specta]
pub async fn convert_docx_to_html(path: String) -> Result<String, String> {
    let src = PathBuf::from(&path);
    if !src.exists() {
        return Err(format!("DOCX 文件不存在：{path}"));
    }

    let dir = temp_dir("docx")?;
    run_office(&src, &dir, "html").await?;

    let html = fs::read_dir(&dir)
        .map_err(|err| format!("读取 DOCX HTML 失败：{err}"))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| extension(path) == "html")
        .ok_or_else(|| {
            "DOCX 转换未生成 HTML，请确认本机 LibreOffice 支持 HTML 导出。".to_string()
        })?;

    fs::read_to_string(&html).map_err(|err| format!("读取 DOCX HTML 失败：{err}"))
}

fn temp_dir(kind: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join(format!("railwise-{kind}-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&dir).map_err(|err| format!("创建临时目录失败：{err}"))?;
    Ok(dir)
}

async fn run_office(src: &Path, dir: &Path, format: &str) -> Result<(), String> {
    let mut errors = Vec::new();

    for bin in ["libreoffice", "soffice"] {
        let output = Command::new(bin)
            .arg("--headless")
            .arg("--convert-to")
            .arg(format)
            .arg("--outdir")
            .arg(dir)
            .arg(src)
            .output()
            .await;

        let Ok(output) = output else {
            errors.push(format!("{bin}: 未找到或无法启动"));
            continue;
        };

        if output.status.success() {
            return Ok(());
        }

        errors.push(format!(
            "{bin}: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    Err(format!(
        "Office 转换失败。请安装 LibreOffice 后重试。{}",
        errors.join("；")
    ))
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_text_file_returns_file_contents() {
        let path = std::env::temp_dir().join(format!("railwise-text-{}.txt", uuid::Uuid::new_v4()));
        fs::write(&path, "RAILWISE native file smoke").expect("write file");

        let content =
            futures::executor::block_on(read_text_file(path.to_string_lossy().to_string()))
                .expect("read text file");

        assert_eq!(content, "RAILWISE native file smoke");
        let _ = fs::remove_file(path);
    }

    #[test]
    fn read_text_file_reports_missing_path() {
        let path =
            std::env::temp_dir().join(format!("railwise-missing-{}.txt", uuid::Uuid::new_v4()));
        let err = futures::executor::block_on(read_text_file(path.to_string_lossy().to_string()))
            .expect_err("missing path should fail");

        assert!(err.contains("读取文件失败"));
    }

    #[test]
    fn extension_is_case_insensitive() {
        assert_eq!(extension(Path::new("survey.CSV")), "csv");
        assert_eq!(extension(Path::new("drawing.DXF")), "dxf");
        assert_eq!(extension(Path::new("no-extension")), "");
    }
}
