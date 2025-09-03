// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::env;
use dotenvy::dotenv;

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[tauri::command]
async fn generate_response(user_message: String) -> Result<String, String> {
    dotenv().ok();
    let api_key = env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY not found in environment variables".to_string())?;

    println!("Received message: {}", user_message);
    println!("Using API key: {}...", &api_key[..20]); // Log first 20 chars for debug

    let client = reqwest::Client::new();

    let request_body = OpenAIRequest {
        model: "gpt-4o-mini".to_string(),
        messages: vec![
            OpenAIMessage {
                role: "system".to_string(),
                content: "You are a friendly desktop robot assistant. Respond to the user's message and determine the appropriate emotion for your response. At the end of your response, add a single word indicating the emotion: [happy], [sad], [surprised], [thinking], [excited], [confused], or [neutral]. Keep responses concise and friendly.".to_string(),
            },
            OpenAIMessage {
                role: "user".to_string(),
                content: user_message,
            },
        ],
        temperature: 0.7,
        max_tokens: 150,
    };

    println!("Sending request to OpenAI...");
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    println!("Response status: {}", response.status());
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        println!("API error response: {}", error_text);
        return Err(format!("OpenAI API error: {}", error_text));
    }

    let openai_response: OpenAIResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(choice) = openai_response.choices.first() {
        let content = &choice.message.content;
        println!("Received content: {}", content);
        Ok(content.clone())
    } else {
        Err("No response from OpenAI".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![generate_response])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
