{ config, pkgs, ... }:
{
  imports = [ ./module.nix ];
  services.xserver.enable = true;
  services.xserver.desktopManager.xfce.enable = true;
  # TODO: customize desktop packages
}
