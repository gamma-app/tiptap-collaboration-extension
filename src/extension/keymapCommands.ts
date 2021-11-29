import { Command, findChildren } from "@tiptap/core";
import { EditorState } from "prosemirror-state";
import { Node } from "prosemirror-model";
import { AnnotationPluginKey } from "./AnnotationPlugin";
import { AnnotationState } from "./AnnotationState";
import { MoveInstruction } from ".";
import {
  ySyncPluginKey,
  relativePositionToAbsolutePosition,
} from "y-prosemirror";
import { RelativePosition } from "yjs";

const getPos = (doc: any, curr: Node) => {
  const results = findChildren(doc, (node) => node === curr);
  if (!results) {
    throw new Error();
  }
  return results[0]?.pos;
};

const getAnnotationState = (state: EditorState): AnnotationState => {
  return AnnotationPluginKey.getState(state) as AnnotationState;
};

const toAbsPosition = (state: EditorState, pos: RelativePosition) => {
  const ystate = ySyncPluginKey.getState(state);
  if (!ystate.binding) {
    return this;
  }
  const { doc, type, binding } = ystate;
  return relativePositionToAbsolutePosition(doc, type, pos, binding.mapping);
};

// helper function to create comparator
const relativePosEq =
  (state: EditorState, match: number) =>
  ({ relativePos }: { relativePos: RelativePosition }) =>
    toAbsPosition(state, relativePos) === match;

const relativePosBetween =
  (state: EditorState, start: number, end: number) =>
  ({ relativePos }: { relativePos: RelativePosition }) => {
    const pos = toAbsPosition(state, relativePos);
    return pos > start && pos < end;
  };

export const splitBlockWithAnnotations: Command = ({
  tr,
  editor,
  commands,
  state,
  view,
}) => {
  // If a block is split from the very front
  // (i.e. moving the entire block),
  // mark the transaction so that the annotation
  // decoration can be moved with it
  const beforeBlockFrom = tr.selection.$from.pos;
  const beforeBlock = tr.selection.$from.parent;
  const beforeBlockPos = getPos(state.doc, beforeBlock);

  // handle split block at beginning of line
  if (view.endOfTextblock("backward")) {
    const result = commands.splitBlock();
    if (result) {
      tr.setMeta("SPLIT_BLOCK_START", {});
      requestAnimationFrame(() => {
        editor.commands.refreshDecorations();
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
      .filter(relativePosEq(state, beforeBlockFrom))
      .map<MoveInstruction>(({ id }) => {
        return {
          id,
          newPos: newBlockPos,
        };
      });

    const middleBlockAnnotations = annotations
      // TODO should memoize relative position stuff
      // or re-compute in the state
      .filter(relativePosBetween(state, beforeBlockFrom, origBlockEnd))
      .map<MoveInstruction>(({ id, relativePos }) => {
        return {
          id,
          newPos:
            newBlockPos +
            (toAbsPosition(state, relativePos) - beforeBlockFrom + 1),
        };
      });

    const annotationsToMove = [
      ...frontBlockAnnotations,
      ...middleBlockAnnotations,
    ];
    if (annotationsToMove.length > 0) {
      requestAnimationFrame(() => {
        editor.commands.moveAnnotations(annotationsToMove);
      });
    } else {
      requestAnimationFrame(() => {
        editor.commands.refreshDecorations();
      });
    }
  }
  return result;
};

export const joinBackwardWithAnnotations: Command = ({
  tr,
  editor,
  commands,
  state,
  view,
}) => {
  if (!view.endOfTextblock("backward")) {
    return false;
  }
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
      .filter(relativePosEq(state, currentBlockPos))
      .map<MoveInstruction>(({ id }) => {
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
      .filter(relativePosBetween(state, origBlockPos, origBlockEnd))
      .map<MoveInstruction>(({ relativePos, id }) => {
        // middle offset is from `origBlock` start to pos
        // does not count the inclusive origBlock.pos
        const pos = toAbsPosition(state, relativePos);
        const middleOffset = pos - (origBlockPos + 1); // +1 to denote the from, not the pos
        return {
          id,
          newPos: newBlockFrom + middleOffset,
        };
      });
    const toMove = [...frontBlockAnnotations, ...middleBlockAnnotations];

    // TODO account for when some move and some dont
    // maybe the map.observe handle this okay
    if (toMove.length > 0) {
      requestAnimationFrame(() => {
        editor.commands.moveAnnotations(toMove);
      });
    } else {
      requestAnimationFrame(() => {
        editor.commands.refreshDecorations();
      });
    }
  }
  return joinBackward;
};

export const joinForwardWithAnnotations: Command = ({
  tr,
  editor,
  commands,
  state,
  view,
}) => {
  if (!view.endOfTextblock("forward")) {
    return false;
  }
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
      .filter(relativePosEq(state, nextBlockPos))
      .map<MoveInstruction>(({ id }) => {
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
      .filter(relativePosBetween(state, nextBlockPos, nextBlockEnd))
      .map<MoveInstruction>(({ relativePos, id }) => {
        // middle offset is from `origBlock` start to pos
        // does not count the inclusive origBlock.pos
        const pos = toAbsPosition(state, relativePos);
        const middleOffset = pos - (nextBlockPos + 1); // +1 to denote the from, not the pos
        return {
          id,
          newPos: currentBlockFrom + middleOffset,
        };
      });
    const toMove = [...frontBlockAnnotations, ...middleBlockAnnotations];

    if (toMove.length > 0) {
      requestAnimationFrame(() => {
        editor.commands.moveAnnotations(toMove);
      });
    } else {
      requestAnimationFrame(() => {
        editor.commands.refreshDecorations();
      });
    }
  }
  return joinForward;
};
