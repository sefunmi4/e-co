#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod commands;
mod core;
mod ui;

use std::sync::Arc;

use app_state::AppState;
use parking_lot::Mutex;
use tauri::Manager;

fn spawn_bevy_runtime(app_state: Arc<Mutex<AppState>>) {
    std::thread::spawn(move || {
        use bevy::prelude::*;

        struct AppStateResource(Arc<Mutex<AppState>>);

        fn setup(mut commands: Commands) {
            commands.spawn(Camera3dBundle::default());
        }

        let mut app = App::new();
        app.insert_resource(AppStateResource(app_state))
            .add_plugins(DefaultPlugins.set(WindowPlugin {
                primary_window: Some(Window {
                    title: "Ether Net".into(),
                    ..Default::default()
                }),
                ..Default::default()
            }))
            .add_systems(Startup, setup);

        app.run();
    });
}

fn main() {
    dotenvy::dotenv().ok();

    let eco_api_url =
        std::env::var("ECO_API_URL").unwrap_or_else(|_| "http://localhost:4000".into());
    let gateway_url =
        std::env::var("GATEWAY_URL").unwrap_or_else(|_| "http://localhost:3001".into());

    let state = Arc::new(Mutex::new(AppState::new(eco_api_url, gateway_url)));
    spawn_bevy_runtime(state.clone());

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::search_worlds,
            commands::teleport_to,
            commands::toggle_artifact_visibility,
            commands::invite_friend,
            commands::join_session
        ])
        .setup(|app| {
            let handle = app.handle();
            handle.get_window("main").map(|w| w.set_title("Ether Net"));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running Ether Net");
}
