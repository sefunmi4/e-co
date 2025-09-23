use crate::WallpaperRuntime;

#[cfg(target_os = "linux")]
use anyhow::{Context, Result};
#[cfg(target_os = "linux")]
use smithay_client_toolkit::{
    compositor::{CompositorHandler, CompositorState},
    delegate_compositor, delegate_layer, delegate_output, delegate_registry,
    output::{OutputHandler, OutputState},
    registry::{ProvidesRegistryState, RegistryState},
    registry_handlers,
    shell::{
        wlr_layer::{
            Anchor, KeyboardInteractivity, Layer, LayerShell, LayerShellHandler, LayerSurface,
            LayerSurfaceConfigure,
        },
        WaylandSurface,
    },
};
#[cfg(target_os = "linux")]
use wayland_client::{globals::registry_queue_init, Connection, QueueHandle};

#[cfg(target_os = "linux")]
#[derive(Debug)]
pub struct WaylandHost {
    anchors: Anchor,
}

#[cfg(target_os = "linux")]
impl WaylandHost {
    pub fn new() -> Result<Self> {
        Ok(Self {
            anchors: Anchor::TOP | Anchor::BOTTOM | Anchor::LEFT | Anchor::RIGHT,
        })
    }

    pub async fn run(self, mut runtime: WallpaperRuntime) -> Result<()> {
        let connection = Connection::connect_to_env().context("connect to Wayland compositor")?;
        let (globals, mut event_queue) = registry_queue_init(&connection)?;
        let qh = event_queue.handle();

        let compositor = CompositorState::bind(&globals, &qh)?;
        let layer_shell = LayerShell::bind(&globals, &qh)?;

        let surface = compositor.create_surface(&qh);
        let layer_surface = layer_shell.create_layer_surface(
            &qh,
            surface,
            Layer::Background,
            Some("eco-wallpaper"),
            None,
        );
        layer_surface.set_anchor(self.anchors);
        layer_surface.set_keyboard_interactivity(KeyboardInteractivity::None);
        layer_surface.set_exclusive_zone(-1);
        layer_surface.commit();

        let mut state = LayerRuntimeState::new(&globals, &qh, compositor, layer_surface);
        // Pump one configure so that the layer is mapped before we start processing portals.
        event_queue.dispatch_pending(&mut state)?;

        drop(state);
        drop(event_queue);
        drop(connection);

        let mut app = runtime.build_app();
        if let Some(initial) = runtime.initial_portal_id() {
            runtime.apply_portal_to_app(&mut app, &initial);
        }

        while let Some(command) = runtime.next_command().await {
            tracing::debug!("wayland.portal" = %command.portal_id, "subject" = %command.subject, "applying portal from Wayland host");
            runtime.apply_portal_to_app(&mut app, &command.portal_id);
        }

        Ok(())
    }
}

#[cfg(target_os = "linux")]
struct LayerRuntimeState {
    registry_state: RegistryState,
    _compositor_state: CompositorState,
    _layer_surface: LayerSurface,
    mapped: bool,
    closed: bool,
    output_state: OutputState,
}

#[cfg(target_os = "linux")]
impl LayerRuntimeState {
    fn new(
        globals: &smithay_client_toolkit::reexports::client::globals::GlobalList,
        qh: &QueueHandle<Self>,
        compositor_state: CompositorState,
        layer_surface: LayerSurface,
    ) -> Self {
        Self {
            registry_state: RegistryState::new(globals),
            _compositor_state: compositor_state,
            _layer_surface: layer_surface,
            mapped: false,
            closed: false,
            output_state: OutputState::new(globals, qh),
        }
    }
}

#[cfg(target_os = "linux")]
impl ProvidesRegistryState for LayerRuntimeState {
    fn registry(&mut self) -> &mut RegistryState {
        &mut self.registry_state
    }

    registry_handlers![OutputState];
}

#[cfg(target_os = "linux")]
impl CompositorHandler for LayerRuntimeState {
    fn scale_factor_changed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wayland_client::protocol::wl_surface::WlSurface,
        _new_factor: i32,
    ) {
    }

    fn transform_changed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wayland_client::protocol::wl_surface::WlSurface,
        _new_transform: wayland_client::protocol::wl_output::Transform,
    ) {
    }

    fn frame(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _surface: &wayland_client::protocol::wl_surface::WlSurface,
        _time: u32,
    ) {
    }
}

#[cfg(target_os = "linux")]
impl LayerShellHandler for LayerRuntimeState {
    fn closed(&mut self, _conn: &Connection, _qh: &QueueHandle<Self>, _layer: &LayerSurface) {
        self.closed = true;
    }

    fn configure(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        layer: &LayerSurface,
        configure: LayerSurfaceConfigure,
        _serial: u32,
    ) {
        let (width, height) = configure.new_size;
        if width > 0 && height > 0 {
            layer.set_size(width, height);
        }
        layer.commit();
        self.mapped = true;
    }
}

#[cfg(target_os = "linux")]
impl OutputHandler for LayerRuntimeState {
    fn output_state(&mut self) -> &mut OutputState {
        &mut self.output_state
    }

    fn new_output(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _output: wayland_client::protocol::wl_output::WlOutput,
    ) {
    }

    fn update_output(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _output: wayland_client::protocol::wl_output::WlOutput,
    ) {
    }

    fn output_destroyed(
        &mut self,
        _conn: &Connection,
        _qh: &QueueHandle<Self>,
        _output: wayland_client::protocol::wl_output::WlOutput,
    ) {
    }
}

#[cfg(target_os = "linux")]
delegate_compositor!(LayerRuntimeState);
#[cfg(target_os = "linux")]
delegate_layer!(LayerRuntimeState);
#[cfg(target_os = "linux")]
delegate_registry!(LayerRuntimeState);
#[cfg(target_os = "linux")]
delegate_output!(LayerRuntimeState);

#[cfg(not(target_os = "linux"))]
#[derive(Debug, Default)]
pub struct WaylandHost;

#[cfg(not(target_os = "linux"))]
impl WaylandHost {
    pub fn new() -> anyhow::Result<Self> {
        anyhow::bail!("Wayland wallpaper host is only available on Linux targets");
    }

    pub async fn run(self, _runtime: WallpaperRuntime) -> anyhow::Result<()> {
        anyhow::bail!("Wayland wallpaper host can only execute on Linux");
    }
}
