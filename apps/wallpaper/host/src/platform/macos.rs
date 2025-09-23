use crate::WallpaperRuntime;

#[cfg(target_os = "macos")]
use anyhow::Result;
#[cfg(target_os = "macos")]
use metal::{MTLPixelFormat, MetalLayer};
#[cfg(target_os = "macos")]
use objc::runtime::Object;
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};

#[cfg(target_os = "macos")]
#[derive(Debug)]
pub struct MacOsHost {
    layer: MetalLayer,
    metal_view: *mut Object,
}

#[cfg(target_os = "macos")]
impl MacOsHost {
    pub fn new() -> Result<Self> {
        let layer = MetalLayer::new();
        layer.set_pixel_format(MTLPixelFormat::BGRA8Unorm);
        layer.set_presents_with_transaction(false);
        layer.set_display_sync_enabled(true);

        // Create a lightweight NSView wrapper that we can embed into the desktop spaces APIs.
        let metal_view = unsafe {
            let view: *mut Object = msg_send![class!(NSView), new];
            let () = msg_send![view, setLayer: &*layer];
            let () = msg_send![view, setWantsLayer: true];
            view
        };

        Ok(Self { layer, metal_view })
    }

    pub async fn run(mut self, mut runtime: WallpaperRuntime) -> Result<()> {
        tracing::info!("macos.layer.pixel_format" = ?self.layer.pixel_format(), "initialising macOS wallpaper host");
        let mut app = runtime.build_app();
        if let Some(initial) = runtime.initial_portal_id() {
            runtime.apply_portal_to_app(&mut app, &initial);
        }

        while let Some(command) = runtime.next_command().await {
            tracing::debug!("macos.portal" = %command.portal_id, "subject" = %command.subject, "applying portal from macOS host");
            runtime.apply_portal_to_app(&mut app, &command.portal_id);
        }

        Ok(())
    }
}

#[cfg(target_os = "macos")]
impl Drop for MacOsHost {
    fn drop(&mut self) {
        unsafe {
            let () = msg_send![self.metal_view, release];
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[derive(Debug, Default)]
pub struct MacOsHost;

#[cfg(not(target_os = "macos"))]
impl MacOsHost {
    pub fn new() -> anyhow::Result<Self> {
        anyhow::bail!("macOS wallpaper host is only available on macOS targets");
    }

    pub async fn run(self, _runtime: WallpaperRuntime) -> anyhow::Result<()> {
        anyhow::bail!("macOS wallpaper host can only execute on macOS");
    }
}
