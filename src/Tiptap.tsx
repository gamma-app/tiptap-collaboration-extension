import { Extension } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import { Paragraph } from "./Paragraph";
import Text from "@tiptap/extension-text";
import Collaboration from "@tiptap/extension-collaboration";
import Bold from "@tiptap/extension-bold";
import Heading from "@tiptap/extension-heading";
// @ts-ignore
import applyDevTools from "prosemirror-dev-tools";
import CollaborationAnnotation from "./extension";
import { useState } from "react";
import { findChildren } from "prosemirror-utils";

export const KeymapOverride = Extension.create({
  name: "keymapOverride",
  priority: 101,

  addKeyboardShortcuts() {
    const handleEnter = () =>
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

          if (result) {
            // How far did the split move us
            const offset = tr.selection.$from.pos - pos;
            tr.setMeta("SPLIT_BLOCK_START", {
              parentOffset,
              from: pos,
              offset,
            });
          }
          return result;
        },
      ]);

    const handleBackspace = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.undoInputRule(),
        () => commands.deleteSelection(),
        ({ tr, state }) => {
          const { parent: node } = tr.selection.$from;
          const joinBackward = commands.joinBackward();

          const { parent: nodeEnd, parentOffset, pos } = tr.selection.$from;
          const matches = findChildren(tr.doc, (node) => node === nodeEnd);

          if (joinBackward && matches) {
            console.log("join backward debug", {
              node,
              nodeEnd,
              matches,
            });
            tr.setMeta("JOIN_BACKWARD", {
              node,
              nodeEnd,
              joinedPos: matches[0].pos,
              joinedNode: matches[0].node,
            });
          }
          return joinBackward;
        },
        () => commands.selectNodeBackward(),
      ]);

    const handleDelete = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.deleteSelection(),
        ({ tr, state }) => {
          const posAfter = tr.selection.$from.after();
          const node = state.doc.nodeAt(posAfter);
          const joinForward = commands.joinForward();
          const { parent: nodeEnd, parentOffset } = tr.selection.$from;
          const matches = findChildren(tr.doc, (node) => node === nodeEnd);

          if (joinForward && matches) {
            console.log("join backward debug", {
              node,
              nodeEnd,
              matches,
            });
            tr.setMeta("JOIN_FORWARD", {
              node,
              nodeEnd,
              joinedPos: matches[0].pos,
              joinedNode: matches[0].node,
            });
          }
          return joinForward;
        },
        () => commands.selectNodeForward(),
      ]);

    return {
      Enter: handleEnter,
      Backspace: handleBackspace,
      "Mod-Backspace": handleBackspace,
      "Shift-Backspace": handleBackspace,
      Delete: handleDelete,
      "Mod-Delete": handleDelete,
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
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationAnnotation.configure({
        document: ydoc,
        onUpdate: (items: any) => {
          // console.log("setting comments", items);
          setComments(items);
        },
        instance,
        color,
      }),
    ],
    content: `<p>block 1</p><p>block 2</p>`,
  });

  if (!window["editor"]) {
    window["editor"] = editor;
  }

  return (
    <>
      <EditorContent editor={editor} />
      <div
        style={{
          marginLeft: "70px",
        }}
      >
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
      </div>
    </>
  );
};
