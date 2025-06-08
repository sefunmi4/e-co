{ config, pkgs, ... }:
{
  imports = [ ./module.nix ];
  services.xserver.enable = true;
  services.xserver.desktopManager.xfce.enable = true;

  environment.systemPackages = with pkgs; [ firefox vscode ];
}
