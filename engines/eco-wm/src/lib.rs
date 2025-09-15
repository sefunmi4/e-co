use smithay::backend::winit::{init_logger, EventLoop};
use smithay::reexports::calloop::EventLoop as Calloop;
use smithay::wayland::compositor::CompositorState;
use tracing::{info, Level};

pub struct WindowManager {
    compositor: CompositorState,
}

impl WindowManager {
    pub fn new() -> Self {
        init_logger(Level::INFO);
        Self {
            compositor: CompositorState::new(),
        }
    }

    pub fn run(mut self) {
        let mut event_loop: EventLoop<()> = EventLoop::new();
        let mut calloop = Calloop::<()>::try_new().expect("create calloop");
        info!("eco-wm event loop initialised");
        let _ = self.compositor; // placeholder to avoid unused field warning
        let _ = (&mut event_loop, &mut calloop);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wm_bootstraps() {
        let wm = WindowManager::new();
        wm.run();
    }
}
