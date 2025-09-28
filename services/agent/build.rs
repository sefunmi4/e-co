use std::env;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("manifest dir"));
    let repo_root = manifest_dir
        .parent()
        .expect("services dir")
        .parent()
        .expect("repo root");
    let proto_dir = repo_root.join("proto");
    let cpp_dir = repo_root.join("sdks").join("cpp-qpp");

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile(&[proto_dir.join("actions.proto")], &[proto_dir.clone()])
        .expect("compile actions proto");

    // also compile symbolcast dependencies referenced via import
    tonic_build::configure()
        .build_server(false)
        .build_client(true)
        .compile(&[proto_dir.join("symbolcast.proto")], &[proto_dir.clone()])
        .expect("compile symbolcast proto");

    cxx_build::bridge("src/qpp_bridge.rs")
        .file(cpp_dir.join("src").join("qpp.cpp"))
        .flag_if_supported("-std=c++17")
        .include(cpp_dir.join("include"))
        .compile("eco_agent_qpp");

    println!("cargo:rerun-if-changed=src/qpp_bridge.rs");
    println!(
        "cargo:rerun-if-changed={}",
        cpp_dir.join("src").join("qpp.cpp").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        cpp_dir.join("include").join("eco_qpp.h").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        proto_dir.join("actions.proto").display()
    );
    println!(
        "cargo:rerun-if-changed={}",
        proto_dir.join("symbolcast.proto").display()
    );
}
