use bevy::prelude::*;

/// Simple plugin wiring ambient lighting and a placeholder camera.
pub struct EcoRenderPlugin;

impl Plugin for EcoRenderPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, setup_scene);
    }
}

fn setup_scene(mut commands: Commands) {
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(0.0, 4.0, 8.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..Default::default()
    });

    commands.spawn(PointLightBundle {
        transform: Transform::from_xyz(4.0, 8.0, 4.0),
        point_light: PointLight {
            intensity: 4500.0,
            color: Color::rgb(0.4, 0.8, 1.0),
            shadows_enabled: true,
            ..Default::default()
        },
        ..Default::default()
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plugin_registers() {
        let mut app = App::new();
        app.add_plugins(MinimalPlugins);
        app.add_plugins(EcoRenderPlugin);
        app.update();
    }
}
