{ config, pkgs, ... }:
{
  imports = [ ./module.nix ];
  services.xserver.enable = false;
  # TODO: add headless server services
}
