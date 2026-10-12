# Reproducible headless development; no experimental Nix features required.
let
  source = builtins.fetchTarball {
    url = "https://github.com/NixOS/nixpkgs/archive/e7439b6b14ad3cc35d05608ebca9bce01a25f5f8.tar.gz";
    sha256 = "sha256-H83yz/do+hjOO0uujHyH8RgtIQP2v7Mw+cLwcZK/xKc=";
  };
  pkgs = import source { };
in
pkgs.mkShellNoCC {
  packages = [ pkgs.nodejs pkgs.python3 pkgs.bash pkgs.git ];
  shellHook = ''
    export OMATYPE_TEST_PYTHON="${pkgs.python3}/bin/python3"
  '';
}
