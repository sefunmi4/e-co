{ config, pkgs, ... }:
{
  imports = [ ./module.nix ];
  services.xserver.enable = false;

  services.openssh.enable = true;
  networking.firewall.allowedTCPPorts = [ 22 80 ];
  services.nginx.enable = true;
  environment.systemPackages = [ pkgs.git ];
}
