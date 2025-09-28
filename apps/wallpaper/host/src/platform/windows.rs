use crate::WallpaperRuntime;

#[cfg(target_os = "windows")]
use anyhow::Result;
#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{BOOL, HWND},
    Graphics::{
        Direct3D12::D3D12_FEATURE_DATA_D3D12_OPTIONS,
        Dxgi::{Common::*, DXGI_SWAP_CHAIN_DESC1},
    },
};

#[cfg(target_os = "windows")]
#[derive(Debug)]
pub struct WindowsHost {
    hwnd: HWND,
    swap_chain_desc: DXGI_SWAP_CHAIN_DESC1,
}

#[cfg(target_os = "windows")]
impl WindowsHost {
    pub fn new() -> Result<Self> {
        let swap_chain_desc = DXGI_SWAP_CHAIN_DESC1 {
            Width: 0,
            Height: 0,
            Format: DXGI_FORMAT_R8G8B8A8_UNORM,
            Stereo: BOOL(0),
            SampleDesc: DXGI_SAMPLE_DESC {
                Count: 1,
                Quality: 0,
            },
            BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
            BufferCount: 2,
            Scaling: DXGI_SCALING_STRETCH,
            SwapEffect: DXGI_SWAP_EFFECT_FLIP_DISCARD,
            AlphaMode: DXGI_ALPHA_MODE_IGNORE,
            Flags: 0,
        };

        // Touch the D3D12 options struct so that the crate pulls in the swapchain constants we need.
        let _options = D3D12_FEATURE_DATA_D3D12_OPTIONS::default();

        Ok(Self {
            hwnd: HWND(0),
            swap_chain_desc,
        })
    }

    pub fn swap_chain_desc(&self) -> &DXGI_SWAP_CHAIN_DESC1 {
        &self.swap_chain_desc
    }

    pub async fn run(mut self, mut runtime: WallpaperRuntime) -> Result<()> {
        tracing::info!(
            "windows.swapchain.width" = self.swap_chain_desc.Width,
            "windows.swapchain.height" = self.swap_chain_desc.Height,
            "initialising Windows wallpaper host"
        );
        let mut app = runtime.build_app();
        if let Some(initial) = runtime.initial_portal_id() {
            runtime.apply_portal_to_app(&mut app, &initial);
        }

        while let Some(command) = runtime.next_command().await {
            tracing::debug!("windows.portal" = %command.portal_id, "subject" = %command.subject, "applying portal from Windows host");
            runtime.apply_portal_to_app(&mut app, &command.portal_id);
        }

        let _ = self.hwnd;
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
#[derive(Debug, Default)]
pub struct WindowsHost;

#[cfg(not(target_os = "windows"))]
impl WindowsHost {
    pub fn new() -> anyhow::Result<Self> {
        anyhow::bail!("Windows wallpaper host is only available on Windows targets");
    }

    pub async fn run(self, _runtime: WallpaperRuntime) -> anyhow::Result<()> {
        anyhow::bail!("Windows wallpaper host can only execute on Windows");
    }
}
