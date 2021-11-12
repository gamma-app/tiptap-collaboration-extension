import TiptapParagraph from "@tiptap/extension-paragraph";
import {
  NodeViewProps,
  NodeViewContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";

export const ParagraphView = (nodeViewProps: NodeViewProps) => {
  const { decorations, editor } = nodeViewProps;
  console.log("ParagraphView", { decorations });
  return (
    <NodeViewWrapper style={{ position: "relative" }}>
      {decorations.map((d) => (
        <span className="widget" tabIndex={8999}>
          {d.spec.data}
        </span>
      ))}
      <NodeViewContent as="p" />
    </NodeViewWrapper>
  );
};

export const Paragraph = TiptapParagraph.extend({
  name: "paragraph",
  addNodeView() {
    return ReactNodeViewRenderer(ParagraphView);
  },
});
