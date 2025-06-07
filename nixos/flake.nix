{
  description = "EtherOS NixOS configuration";
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-23.11";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      nixosConfigurations.local = pkgs.lib.nixosSystem {
        inherit system;
        modules = [ ./module.nix ];
      };

      packages.${system}.iso =
        (pkgs.nixos {
          inherit system;
          modules = [ ./module.nix ];
        }).config.system.build.isoImage;
    };
}
