#[cfg(target_os = "linux")]
use anyhow::Result;
#[cfg(target_os = "linux")]
use clap::Parser;
#[cfg(target_os = "linux")]
use wallpaper_host::{
    platform::wayland::WaylandHost, WallpaperArgs, WallpaperConfig, WallpaperRuntime,
};

#[cfg(target_os = "linux")]
#[tokio::main]
async fn main() -> Result<()> {
    let args = WallpaperArgs::parse();
    let config = WallpaperConfig::from(args);
    let runtime = WallpaperRuntime::new(config).await?;
    let host = WaylandHost::new()?;
    host.run(runtime).await
}

#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("The Wayland wallpaper host can only be compiled on Linux targets.");
}
