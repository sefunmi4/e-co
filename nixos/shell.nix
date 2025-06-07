{ pkgs ? import <nixpkgs> {} }:

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
