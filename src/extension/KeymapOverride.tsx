import { Extension } from "@tiptap/core";
import { findChildren } from "prosemirror-utils";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import {
  ySyncPluginKey,
  absolutePositionToRelativePosition,
} from "y-prosemirror";
import { AnnotationPluginKey } from "./AnnotationPlugin";
import { AnnotationData } from "./AnnotationState";
import { MoveInstruction } from ".";

const getPos = (doc: any, curr: Node) => {
  const results = findChildren(doc, (node) => node === curr);
  if (!results) {
    throw new Error();
  }
  return results[0]?.pos;
};

const getRelPos = (state: EditorState, pos: number) => {
  const ystate = ySyncPluginKey.getState(state);
  const { type, binding } = ystate;
  return absolutePositionToRelativePosition(pos, type, binding.mapping);
};

// const handleSplitBlockAtBeginning = ({
//   tr,
//   editor,
//   state,
// }: {
//   tr: Transaction;
//   editor: Editor;
//   state: EditorState;
// }) => {};
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
          const beforeBlockFrom = tr.selection.$from.pos;
          const beforeBlock = tr.selection.$from.parent;
          const beforeBlockPos = getPos(state.doc, beforeBlock);

          // handle split block at beginning of line
          if (beforeBlockPos === beforeBlockFrom - 1) {
            const result = commands.splitBlock();
            tr.setMeta("SPLIT_BLOCK_START", {});
            requestAnimationFrame(() => {
              this.editor.commands.refreshDecorations();
            });
            return result;
          }

          // get original unsplit block info
          const origBlock = tr.selection.$from.parent;
          const origBlockPos = getPos(state.doc, origBlock);
          const origBlockEnd = origBlockPos + origBlock.nodeSize;

          const result = commands.splitBlock();

          // new block (2nd block) info
          const newBlockFrom = tr.selection.$from.pos;
          const newBlock = tr.selection.$from.parent;
          const newBlockPos = getPos(state.doc, newBlock);
          const newBlockEnd = newBlockPos + newBlock.nodeSize;

          if (result) {
            // How far did the split move us
            console.log("split blockkkkk", {
              origBlock,
              origBlockPos,
              origBlockEnd,
              beforeBlock,
              beforeBlockFrom,
              beforeBlockPos,
              newBlockFrom,
              newBlockPos,
              newBlock,
              newBlockEnd,
            });

            const annotations = AnnotationPluginKey.getState(state)
              .annotations as AnnotationData[];
            // <prev block> <next block>

            const frontBlockAnnotations = annotations
              .filter((a) => a.pos === beforeBlockFrom)
              .map<MoveInstruction>((val) => {
                return {
                  currPos: getRelPos(state, val.pos),
                  newPos: newBlockPos,
                };
              });

            const middleBlockAnnotations = annotations
              .filter((a) => a.pos > beforeBlockFrom && a.pos < origBlockEnd)
              .map<MoveInstruction>((val) => {
                return {
                  currPos: getRelPos(state, val.pos),
                  newPos: newBlockPos + (val.pos - beforeBlockFrom + 1),
                };
              });

            console.log("annotation state", {
              annotations,
              frontBlockAnnotations,
              middleBlockAnnotations,
            });

            tr.setMeta("SPLIT_BLOCK_START", {});

            requestAnimationFrame(() => {
              this.editor.commands.moveAnnotations([
                ...frontBlockAnnotations,
                ...middleBlockAnnotations,
              ]);
            });
          } else {
            console.log("DID NOT SPLIT BLOCK");
          }
          return result;
        },
      ]);

    const handleBackspace = () =>
      this.editor.commands.first(({ commands, state }) => [
        () => commands.undoInputRule(),
        () => commands.deleteSelection(),
        ({ tr, state }) => {
          const currentDecorationPos = tr.selection.$from.before();
          const joinBackward = commands.joinBackward();

          // const { parent: nodeEnd } = tr.selection.$from;
          // const matches = findChildren(tr.doc, (node) => node === nodeEnd);
          // if (joinBackward && matches) {
          console.log("testing", {
            sel: tr.selection,
          });

          if (joinBackward) {
            const ystate = ySyncPluginKey.getState(state);
            const { type, binding } = ystate;
            const newDecorationPos = tr.selection.$from.pos;
            console.log("handling backspace", {
              currentDecorationPos,
              newDecorationPos,
            });
            // const newDecorationRelPos = absolutePositionToRelativePosition(
            //   newDecorationPos,
            //   type,
            //   binding.mapping
            // );
            const currentDecorationRelPos = absolutePositionToRelativePosition(
              currentDecorationPos,
              type,
              binding.mapping
            );

            // tr.setMeta("moveAnnotation", {
            //   currentDecorationPos,
            //   newPos: newDecorationRelPos,
            //   currPos: currentDecorationRelPos,
            // });

            requestAnimationFrame(() => {
              this.editor.commands.refreshDecorations();
              requestAnimationFrame(() => {
                this.editor.commands.moveAnnotations([
                  {
                    currPos: currentDecorationRelPos,
                    newPos: newDecorationPos,
                  },
                ]);
              });
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
          const currentDecorationPos = tr.selection.$from.after();
          // do join
          const joinForward = commands.joinForward();
          // selection is now within the joined nodes
          const { parent: joinedNode } = tr.selection.$from;
          const matches = findChildren(tr.doc, (node) => node === joinedNode);

          if (joinForward && matches) {
            tr.setMeta("JOIN_BLOCK", {
              currentDecorationPos,
              newDecorationPos: matches[0].pos,
            });
            requestAnimationFrame(() => {
              this.editor.commands.refreshDecorations();
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
