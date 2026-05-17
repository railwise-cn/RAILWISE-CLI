import { createMemo, For } from "solid-js"
import { useModels } from "@/context/models"
import {
  PermissionActions,
  readPermission,
  readScalar,
  removeScalar,
  setPermission,
  setScalar,
  type PermissionAction,
} from "@/utils/agent-markdown"

const items = [
  { key: "question", label: "提问权限" },
  { key: "plan_enter", label: "进入计划" },
] as const

function actionLabel(action: PermissionAction) {
  if (action === "allow") return "允许"
  if (action === "ask") return "询问"
  return "拒绝"
}

export function AgentPermissionForm(props: { markdown: string; onChange: (value: string) => void }) {
  const models = useModels()
  const value = createMemo(() => readScalar(props.markdown, "model") ?? "")
  const options = createMemo(() =>
    models
      .list()
      .filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id }))
      .map((model) => ({
        value: `${model.provider.id}/${model.id}`,
        label: `${model.provider.name} / ${model.name}`,
      })),
  )

  return (
    <div class="agent-form" data-testid="agent-permission-form">
      <label class="agent-form__field">
        <span>智能体模型</span>
        <select
          value={value()}
          onInput={(event) =>
            props.onChange(
              event.currentTarget.value
                ? setScalar(props.markdown, "model", event.currentTarget.value)
                : removeScalar(props.markdown, "model"),
            )
          }
        >
          <option value="">继承系统默认（建议 DeepSeek V4）</option>
          <For each={options()}>{(model) => <option value={model.value}>{model.label}</option>}</For>
        </select>
        <small>未绑定时使用当前会话模型；绑定后这个智能体会优先使用所选模型。</small>
      </label>

      <For each={items}>
        {(item) => {
          const current = createMemo(() => readPermission(props.markdown, item.key))
          return (
            <div class="agent-form__field">
              <span>{item.label}</span>
              <div class="agent-segment" role="group" aria-label={item.label}>
                <For each={PermissionActions}>
                  {(action) => (
                    <button
                      type="button"
                      classList={{ active: current() === action }}
                      onClick={() => props.onChange(setPermission(props.markdown, item.key, action))}
                    >
                      {actionLabel(action)}
                    </button>
                  )}
                </For>
              </div>
            </div>
          )
        }}
      </For>
    </div>
  )
}
