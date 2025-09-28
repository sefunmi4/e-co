#[cfg(target_os = "windows")]
use anyhow::Result;
#[cfg(target_os = "windows")]
use clap::Parser;
#[cfg(target_os = "windows")]
use wallpaper_host::{
    platform::windows::WindowsHost, WallpaperArgs, WallpaperConfig, WallpaperRuntime,
};

#[cfg(target_os = "windows")]
#[tokio::main]
async fn main() -> Result<()> {
    let args = WallpaperArgs::parse();
    let config = WallpaperConfig::from(args);
    let runtime = WallpaperRuntime::new(config).await?;
    let host = WindowsHost::new()?;
    host.run(runtime).await
}

#[cfg(not(target_os = "windows"))]
fn main() {
    eprintln!("The Windows wallpaper host can only be compiled on Windows targets.");
}
