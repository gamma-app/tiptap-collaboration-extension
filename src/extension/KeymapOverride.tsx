import { Extension } from "@tiptap/core";
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
          console.log("handlinge enter");
          // If a block is split from the very front
          // (i.e. moving the entire block),
          // mark the transaction so that the annotation
          // decoration can be moved with it
          const { parentOffset, pos } = tr.selection.$from;
          const result = commands.splitBlock();

          if (result) {
            console.log("split blockkkkk", tr);
            // How far did the split move us
            const offset = tr.selection.$from.pos - pos;
            tr.setMeta("SPLIT_BLOCK_START", {
              parentOffset,
              from: pos,
              offset,
            });
            console.log("split blockkkkk", tr);
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
