import TiptapParagraph from '@tiptap/extension-paragraph'
import {
  NodeViewProps,
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from '@tiptap/react'

export const ParagraphView = (nodeViewProps: NodeViewProps) => {
  const { decorations } = nodeViewProps

  return (
    <NodeViewWrapper style={{ position: 'relative' }}>
      {decorations.map((d, ind) => (
        <span
          contentEditable={false}
          className="widget"
          tabIndex={-9999}
          key={ind}
        >
          {d.spec.data}
        </span>
      ))}
      <NodeViewContent as="p" />
    </NodeViewWrapper>
  )
}

export const Paragraph = TiptapParagraph.extend({
  name: 'paragraph',
  addNodeView() {
    return ReactNodeViewRenderer(ParagraphView)
  },
})
