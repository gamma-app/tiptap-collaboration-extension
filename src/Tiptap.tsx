import { Extension } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Collaboration from "@tiptap/extension-collaboration";
import Bold from "@tiptap/extension-bold";
import Heading from "@tiptap/extension-heading";
// @ts-ignore
import applyDevTools from "prosemirror-dev-tools";
import CollaborationAnnotation from "./extension";
import { useState } from "react";

export const KeymapOverride = Extension.create({
  name: "keymapOverride",
  priority: 101,

  addKeyboardShortcuts() {
    return {
      Enter: () =>
        this.editor.commands.first(({ commands }) => [
          () => commands.newlineInCode(),
          () => commands.createParagraphNear(),
          () => commands.liftEmptyBlock(),
          ({ tr, state, dispatch, editor }) => {
            // If a block is split from the very front
            // (i.e. moving the entire block),
            // mark the transaction so that the annotation
            // decoration can be moved with it
            const { parentOffset, pos } = tr.selection.$from;
            const result = commands.splitBlock();
            if (result && parentOffset === 0) {
              // How far did the split move us
              const offset = tr.selection.$from.pos - pos;
              tr.setMeta("SPLIT_BLOCK_START", {
                from: pos,
                offset,
              });
            }
            return result;
          },
        ]),
    };
  },
});

export const Tiptap = ({ ydoc, instance, devTools = false, color }) => {
  const [comments, setComments] = useState([]);

  const editor = useEditor({
    onCreate: ({ editor }) => {
      if (devTools) {
        applyDevTools(editor.view);
      }
    },
    extensions: [
      KeymapOverride,
      Document,
      Paragraph,
      Text,
      Bold,
      Heading,
      CollaborationAnnotation.configure({
        document: ydoc,
        onUpdate: (items: any) => {
          // console.log("setting comments", items);
          setComments(items);
        },
        instance,
        color,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
    ],
    content: `        <p>
    Annotations can be used to add additional information to the content, for example comments. They live on a different level than the actual editor content.
  </p>
  <p/>
  <p>
    This example allows you to add plain text, but you’re free to add more complex data, for example JSON from another tiptap instance. :-)
  </p>
  <p/>
  <p>
    Lorem Ipsum 123 hey buddy
  </p>
  <p/><p/><p/>`,
  });

  if (!window["editor"]) {
    window["editor"] = editor;
  }

  return (
    <>
      <EditorContent editor={editor} />
      <button
        style={{
          marginTop: "15px",
        }}
        onClick={() => {
          const comment = "c #" + Math.floor(Math.random() * 100);
          editor?.commands.addAnnotation(comment);
        }}
      >
        Comment
      </button>
      {comments.map((c, idx) => {
        return <div key={idx}>{JSON.stringify(c)}</div>;
      })}
    </>
  );
};
