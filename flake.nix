{
  description = "stalk-web dev shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (s: f nixpkgs.legacyPackages.${s});
    in {
      devShells = forAll (pkgs: {
        # pnpm switches itself to the exact version in package.json's packageManager field.
        default = pkgs.mkShell { packages = [ pkgs.nodejs_26 pkgs.pnpm_12 ]; };
      });
    };
}
