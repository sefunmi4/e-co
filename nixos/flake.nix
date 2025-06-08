{
  description = "EtherOS NixOS configuration";
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-23.11";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      nixosConfigurations = forAllSystems (system: nixpkgs.lib.nixosSystem {
        inherit system;
        modules = [ ./module.nix ];
      });

      packages = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
            iso = (pkgs.nixos {
              inherit system;
              modules = [ ./module.nix ];
            }).config.system.build.isoImage;
        in {
          isoImage = iso;
          qtExample = pkgs.callPackage ./example { };
        });

      # Example specialized builds
      nixosConfigurations.server = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [ ./module.nix ./server.nix ];
      };
      nixosConfigurations.desktop = nixpkgs.lib.nixosSystem {
        system = "x86_64-linux";
        modules = [ ./module.nix ./desktop.nix ];
      };
    };
}
