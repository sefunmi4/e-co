pub mod auth;
pub mod config;
pub mod grpc;
pub mod matrix;
pub mod routes;
pub mod services;
pub mod state;

pub mod proto {
    pub mod ethos {
        pub mod v1 {
            tonic::include_proto!("ethos.v1");
        }
    }
}

use axum::Router;
use state::AppState;

pub fn router(state: AppState) -> Router {
    routes::router(state)
}
