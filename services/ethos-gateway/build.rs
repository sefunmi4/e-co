fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rerun-if-changed=../../proto/ethos.proto");
    let proto_root = std::path::PathBuf::from("../../proto");

    tonic_build::configure()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .build_server(true)
        .build_client(true)
        .compile(&[proto_root.join("ethos.proto")], &[proto_root])?;

    Ok(())
}
