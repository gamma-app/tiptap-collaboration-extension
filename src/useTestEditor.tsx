import { useEditor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import * as Y from "yjs";
import { Paragraph } from "./Paragraph";
import Text from "@tiptap/extension-text";
import Collaboration from "@tiptap/extension-collaboration";
import Bold from "@tiptap/extension-bold";
import Heading from "@tiptap/extension-heading";
import CollaborationAnnotation from "./extension";
import { KeymapOverride } from "./extension/KeymapOverride";
// @ts-ignore
import applyDevTools from "prosemirror-dev-tools";

export const useTestEditor = ({
  ydoc,
  instance,
  color,
  content = "",
  onUpdate = () => {},
  devTools = false,
}: {
  ydoc: Y.Doc;
  instance: string;
  color: string;
  content?: string;
  devTools?: boolean;
  onUpdate?: (decos: any, annotations: any) => void;
}) => {
  return useEditor({
    onCreate({ editor }) {
      if (devTools) applyDevTools(editor.view);
    },
    extensions: [
      KeymapOverride,
      Document,
      Paragraph,
      Text,
      Bold,
      Heading,
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationAnnotation.configure({
        document: ydoc,
        onUpdate: onUpdate,
        instance,
        color,
      }),
    ],
    content,
  });
};
