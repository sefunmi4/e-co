use std::{env, fs, io, net::SocketAddr};

use anyhow::Context;
use serde::Deserialize;

const DEFAULT_CONFIG_PATH: &str = "packages/config/dist/env.json";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatrixFileConfig {
    homeserver: String,
    access_token: Option<String>,
    refresh_token: Option<String>,
    user_id: Option<String>,
    device_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayFileConfig {
    jwt_secret: String,
    http_addr: String,
    grpc_addr: String,
    nats_url: Option<String>,
    database_url: String,
    matrix: Option<MatrixFileConfig>,
}

#[derive(Clone, Debug, Deserialize)]
struct ConfigFile {
    gateway: GatewayFileConfig,
}

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
    fn from_config_file() -> anyhow::Result<Option<Self>> {
        let explicit_path = env::var("ECO_CONFIG_PATH").ok();
        let candidate_path = explicit_path.as_deref().unwrap_or(DEFAULT_CONFIG_PATH);

        let contents = match fs::read_to_string(candidate_path) {
            Ok(contents) => contents,
            Err(error) => {
                if explicit_path.is_some() || error.kind() != io::ErrorKind::NotFound {
                    return Err(error).with_context(|| {
                        format!("failed to read config file at {}", candidate_path)
                    });
                }

                return Ok(None);
            }
        };

        let file: ConfigFile = serde_json::from_str(&contents)
            .with_context(|| format!("invalid config JSON in {}", candidate_path))?;

        let http_addr: SocketAddr = file
            .gateway
            .http_addr
            .parse()
            .with_context(|| format!("invalid http_addr in {}", candidate_path))?;
        let grpc_addr: SocketAddr = file
            .gateway
            .grpc_addr
            .parse()
            .with_context(|| format!("invalid grpc_addr in {}", candidate_path))?;

        let matrix = file.gateway.matrix.map(|matrix| MatrixConfig {
            homeserver: matrix.homeserver,
            access_token: matrix.access_token,
            refresh_token: matrix.refresh_token,
            user_id: matrix.user_id,
            device_id: matrix.device_id,
        });

        Ok(Some(Self {
            jwt_secret: file.gateway.jwt_secret,
            http_addr,
            grpc_addr,
            nats_url: file.gateway.nats_url,
            database_url: file.gateway.database_url,
            matrix,
        }))
    }

    pub fn from_env() -> anyhow::Result<Self> {
        if let Some(config) = Self::from_config_file()? {
            return Ok(config);
        }

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
            .or_else(|_| env::var("DATABASE_URL"))
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
