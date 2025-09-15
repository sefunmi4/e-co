# Wallpaper Host

The wallpaper host reuses the Bevy renderer to project live scenes as wallpapers on macOS, Windows, and Wayland. Each platform will expose a thin host harness that listens to NATS for portal changes and streams frame textures into the compositor layer.
