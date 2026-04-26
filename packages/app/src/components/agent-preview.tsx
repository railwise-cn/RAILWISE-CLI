import { Markdown } from "@railwise/ui/markdown"
import { stripFrontmatter } from "@/utils/agent-markdown"

export function AgentPreview(props: { markdown: string }) {
  return (
    <article class="agent-preview selectable-text" data-testid="agent-preview">
      <Markdown text={stripFrontmatter(props.markdown)} />
    </article>
  )
}
