fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proto_dir = std::path::PathBuf::from("../../proto");
    tonic_build::configure()
        .build_client(false)
        .compile(&[proto_dir.join("symbolcast.proto")], &[proto_dir])?;
    Ok(())
}
