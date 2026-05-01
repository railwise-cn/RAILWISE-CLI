import { Button } from "@railwise/ui/button"
import { Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useSettings } from "@/context/settings"

const TELEMETRY_EVENT = "railwise:telemetry-enabled"

export function TelemetryConsent() {
  const language = useLanguage()
  const platform = usePlatform()
  const settings = useSettings()
  const hidden = () => {
    if (platform.platform !== "desktop") return true
    if (window.__RAILWISE__?.browserHarness) return true
    if (!settings.ready()) return true
    return settings.privacy.telemetryPrompted()
  }

  const choose = (enabled: boolean) => {
    settings.privacy.setTelemetry(enabled)
    settings.privacy.setTelemetryPrompted(true)
    window.dispatchEvent(new CustomEvent(TELEMETRY_EVENT, { detail: { enabled } }))
  }

  return (
    <Show when={!hidden()}>
      <div
        class="fixed inset-0 z-10000 flex items-center justify-center bg-black/25 px-4"
        data-testid="telemetry-consent"
        role="dialog"
        aria-modal="true"
      >
        <div class="w-full max-w-md rounded-lg border border-border-base bg-surface-base p-5 shadow-lg">
          <div class="flex flex-col gap-2">
            <h2 class="text-16-medium text-text-strong">{language.t("telemetry.consent.title")}</h2>
            <p class="text-13-regular text-text-weak">{language.t("telemetry.consent.description")}</p>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <Button size="small" variant="secondary" onClick={() => choose(false)}>
              {language.t("telemetry.consent.decline")}
            </Button>
            <Button size="small" onClick={() => choose(true)}>
              {language.t("telemetry.consent.accept")}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}
