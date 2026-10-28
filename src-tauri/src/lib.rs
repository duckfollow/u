use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};
use tokio::sync::oneshot;
#[derive(Default)]
struct Running(Mutex<HashMap<String, oneshot::Sender<()>>>);
#[derive(Deserialize)]
struct Request {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Response {
    status: u16,
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
    duration: u128,
    size: usize,
}
fn demo(request: &Request) -> Option<Result<Response, String>> {
    let url = reqwest::Url::parse(&request.url).ok()?;
    if url.host_str() != Some("demo.u.local") {
        return None;
    }
    let (status, value) = match url.path() {
        "/api/demo/login" => (
            200,
            json!({"token":"u-demo-token","user":{"id":1,"name":"Tony Stark"}}),
        ),
        "/api/demo/projects" => {
            let authorized = request.headers.iter().any(|(key, value)| {
                key.eq_ignore_ascii_case("authorization") && value == "Bearer u-demo-token"
            });
            if authorized {
                (
                    200,
                    json!({"projects":[{"id":1,"name":"Mark VII","status":"active"},{"id":2,"name":"House Party","status":"ready"}]}),
                )
            } else {
                (401, json!({"error":"Use the demo login token"}))
            }
        }
        _ => (404, json!({"error":"Demo endpoint not found"})),
    };
    let body = value.to_string();
    Some(Ok(Response {
        status,
        status_text: if status == 200 {
            "OK"
        } else if status == 401 {
            "Unauthorized"
        } else {
            "Not Found"
        }
        .into(),
        headers: HashMap::from([("content-type".into(), "application/json".into())]),
        size: body.len(),
        body,
        duration: 0,
    }))
}
async fn perform(request: Request) -> Result<Response, String> {
    if request.body.len() > 2_000_000 {
        return Err("Request exceeds 2 MB".into());
    }
    let url = reqwest::Url::parse(&request.url).map_err(|_| "Invalid request URL")?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Use an HTTP(S) URL without embedded credentials".into());
    }
    if let Some(result) = demo(&request) {
        return result;
    }
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| "Invalid HTTP method")?;
    if !["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
        .contains(&request.method.as_str())
    {
        return Err("Unsupported HTTP method".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| e.to_string())?;
    let mut builder = client.request(method, url);
    for (key, value) in request.headers {
        builder = builder.header(key, value)
    }
    if !["GET", "HEAD"].contains(&request.method.as_str()) && !request.body.is_empty() {
        builder = builder.body(request.body)
    }
    let start = Instant::now();
    let mut response = builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status();
    let headers = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if bytes.len() + chunk.len() > 5_000_000 {
            return Err("Response exceeds 5 MB".into());
        }
        bytes.extend_from_slice(&chunk)
    }
    Ok(Response {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").into(),
        headers,
        size: bytes.len(),
        body: String::from_utf8_lossy(&bytes).into_owned(),
        duration: start.elapsed().as_millis(),
    })
}
#[tauri::command]
async fn http_request(
    id: String,
    request: Request,
    state: tauri::State<'_, Running>,
) -> Result<Response, String> {
    let (tx, rx) = oneshot::channel();
    state
        .0
        .lock()
        .map_err(|_| "Request state unavailable")?
        .insert(id.clone(), tx);
    let result =
        tokio::select! {result=perform(request)=>result,_=rx=>Err("Request cancelled".into())};
    state
        .0
        .lock()
        .map_err(|_| "Request state unavailable")?
        .remove(&id);
    result
}
#[tauri::command]
fn cancel_request(id: String, state: tauri::State<'_, Running>) {
    if let Ok(mut entries) = state.0.lock() {
        if let Some(cancel) = entries.remove(&id) {
            let _ = cancel.send(());
        }
    }
}
#[tauri::command]
fn update_status() -> Value {
    json!({"running":false,"phase":"idle","currentVersion":env!("CARGO_PKG_VERSION"),"repository":"duckfollow/u","runtime":"desktop"})
}
#[tauri::command]
async fn check_update() -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .user_agent("u-api-studio")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = client
        .get("https://api.github.com/repos/duckfollow/u/releases/latest")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let mut result = update_status();
    result["checkedAt"] = json!(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis());
    // JavaScript accepts a numeric timestamp in the same format as Date.now().
    if response.status().as_u16() == 404 {
        result["state"] = json!("no-release");
        result["reason"] = json!("No public stable release was found.");
        return Ok(result);
    }
    if !response.status().is_success() {
        return Err(format!(
            "GitHub update check failed ({}). Try again later.",
            response.status()
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        if bytes.len() + chunk.len() > 4_000_000 {
            return Err("Release information is too large".into());
        }
        bytes.extend_from_slice(&chunk)
    }
    let release: Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let tag = release["tag_name"].as_str().ok_or("Invalid release tag")?;
    let latest = Version::parse(tag.strip_prefix('v').unwrap_or(tag))
        .map_err(|_| "Invalid release version")?;
    if release["prerelease"] == true || release["draft"] == true || !latest.pre.is_empty() {
        return Err("A stable release is required".into());
    }
    let current = Version::parse(env!("CARGO_PKG_VERSION")).map_err(|e| e.to_string())?;
    result["state"] = json!(if latest > current {
        "available"
    } else {
        "up-to-date"
    });
    result["ready"] = json!(false);
    result["latestVersion"] = json!(latest.to_string());
    result["tag"] = json!(tag);
    result["notes"] = json!(release["body"].as_str().unwrap_or(""));
    result["releaseUrl"] = json!(format!(
        "https://github.com/duckfollow/u/releases/tag/{tag}"
    ));
    if latest > current {
        result["reason"] =
            json!("Download the macOS DMG, quit u, and replace the app in Applications.")
    }
    Ok(result)
}
#[tauri::command]
async fn open_release_page(url: String) -> Result<(), String> {
    let tag = url
        .strip_prefix("https://github.com/duckfollow/u/releases/tag/")
        .ok_or("Invalid release URL")?;
    Version::parse(tag.strip_prefix('v').unwrap_or(tag)).map_err(|_| "Invalid release tag")?;
    tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new("open")
            .arg(url)
            .status()
            .map_err(|e| e.to_string())
            .and_then(|s| {
                if s.success() {
                    Ok(())
                } else {
                    Err("Could not open browser".into())
                }
            })
    })
    .await
    .map_err(|e| e.to_string())?
}
pub fn run() {
    tauri::Builder::default()
        .manage(Running::default())
        .invoke_handler(tauri::generate_handler![
            http_request,
            cancel_request,
            update_status,
            check_update,
            open_release_page
        ])
        .run(tauri::generate_context!())
        .expect("Could not launch u");
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn demo_login_and_authenticated_projects() {
        let login = perform(Request {
            url: "https://demo.u.local/api/demo/login".into(),
            method: "POST".into(),
            headers: HashMap::new(),
            body: "{}".into(),
        })
        .await
        .unwrap();
        assert_eq!(login.status, 200);
        let token: Value = serde_json::from_str(&login.body).unwrap();
        let projects = perform(Request {
            url: "https://demo.u.local/api/demo/projects".into(),
            method: "GET".into(),
            headers: HashMap::from([(
                "Authorization".into(),
                format!("Bearer {}", token["token"].as_str().unwrap()),
            )]),
            body: String::new(),
        })
        .await
        .unwrap();
        let body: Value = serde_json::from_str(&projects.body).unwrap();
        assert_eq!(body["projects"].as_array().unwrap().len(), 2)
    }
    #[tokio::test]
    async fn invalid_urls_and_request_size_are_rejected() {
        assert!(perform(Request {
            url: "file:///etc/passwd".into(),
            method: "GET".into(),
            headers: HashMap::new(),
            body: String::new()
        })
        .await
        .is_err());
        assert!(perform(Request {
            url: "https://demo.u.local/api/demo/login".into(),
            method: "POST".into(),
            headers: HashMap::new(),
            body: "x".repeat(2_000_001)
        })
        .await
        .is_err());
    }
}

#[cfg(test)]
mod http_tests {
    use super::*;
    use std::io::{BufRead, BufReader, Read, Write};
    #[tokio::test]
    async fn real_http_preserves_headers_and_json_body() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            let mut headers = String::new();
            let mut length = 0;
            loop {
                line.clear();
                reader.read_line(&mut line).unwrap();
                if line == "\r\n" {
                    break;
                }
                if line.to_lowercase().starts_with("content-length:") {
                    length = line
                        .split(':')
                        .nth(1)
                        .unwrap()
                        .trim()
                        .parse::<usize>()
                        .unwrap()
                }
                headers.push_str(&line)
            }
            let mut body = vec![0; length];
            reader.read_exact(&mut body).unwrap();
            assert!(headers.starts_with("POST /echo HTTP/1.1"));
            assert!(headers.to_lowercase().contains("x-u-test: yes"));
            assert_eq!(body, b"{\"round\":3}");
            let output = b"{\"ok\":true}";
            write!(stream,"HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",output.len()).unwrap();
            stream.write_all(output).unwrap();
        });
        let response = perform(Request {
            url: format!("http://127.0.0.1:{port}/echo"),
            method: "POST".into(),
            headers: HashMap::from([("X-U-Test".into(), "yes".into())]),
            body: "{\"round\":3}".into(),
        })
        .await
        .unwrap();
        assert_eq!(response.status, 201);
        assert_eq!(response.body, "{\"ok\":true}");
        server.join().unwrap();
    }
}
