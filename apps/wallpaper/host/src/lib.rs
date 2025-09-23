use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use bevy::prelude::*;
use clap::Parser;
use eco_core::{EcoManifest, PortalRef};
use eco_render::EcoRenderPlugin;
use futures::{
    stream::{BoxStream, SelectAll},
    StreamExt,
};
use tokio::sync::mpsc;

pub mod platform;

/// Subjects that the wallpaper hosts subscribe to in order to receive
/// portal and world orchestration events.
const PORTAL_SUBJECTS: &[&str] = &["ethos.chat.*", "eco.action.*"];

/// CLI arguments shared by the platform specific binaries.
#[derive(Debug, Parser, Clone)]
#[command(
    name = "eco-wallpaper",
    author,
    version,
    about = "Project live Ether Computing portals onto desktop surfaces",
    long_about = None
)]
pub struct WallpaperArgs {
    /// Path to the ECO manifest that should be loaded to bootstrap the Bevy world.
    #[arg(long, env = "ECO_MANIFEST", value_name = "PATH")]
    pub manifest: PathBuf,

    /// Optional portal identifier that should be activated immediately on launch.
    #[arg(long, env = "ECO_PORTAL", value_name = "PORTAL_ID")]
    pub portal: Option<String>,

    /// Toggle OpenXR integration when available.
    #[arg(long, env = "ECO_ENABLE_OPENXR", default_value_t = false)]
    pub openxr: bool,

    /// SymbolCast service endpoint used for local agent assisted narration.
    #[arg(long, env = "SYMBOLCAST_URL", value_name = "URL")]
    pub symbolcast: Option<String>,

    /// Optional override for the agent service responsible for orchestrating portal actions.
    #[arg(long, env = "ECO_AGENT_SERVICE", value_name = "URL")]
    pub agent_service: Option<String>,

    /// URL of the NATS deployment that surfaces portal orchestration events.
    #[arg(long, env = "ECO_NATS_URL", default_value = "nats://127.0.0.1:4222")]
    pub nats_url: String,
}

/// Normalised runtime configuration derived from [`WallpaperArgs`].
#[derive(Debug, Clone)]
pub struct WallpaperConfig {
    manifest_path: PathBuf,
    portal: Option<String>,
    openxr: bool,
    symbolcast: Option<String>,
    agent_service: Option<String>,
    nats_url: String,
}

impl WallpaperConfig {
    pub fn manifest_path(&self) -> &PathBuf {
        &self.manifest_path
    }

    pub fn nats_url(&self) -> &str {
        &self.nats_url
    }

    pub fn portal(&self) -> Option<&str> {
        self.portal.as_deref()
    }

    pub fn openxr(&self) -> bool {
        self.openxr
    }

    pub fn symbolcast(&self) -> Option<&str> {
        self.symbolcast.as_deref()
    }

    pub fn agent_service(&self) -> Option<&str> {
        self.agent_service.as_deref()
    }
}

impl From<WallpaperArgs> for WallpaperConfig {
    fn from(value: WallpaperArgs) -> Self {
        WallpaperConfig {
            manifest_path: value.manifest,
            portal: value.portal,
            openxr: value.openxr,
            symbolcast: value.symbolcast,
            agent_service: value.agent_service,
            nats_url: value.nats_url,
        }
    }
}

/// Active portal metadata inserted into the Bevy world.
#[derive(Resource, Debug, Clone, Default, PartialEq, Eq)]
pub struct ActivePortal {
    pub id: String,
    pub target: String,
    pub kind: Option<String>,
}

impl From<&PortalRef> for ActivePortal {
    fn from(value: &PortalRef) -> Self {
        ActivePortal {
            id: value.id.clone(),
            target: value.target.clone(),
            kind: value.kind.clone(),
        }
    }
}

/// Resource tracking the currently streamed scene.
#[derive(Resource, Debug, Clone, Default, PartialEq, Eq)]
pub struct ActiveScene {
    pub scene: String,
}

/// Portal command broadcast by the orchestration layer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortalCommand {
    pub portal_id: String,
    pub subject: String,
}

/// Runtime orchestration handle that owns the loaded manifest and the
/// asynchronous NATS subscription.
#[derive(Debug)]
pub struct WallpaperRuntime {
    config: WallpaperConfig,
    manifest: Arc<EcoManifest>,
    portal_rx: mpsc::Receiver<PortalCommand>,
    nats_task: tokio::task::JoinHandle<()>,
}

impl WallpaperRuntime {
    /// Load the ECO manifest and start listening for portal commands.
    pub async fn new(config: WallpaperConfig) -> Result<Self> {
        let manifest_path = config.manifest_path.clone();
        let manifest = EcoManifest::load_from_path(&manifest_path)
            .with_context(|| format!("failed to load manifest at {}", manifest_path.display()))?;
        let manifest = Arc::new(manifest);

        let (tx, portal_rx) = mpsc::channel(64);
        let nats_url = config.nats_url.clone();
        let manifest_for_task = Arc::clone(&manifest);
        let config_for_task = config.clone();

        let nats_task = tokio::spawn(async move {
            if let Err(err) = stream_portal_commands(&nats_url, manifest_for_task, tx).await {
                tracing::warn!("nats-listener" = %err, "failed to stream portal commands");
            }
            drop(config_for_task);
        });

        Ok(WallpaperRuntime {
            config,
            manifest,
            portal_rx,
            nats_task,
        })
    }

    pub fn config(&self) -> &WallpaperConfig {
        &self.config
    }

    pub fn manifest(&self) -> &EcoManifest {
        &self.manifest
    }

    pub fn initial_portal(&self) -> Option<PortalRef> {
        if let Some(id) = self.config.portal() {
            self.manifest
                .portals
                .iter()
                .find(|portal| portal.id == id)
                .cloned()
        } else {
            self.manifest.portals.first().cloned()
        }
    }

    pub fn initial_portal_id(&self) -> Option<String> {
        self.initial_portal().map(|portal| portal.id)
    }

    pub fn build_app(&self) -> App {
        let mut app = App::new();
        app.add_plugins(MinimalPlugins);
        app.add_plugins(EcoRenderPlugin);
        app.insert_resource(ActiveScene {
            scene: self.manifest.entry_scene.clone(),
        });

        let active_portal = self
            .initial_portal()
            .map(|portal| ActivePortal::from(&portal))
            .unwrap_or_default();
        app.insert_resource(active_portal);

        app.add_systems(Update, portal_logger);
        app
    }

    pub async fn next_command(&mut self) -> Option<PortalCommand> {
        self.portal_rx.recv().await
    }

    pub fn apply_portal_to_app(&self, app: &mut App, portal_id: &str) -> bool {
        if let Some(portal) = self
            .manifest
            .portals
            .iter()
            .find(|candidate| candidate.id == portal_id)
        {
            let active_portal = ActivePortal::from(portal);
            if let Some(mut resource) = app.world.get_resource_mut::<ActivePortal>() {
                *resource = active_portal.clone();
            } else {
                app.world.insert_resource(active_portal.clone());
            }

            if let Some(mut active_scene) = app.world.get_resource_mut::<ActiveScene>() {
                active_scene.scene = portal.target.clone();
            } else {
                app.world.insert_resource(ActiveScene {
                    scene: portal.target.clone(),
                });
            }

            app.update();
            true
        } else {
            false
        }
    }
}

impl Drop for WallpaperRuntime {
    fn drop(&mut self) {
        self.nats_task.abort();
    }
}

async fn stream_portal_commands(
    url: &str,
    manifest: Arc<EcoManifest>,
    tx: mpsc::Sender<PortalCommand>,
) -> Result<()> {
    let client = async_nats::connect(url).await?;
    let mut streams: SelectAll<
        BoxStream<'static, (String, async_nats::Message, Arc<EcoManifest>)>,
    > = SelectAll::new();
    for subject in PORTAL_SUBJECTS {
        let subscription = client.subscribe(subject.to_string()).await?;
        let subject_owned = subject.to_string();
        let manifest_clone = Arc::clone(&manifest);
        let mapped: BoxStream<'static, (String, async_nats::Message, Arc<EcoManifest>)> =
            Box::pin(subscription.map(move |message| {
                let manifest = Arc::clone(&manifest_clone);
                (subject_owned.clone(), message, manifest)
            }));
        streams.push(mapped);
    }

    let tx = tx;
    while let Some((subject, message, manifest)) = streams.next().await {
        if let Some(command) =
            PortalCommand::from_message(&subject, &message.payload, manifest.as_ref())
        {
            if tx.send(command).await.is_err() {
                break;
            }
        }
    }

    Ok(())
}

impl PortalCommand {
    fn from_message(subject: &str, payload: &[u8], manifest: &EcoManifest) -> Option<Self> {
        let payload = parse_portal_payload(payload)?;
        let portal_id = payload;
        manifest
            .portals
            .iter()
            .find(|portal| portal.id == portal_id)
            .map(|_| PortalCommand {
                portal_id,
                subject: subject.to_string(),
            })
    }
}

fn parse_portal_payload(payload: &[u8]) -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Payload {
        #[serde(default)]
        portal: Option<String>,
        #[serde(default, alias = "portal_id")]
        portal_id: Option<String>,
        #[serde(default)]
        scene: Option<String>,
        #[serde(default)]
        world: Option<String>,
    }

    if payload.is_empty() {
        return None;
    }

    if let Ok(decoded) = serde_json::from_slice::<Payload>(payload) {
        decoded
            .portal
            .or(decoded.portal_id)
            .or(decoded.scene)
            .or(decoded.world)
    } else if let Ok(text) = std::str::from_utf8(payload) {
        let trimmed = text.trim();
        if let Some(rest) = trimmed.strip_prefix("portal:") {
            Some(rest.trim().to_string())
        } else if !trimmed.is_empty() {
            Some(trimmed.to_string())
        } else {
            None
        }
    } else {
        None
    }
}

fn portal_logger(portal: Res<ActivePortal>, scene: Res<ActiveScene>) {
    if portal.is_changed() {
        println!(
            "Activated portal '{}' targeting '{}' (scene: {})",
            portal.id, portal.target, scene.scene
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(any(
        feature = "smoke-windows",
        feature = "smoke-macos",
        feature = "smoke-wayland"
    ))]
    use std::process::Command;

    fn sample_manifest() -> EcoManifest {
        EcoManifest {
            name: "Aurora".into(),
            version: "0.1.0".into(),
            entry_scene: "aurora.scene".into(),
            portals: vec![PortalRef {
                id: "home".into(),
                target: "aurora://home".into(),
                kind: Some("world".into()),
            }],
            components: Vec::new(),
            symbolcast: Default::default(),
        }
    }

    #[test]
    fn parses_json_portal_events() {
        let manifest = sample_manifest();
        let payload = br#"{"portal":"home"}"#;
        let command = PortalCommand::from_message("ethos.chat.switch", payload, &manifest);
        assert!(command.is_some());
        assert_eq!(command.unwrap().portal_id, "home");
    }

    #[test]
    fn parses_plain_text_portal_events() {
        let manifest = sample_manifest();
        let payload = b"portal:home";
        let command = PortalCommand::from_message("eco.action", payload, &manifest);
        assert!(command.is_some());
        assert_eq!(command.unwrap().portal_id, "home");
    }

    #[test]
    fn ignores_unknown_portals() {
        let manifest = sample_manifest();
        let payload = br#"{"portal":"unknown"}"#;
        let command = PortalCommand::from_message("ethos.chat.switch", payload, &manifest);
        assert!(command.is_none());
    }

    #[tokio::test]
    async fn applies_portal_to_bevy_world() {
        let manifest = sample_manifest();
        let config = WallpaperConfig {
            manifest_path: PathBuf::from("/tmp/manifest.toml"),
            portal: None,
            openxr: false,
            symbolcast: None,
            agent_service: None,
            nats_url: "nats://localhost:4222".into(),
        };

        let runtime = WallpaperRuntime {
            config,
            manifest: Arc::new(manifest),
            portal_rx: mpsc::channel(1).1,
            nats_task: tokio::spawn(async {}),
        };

        let mut app = runtime.build_app();
        assert!(runtime.apply_portal_to_app(&mut app, "home"));
        let active = app.world.resource::<ActivePortal>();
        assert_eq!(active.id, "home");
    }

    #[cfg(any(
        feature = "smoke-windows",
        feature = "smoke-macos",
        feature = "smoke-wayland"
    ))]
    fn cargo() -> Command {
        let mut cmd = Command::new(std::env::var("CARGO").unwrap_or_else(|_| "cargo".into()));
        cmd.current_dir(env!("CARGO_MANIFEST_DIR"));
        cmd
    }

    #[cfg(feature = "smoke-windows")]
    #[test]
    fn windows_host_builds() {
        let status = cargo()
            .args(["check", "--bin", "windows"])
            .status()
            .expect("failed to invoke cargo");
        assert!(status.success());
    }

    #[cfg(feature = "smoke-macos")]
    #[test]
    fn macos_host_builds() {
        let status = cargo()
            .args(["check", "--bin", "macos"])
            .status()
            .expect("failed to invoke cargo");
        assert!(status.success());
    }

    #[cfg(feature = "smoke-wayland")]
    #[test]
    fn wayland_host_builds() {
        let status = cargo()
            .args(["check", "--bin", "wayland"])
            .status()
            .expect("failed to invoke cargo");
        assert!(status.success());
    }
}
