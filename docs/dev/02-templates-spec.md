# 模板 JSON Schema

业务模板用于生成可复用的 Harness 会话任务。

```ts
type Template = {
  id: string
  category: "qa" | "analysis" | "report" | "ppt" | "cad" | "workflow"
  title: string
  description?: string
  agent: string
  variables: TemplateVariable[]
  prompt: string
}

type TemplateVariable = {
  key: string
  label: string
  type: "text" | "textarea" | "select"
  placeholder?: string
  options?: string[]
  required?: boolean
}
```

## 变量替换

模板使用 `{{变量名}}` 占位。发送前，表单值会替换到 Prompt 中，并进入当前项目文件夹会话输入。

## 示例

```json
{
  "id": "settlement-risk",
  "category": "analysis",
  "title": "沉降风险分析",
  "agent": "data_analyst",
  "variables": [
    { "key": "项目名称", "label": "项目名称", "type": "text", "required": true },
    { "key": "监测周期", "label": "监测周期", "type": "text" }
  ],
  "prompt": "请分析{{项目名称}}在{{监测周期}}的沉降风险。"
}
```

## 安全要求

模板中不得硬编码 API Key、客户合同全文、身份证号或私有网络凭据。
