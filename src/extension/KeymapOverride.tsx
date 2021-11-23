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
            setTimeout(() => {
              this.editor.commands.refreshDecorations();
            }, 0);
          }
          return result;
        },
      ]);

    const handleBackspace = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.undoInputRule(),
        () => commands.deleteSelection(),
        ({ tr, state }) => {
          console.log("handling backspace", {
            selection: tr.selection,
            before: tr.selection.$from.before(),
          });
          const currentDecorationPos = tr.selection.$from.before();
          const joinBackward = commands.joinBackward();

          const { parent: nodeEnd } = tr.selection.$from;
          const matches = findChildren(tr.doc, (node) => node === nodeEnd);

          if (joinBackward && matches) {
            const newDecorationPos = matches[0].pos;
            tr.setMeta("JOIN_BACKWARD", {
              currentDecorationPos,
              newDecorationPos,
            });
            setTimeout(() => {
              this.editor.commands.refreshDecorations();
            }, 0);
          }
          return joinBackward;
        },
        () => commands.selectNodeBackward(),
      ]);

    const handleDelete = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.deleteSelection(),
        ({ tr, state }) => {
          const currentDecorationPos = tr.selection.$from.after();
          // do join
          const joinForward = commands.joinForward();
          // selection is now within the joined nodes
          const { parent: joinedNode } = tr.selection.$from;
          const matches = findChildren(tr.doc, (node) => node === joinedNode);

          if (joinForward && matches) {
            tr.setMeta("JOIN_FORWARD", {
              currentDecorationPos,
              newDecorationPos: matches[0].pos,
            });
            setTimeout(() => {
              this.editor.commands.refreshDecorations();
            }, 0);
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
