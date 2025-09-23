#[cfg(target_os = "macos")]
use anyhow::Result;
#[cfg(target_os = "macos")]
use clap::Parser;
#[cfg(target_os = "macos")]
use wallpaper_host::{
    platform::macos::MacOsHost, WallpaperArgs, WallpaperConfig, WallpaperRuntime,
};

#[cfg(target_os = "macos")]
#[tokio::main]
async fn main() -> Result<()> {
    let args = WallpaperArgs::parse();
    let config = WallpaperConfig::from(args);
    let runtime = WallpaperRuntime::new(config).await?;
    let host = MacOsHost::new()?;
    host.run(runtime).await
}

#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("The macOS wallpaper host can only be compiled on macOS targets.");
}
