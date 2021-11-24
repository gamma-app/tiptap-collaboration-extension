import { Extension } from "@tiptap/core";
import { findChildren } from "prosemirror-utils";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { DecorationSet } from "prosemirror-view";
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

type AnnotationState = {
  annotations: AnnotationData[];
  decorations: DecorationSet;
};

const getAnnotationState = (state: EditorState): AnnotationState => {
  return AnnotationPluginKey.getState(state) as AnnotationState;
};

export const KeymapOverride = Extension.create({
  name: "keymapOverride",
  priority: 101,

  addKeyboardShortcuts() {
    const handleEnter = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.newlineInCode(),
        () => commands.createParagraphNear(),
        () => commands.liftEmptyBlock(),
        ({ tr, state }) => {
          console.log("Handling enter");
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
            if (result) {
              tr.setMeta("SPLIT_BLOCK_START", {});
              requestAnimationFrame(() => {
                this.editor.commands.refreshDecorations();
              });
            }
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
            // set SPLIT_BLOCK_START so that the AnnotationState special cases
            tr.setMeta("SPLIT_BLOCK_START", {});

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

            const { annotations } = getAnnotationState(state);

            // <prev block> <next block>
            const frontBlockAnnotations = annotations
              .filter((a) => a.pos === beforeBlockFrom)
              .map<MoveInstruction>(({ pos, id }) => {
                return {
                  id,
                  newPos: newBlockPos,
                };
              });

            const middleBlockAnnotations = annotations
              .filter((a) => a.pos > beforeBlockFrom && a.pos < origBlockEnd)
              .map<MoveInstruction>(({ pos, id }) => {
                return {
                  id,
                  newPos: newBlockPos + (pos - beforeBlockFrom + 1),
                };
              });

            const annotationsToMove = [
              ...frontBlockAnnotations,
              ...middleBlockAnnotations,
            ];
            if (annotationsToMove.length > 0) {
              requestAnimationFrame(() => {
                this.editor.commands.moveAnnotations(annotationsToMove);
              });
            } else {
              requestAnimationFrame(() => {
                this.editor.commands.refreshDecorations();
              });
            }
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
          // delete backspace position
          const currentBlockPos = tr.selection.$from.before();
          const origBlock = tr.selection.$from.parent;
          const origBlockPos = getPos(state.doc, origBlock);
          const origBlockEnd = origBlockPos + origBlock.nodeSize;

          const joinBackward = commands.joinBackward();

          // joinBackward is true if a backspace resulted in a join block
          if (joinBackward) {
            const newBlockFrom = tr.selection.$from.pos;

            // back
            console.log("handling backspace", {
              newSel: tr.selection,
              currentBlockPos,
              origBlock,
              origBlockPos,
              origBlockEnd,
            });
            // currentBlockPos and orignBlockPos will be the same when the backspace
            // is happening at the front of a block

            // where the decoration should be
            const newDecorationPos = tr.selection.$from.pos;

            const { annotations } = getAnnotationState(state);
            // handle join backwards block where annotation is at front
            // <p>block 1</p>
            // <p>|block 2</p>
            //    ^
            //    annotation + currentBlockPos
            const frontBlockAnnotations = annotations
              .filter(({ pos }) => pos === currentBlockPos)
              .map<MoveInstruction>(({ pos, id }) => {
                return {
                  id,
                  newPos: newDecorationPos,
                };
              });

            // handle join backwards block where annotation in middle of block
            // <p>block 1</p>
            // <p>|bl|ock 2</p>
            //  ^ ^  ^️
            //  | |  annotation
            //  | currentBlockPos
            //  origBlockPos
            const middleBlockAnnotations = annotations
              .filter((a) => a.pos > origBlockPos && a.pos < origBlockEnd)
              .map<MoveInstruction>(({ pos, id }) => {
                // middle offset is from `origBlock` start to pos
                // does not count the inclusive origBlock.pos
                const middleOffset = pos - (origBlockPos + 1); // +1 to denote the from, not the pos
                console.log("middleoffset ", {
                  pos,
                  origBlockPos,
                  id,
                  middleOffset,
                });
                return {
                  id,
                  newPos: newBlockFrom + middleOffset,
                };
              });
            console.log("handling backspace", {
              currentDecorationPos: currentBlockPos,
              newDecorationPos,
            });
            const toMove = [
              ...frontBlockAnnotations,
              ...middleBlockAnnotations,
            ];

            // TODO account for when some move and some dont
            // maybe the map.observe handle this okay
            if (toMove.length > 0) {
              requestAnimationFrame(() => {
                this.editor.commands.moveAnnotations(toMove);
              });
            } else {
              requestAnimationFrame(() => {
                this.editor.commands.refreshDecorations();
              });
            }
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
