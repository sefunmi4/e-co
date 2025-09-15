{
  description = "E-CO development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "eco-shell";
          buildInputs = [
            pkgs.nodejs_20,
            pkgs.rustup,
            pkgs.protobuf,
            pkgs.cmake,
            pkgs.pkg-config,
          ];
          shellHook = ''
            echo "E-CO dev shell loaded"
          '';
        };
      });
}
