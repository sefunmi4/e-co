mod error;
mod frequency;
mod grpc_service;
mod jobs;
mod pipeline;
mod proto;
mod publisher;
mod qpp_bridge;
mod symbolcast;

pub use error::AgentError;

use crate::grpc_service::ActionGrpcService;
use crate::jobs::JobExecutor;
use crate::pipeline::ActionPipeline;
use crate::publisher::NatsPublisher;
use crate::symbolcast::GrpcSymbolCastInvoker;
use async_nats::Client as NatsClient;
use std::env;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tonic::transport::Server;
use tracing::{error, info};

pub async fn run() -> Result<(), AgentError> {
    tracing_subscriber::fmt::init();

    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| "nats://127.0.0.1:4222".to_string());
    let agent_addr: SocketAddr = env::var("AGENT_GRPC_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:50051".to_string())
        .parse()
        .map_err(|err| AgentError::InvalidConfig(format!("invalid AGENT_GRPC_ADDR: {err}")))?;
    let symbolcast_url =
        env::var("SYMBOLCAST_URL").unwrap_or_else(|_| "http://127.0.0.1:50052".to_string());

    let nats: NatsClient = async_nats::connect(nats_url.clone()).await?;
    info!(%nats_url, "eco-agent connected to NATS");

    let frequency = frequency::FrequencyHub::new(64);
    let executor = JobExecutor::new(frequency.clone());
    let publisher = Arc::new(NatsPublisher::new(nats.clone()));

    let pipeline = ActionPipeline::new(nats.clone(), executor.clone(), publisher.clone());

    let symbolcast = Arc::new(GrpcSymbolCastInvoker::connect(symbolcast_url.clone()).await?);

    let grpc_service = ActionGrpcService::new(
        executor.clone(),
        publisher.clone(),
        frequency.clone(),
        symbolcast,
    );
    let grpc = Server::builder()
        .accept_http1(true)
        .add_service(tonic_web::enable(
            proto::actions::eco_actions_server::EcoActionsServer::new(grpc_service),
        ))
        .serve(agent_addr);

    info!(%agent_addr, "eco-agent gRPC server listening");

    let pipeline_task = pipeline.run();
    tokio::pin!(grpc);
    tokio::pin!(pipeline_task);

    tokio::select! {
        res = &mut grpc => {
            if let Err(err) = res {
                error!(?err, "gRPC server terminated");
                return Err(AgentError::from(err));
            }
        }
        res = &mut pipeline_task => {
            if let Err(err) = res {
                error!(?err, "action pipeline terminated");
                return Err(err);
            }
        }
        _ = signal::ctrl_c() => {
            info!("shutdown signal received");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests;
