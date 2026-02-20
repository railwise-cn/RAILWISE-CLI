{
  lib,
  stdenv,
  rustPlatform,
  pkg-config,
  cargo-tauri,
  bun,
  nodejs,
  cargo,
  rustc,
  jq,
  wrapGAppsHook4,
  makeWrapper,
  dbus,
  glib,
  gtk4,
  libsoup_3,
  librsvg,
  libappindicator,
  glib-networking,
  openssl,
  webkitgtk_4_1,
  gst_all_1,
  railwise,
}:
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "railwise-desktop";
  inherit (railwise)
    version
    src
    node_modules
    patches
    ;

  cargoRoot = "packages/desktop/src-tauri";
  cargoLock.lockFile = ../packages/desktop/src-tauri/Cargo.lock;
  buildAndTestSubdir = finalAttrs.cargoRoot;

  nativeBuildInputs = [
    pkg-config
    cargo-tauri.hook
    bun
    nodejs # for patchShebangs node_modules
    cargo
    rustc
    jq
    makeWrapper
  ] ++ lib.optionals stdenv.hostPlatform.isLinux [ wrapGAppsHook4 ];

  buildInputs = lib.optionals stdenv.isLinux [
    dbus
    glib
    gtk4
    libsoup_3
    librsvg
    libappindicator
    glib-networking
    openssl
    webkitgtk_4_1
    gst_all_1.gstreamer
    gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good
    gst_all_1.gst-plugins-bad
  ];

  strictDeps = true;

  preBuild = ''
    cp -a ${finalAttrs.node_modules}/{node_modules,packages} .
    chmod -R u+w node_modules packages
    patchShebangs node_modules
    patchShebangs packages/desktop/node_modules

    mkdir -p packages/desktop/src-tauri/sidecars
    cp ${railwise}/bin/railwise packages/desktop/src-tauri/sidecars/railwise-cli-${stdenv.hostPlatform.rust.rustcTarget}
  '';

  # see publish-tauri job in .github/workflows/publish.yml
  tauriBuildFlags = [
    "--config"
    "tauri.prod.conf.json"
    "--no-sign" # no code signing or auto updates
  ];

  # FIXME: workaround for concerns about case insensitive filesystems
  # should be removed once binary is renamed or decided otherwise
  # darwin output is a .app bundle so no conflict
  postFixup = lib.optionalString stdenv.hostPlatform.isLinux ''
    mv $out/bin/RAILWISE (甬算) $out/bin/railwise-desktop
    sed -i 's|^Exec=RAILWISE (甬算)$|Exec=railwise-desktop|' $out/share/applications/RAILWISE (甬算).desktop
  '';

  meta = {
    description = "RAILWISE (甬算) Desktop App";
    homepage = "https://railwise.ai";
    license = lib.licenses.mit;
    mainProgram = "railwise-desktop";
    inherit (railwise.meta) platforms;
  };
})
