export function UpdateDialog(props: {
  busy: boolean
  version: string
  notes: string
  onLater: () => void
  onUpdate: () => void
}) {
  return (
    <div
      class="railwise-update-overlay"
      data-testid="update-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="railwise-update-title"
    >
      <div class="railwise-update-card">
        <div class="railwise-update-header">
          <div class="railwise-update-mark" aria-hidden="true">
            ↻
          </div>
          <div>
            <div id="railwise-update-title" class="railwise-update-title">
              发现新版本 <span data-testid="update-version">v{props.version}</span>
            </div>
            <div class="railwise-update-subtitle">RAILWISE Desktop</div>
          </div>
        </div>

        <div class="railwise-update-notes">{props.notes}</div>
        <ShowProgress busy={props.busy} />

        <div class="railwise-update-actions">
          <button class="railwise-update-later" type="button" disabled={props.busy} onClick={props.onLater}>
            稍后提醒
          </button>
          <button
            class="railwise-update-primary"
            data-testid="update-install-btn"
            type="button"
            disabled={props.busy}
            onClick={props.onUpdate}
          >
            {props.busy ? "正在更新..." : "立即更新"}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShowProgress(props: { busy: boolean }) {
  if (!props.busy) return null
  return (
    <div class="railwise-update-progress" data-testid="update-progress">
      正在更新，请稍候。
    </div>
  )
}
