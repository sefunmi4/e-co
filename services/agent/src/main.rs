use eco_agent::run;

#[tokio::main]
async fn main() -> Result<(), eco_agent::AgentError> {
    run().await
}
