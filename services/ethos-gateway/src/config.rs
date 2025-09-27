use std::{env, net::SocketAddr};

#[derive(Clone, Debug)]
pub struct MatrixConfig {
    pub homeserver: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub user_id: Option<String>,
    pub device_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct GatewayConfig {
    pub jwt_secret: String,
    pub http_addr: SocketAddr,
    pub grpc_addr: SocketAddr,
    pub nats_url: Option<String>,
    pub database_url: String,
    pub matrix: Option<MatrixConfig>,
}

impl GatewayConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let jwt_secret =
            env::var("ETHOS_JWT_SECRET").unwrap_or_else(|_| "insecure-dev-secret".to_string());
        let http_addr: SocketAddr = env::var("ETHOS_HTTP_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
            .parse()?;
        let grpc_addr: SocketAddr = env::var("ETHOS_GRPC_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8081".to_string())
            .parse()?;
        let nats_url = env::var("ETHOS_NATS_URL").ok();
        let database_url = env::var("ETHOS_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://ethos:ethos@localhost:5432/ethos".to_string());

        let matrix = match env::var("ETHOS_MATRIX_HOMESERVER") {
            Ok(homeserver) => Some(MatrixConfig {
                homeserver,
                access_token: env::var("ETHOS_MATRIX_ACCESS_TOKEN").ok(),
                refresh_token: env::var("ETHOS_MATRIX_REFRESH_TOKEN").ok(),
                user_id: env::var("ETHOS_MATRIX_USER_ID").ok(),
                device_id: env::var("ETHOS_MATRIX_DEVICE_ID").ok(),
            }),
            Err(_) => None,
        };

        Ok(Self {
            jwt_secret,
            http_addr,
            grpc_addr,
            nats_url,
            database_url,
            matrix,
        })
    }
}
