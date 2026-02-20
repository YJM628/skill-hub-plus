// File operations commands
#[tauri::command]
pub async fn save_file_with_dialog(
    app: tauri::AppHandle,
    content: String,
    default_filename: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // Use async channel for dialog result
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    app.dialog()
        .file()
        .add_filter("Markdown Files", &["md"])
        .add_filter("Text Files", &["txt"])
        .add_filter("All Files", &["*"])
        .set_title("Save Documentation")
        .set_file_name(&default_filename)
        .save_file(move |result| {
            let _ = tx.send(result);
        });
    
    match rx.await {
        Ok(Some(path)) => {
            use std::path::Path;
            std::fs::write(Path::new(&path.to_string()), &content)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(path.to_string())
        }
        Ok(None) => Err("User cancelled the save dialog".to_string()),
        Err(_) => Err("Failed to receive dialog result".to_string()),
    }
}

#[tauri::command]
pub async fn select_directory_dialog(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // Use async channel for dialog result
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    app.dialog()
        .file()
        .set_title("Select Working Directory")
        .pick_folder(move |result| {
            let _ = tx.send(result);
        });
    
    match rx.await {
        Ok(Some(path)) => Ok(path.to_string()),
        Ok(None) => Err("User cancelled the directory selection".to_string()),
        Err(_) => Err("Failed to receive dialog result".to_string()),
    }
}