{ system ? builtins.currentSystem }:
let
  flake = builtins.getFlake (toString ../.);
  pkgs = import flake.inputs.nixpkgs { inherit system; };
in
pkgs.mkShell {
  buildInputs = [
    pkgs.nixos-rebuild
    pkgs.git
    pkgs.cmake
    pkgs.pkg-config
    pkgs.qt6.qtbase
    pkgs.qt6.qtdeclarative
    pkgs.qt6.qtwayland
  ];
}
