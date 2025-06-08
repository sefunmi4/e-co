{ stdenv, cmake, qt6 }:
qt6.mkDerivation {
  pname = "etheros-example";
  version = "0.1.0";
  src = ./.;
  nativeBuildInputs = [ cmake ];
}

