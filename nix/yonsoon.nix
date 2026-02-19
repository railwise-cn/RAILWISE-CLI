{
  lib,
  stdenvNoCC,
  callPackage,
  bun,
  sysctl,
  makeBinaryWrapper,
  models-dev,
  ripgrep,
  installShellFiles,
  versionCheckHook,
  writableTmpDirAsHomeHook,
  node_modules ? callPackage ./node-modules.nix { },
}:
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "yonsoon";
  inherit (node_modules) version src;
  inherit node_modules;

  nativeBuildInputs = [
    bun
    installShellFiles
    makeBinaryWrapper
    models-dev
    writableTmpDirAsHomeHook
  ];

  configurePhase = ''
    runHook preConfigure

    cp -R ${finalAttrs.node_modules}/. .

    runHook postConfigure
  '';

  env.MODELS_DEV_API_JSON = "${models-dev}/dist/_api.json";
  env.YONSOON_DISABLE_MODELS_FETCH = true;
  env.YONSOON_VERSION = finalAttrs.version;
  env.YONSOON_CHANNEL = "local";

  buildPhase = ''
    runHook preBuild

    cd ./packages/yonsoon
    bun --bun ./script/build.ts --single --skip-install
    bun --bun ./script/schema.ts schema.json

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    install -Dm755 dist/yonsoon-*/bin/yonsoon $out/bin/yonsoon
    install -Dm644 schema.json $out/share/yonsoon/schema.json

    wrapProgram $out/bin/yonsoon \
      --prefix PATH : ${
        lib.makeBinPath (
          [
            ripgrep
          ]
          # bun runs sysctl to detect if dunning on rosetta2
          ++ lib.optional stdenvNoCC.hostPlatform.isDarwin sysctl
        )
      }

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenvNoCC.buildPlatform.canExecute stdenvNoCC.hostPlatform) ''
    # trick yargs into also generating zsh completions
    installShellCompletion --cmd yonsoon \
      --bash <($out/bin/yonsoon completion) \
      --zsh <(SHELL=/bin/zsh $out/bin/yonsoon completion)
  '';

  nativeInstallCheckInputs = [
    versionCheckHook
    writableTmpDirAsHomeHook
  ];
  doInstallCheck = true;
  versionCheckKeepEnvironment = [ "HOME" "YONSOON_DISABLE_MODELS_FETCH" ];
  versionCheckProgramArg = "--version";

  passthru = {
    jsonschema = "${placeholder "out"}/share/yonsoon/schema.json";
  };

  meta = {
    description = "The open source coding agent";
    homepage = "https://yonsoon.ai/";
    license = lib.licenses.mit;
    mainProgram = "yonsoon";
    inherit (node_modules.meta) platforms;
  };
})
