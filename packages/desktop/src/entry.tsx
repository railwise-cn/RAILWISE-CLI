const boot = async () => {
  if (import.meta.env.DEV) {
    const mod = await import("./dev-browser-harness")
    mod.installDevBrowserHarness()
  }

  if (location.pathname === "/loading") {
    await import("./loading")
    return
  }

  await import("./")
}

void boot()
