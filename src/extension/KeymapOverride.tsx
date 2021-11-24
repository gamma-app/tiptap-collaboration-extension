import { Extension } from "@tiptap/core";
import { findChildren } from "prosemirror-utils";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { DecorationSet } from "prosemirror-view";
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
          const newBlock = tr.selection.$from.parent;
          const newBlockPos = getPos(state.doc, newBlock);

          if (result) {
            // set SPLIT_BLOCK_START so that the AnnotationState special cases
            tr.setMeta("SPLIT_BLOCK_START", {});

            // How far did the split move us
            console.log("handling enter", {
              origBlock,
              origBlockPos,
              origBlockEnd,
              beforeBlock,
              beforeBlockFrom,
              beforeBlockPos,
              newBlockPos,
              newBlock,
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

          // do join
          const joinBackward = commands.joinBackward();

          // joinBackward is true if a backspace resulted in a join block
          if (joinBackward) {
            const newBlockFrom = tr.selection.$from.pos;

            console.log("handling backspace", {
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
          //   delete pressed here
          //           |
          //           v
          // <p>block 1|</p>       currentBlock
          // <p>block 2</p>        nextBlock
          //
          // RESULT:
          // <p>block 1block 2</p> joinedBlock
          const currentBlockFrom = tr.selection.$from.pos;
          const nextBlockPos = tr.selection.$from.after();
          const nextBlock = state.doc.resolve(nextBlockPos).nodeAfter;
          const nextBlockEnd = nextBlockPos + nextBlock.nodeSize;
          const origBlock = tr.selection.$from.parent;
          const origBlockPos = getPos(state.doc, origBlock);
          // do join
          const joinForward = commands.joinForward();

          if (joinForward) {
            // use tr.doc becuase it reflects the new doc structure after commands.joinForward()
            console.log("handling delete", {
              currentBlockFrom,
              nextBlock,
              nextBlockPos,
              nextBlockEnd,
              origBlockPos,
              origBlock,
            });

            const { annotations } = getAnnotationState(state);
            // handle join forward block where annotation is at front
            //     currentBlockFrom
            //           |
            //           v
            // <p>block 1|</p>
            // <p>|block 2</p>
            //  ^ ^️
            //  | annotation
            //  nextBlockPos
            const frontBlockAnnotations = annotations
              .filter(({ pos }) => pos === nextBlockPos)
              .map<MoveInstruction>(({ pos, id }) => {
                return {
                  id,
                  newPos: currentBlockFrom,
                };
              });

            // handle join backwards block where annotation in middle of block
            //
            //     currentBlockFrom
            //           |
            //           v
            // <p>block 1|</p>
            // <p>bl|ock 2</p>
            //  ^   ^️
            //  |   annotation
            //  nextBlockPos
            const middleBlockAnnotations = annotations
              .filter((a) => a.pos > nextBlockPos && a.pos < nextBlockEnd)
              .map<MoveInstruction>(({ pos, id }) => {
                // middle offset is from `origBlock` start to pos
                // does not count the inclusive origBlock.pos
                const middleOffset = pos - (nextBlockPos + 1); // +1 to denote the from, not the pos
                console.log("middleoffset ", {
                  pos,
                  origBlockPos,
                  id,
                  middleOffset,
                });
                return {
                  id,
                  newPos: currentBlockFrom + middleOffset,
                };
              });
            const toMove = [
              ...frontBlockAnnotations,
              ...middleBlockAnnotations,
            ];

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
