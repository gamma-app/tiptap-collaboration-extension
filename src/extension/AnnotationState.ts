import * as Y from "yjs";
import { EditorState, Transaction } from "prosemirror-state";
import { findChildren } from "prosemirror-utils";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  ySyncPluginKey,
  relativePositionToAbsolutePosition,
  absolutePositionToRelativePosition,
} from "y-prosemirror";
import {
  AddAnnotationAction,
  ClearAnnotationsAction,
  DeleteAnnotationAction,
  UpdateAnnotationAction,
} from "./extension";
import { AnnotationPluginKey } from "./AnnotationPlugin";
import { AnnotationItem } from "./AnnotationItem";
import { CreateDecorationsAction, MoveAnnotationsAction } from ".";

export interface AnnotationStateOptions {
  map: Y.Map<any>;
  instance: string;
  color: string;
}

export type AnnotationData = {
  data: string;
  id: string;
  pos: number;
  start: number;
  end: number;
};

export class AnnotationState {
  options: AnnotationStateOptions;

  decorations = DecorationSet.empty;

  annotations: AnnotationData[] = [];

  color: string;

  constructor(options: AnnotationStateOptions) {
    this.options = options;
    this.color = options.color;
  }

  randomId() {
    // TODO: That seems … to simple.
    return Math.floor(Math.random() * 0xffffffff).toString();
  }

  findAnnotation(key: string) {
    const current = this.decorations.find();

    for (let i = 0; i < current.length; i += 1) {
      if (current[i].spec.key === key) {
        return current[i];
      }
    }
  }

  clearAnnotations(action: ClearAnnotationsAction, state: EditorState) {
    const ystate = ySyncPluginKey.getState(state);
    if (!ystate.binding) {
      return this;
    }
    this.options.map.clear();
  }

  addAnnotation(action: AddAnnotationAction, state: EditorState) {
    const ystate = ySyncPluginKey.getState(state);
    const { type, binding } = ystate;
    if (!ystate.binding) {
      return this;
    }
    const { map } = this.options;
    const { pos, data } = action;
    const relativePos = absolutePositionToRelativePosition(
      pos,
      type,
      binding.mapping
    );
    const randomId = this.randomId();
    map.set(randomId, {
      pos: relativePos,
      data,
    });
  }

  updateAnnotation(action: UpdateAnnotationAction) {
    const { map } = this.options;

    const annotation = map.get(action.id);

    map.set(action.id, {
      from: annotation.from,
      data: action.data,
    });
  }

  deleteAnnotation(id: string) {
    const { map } = this.options;

    map.delete(id);
  }

  // helpers for relative position
  absToRel(state: EditorState, abs: number): Y.RelativePosition {
    const ystate = ySyncPluginKey.getState(state);
    const { type, binding } = ystate;
    if (!ystate.binding) {
      throw new Error("Y.State non initialized");
    }
    return absolutePositionToRelativePosition(abs, type, binding.mapping);
  }

  relToAbs(state: EditorState, rel: Y.RelativePosition): number {
    const ystate = ySyncPluginKey.getState(state);
    const { doc, type, binding } = ystate;
    if (!ystate.binding) {
      throw new Error("Y.State non initialized");
    }
    return relativePositionToAbsolutePosition(doc, type, rel, binding.mapping);
  }

  moveAnnotation(state: EditorState, id: string, newPos: number) {
    console.log(
      `%c[${this.options.instance}] move annotation`,
      `color: ${this.color}`,
      {
        id,
        newPos,
      }
    );
    // update decoration position
    const { map } = this.options;
    const existing = map.get(id);
    map.set(id, {
      ...existing,
      pos: this.absToRel(state, newPos),
    });
    return this;
  }

  annotationsAt(position: number) {
    return this.decorations.find(position, position).map((decoration) => {
      return new AnnotationItem(decoration);
    });
  }

  createDecorations(state: EditorState) {
    const { map } = this.options;
    const ystate = ySyncPluginKey.getState(state);
    if (!ystate.binding) {
      return this;
    }
    const { doc, type, binding } = ystate;
    const decorations: Decoration[] = [];

    this.annotations = [];
    map.forEach((annotation, key) => {
      const pos = relativePositionToAbsolutePosition(
        doc,
        type,
        annotation.pos,
        binding.mapping
      );
      console.log(
        `%c[${this.options.instance}] creating decoration from annotation`,
        `color: ${this.color}`,
        {
          data: annotation.data,
          pos,
        }
      );

      if (!pos) {
        return;
      }

      const node = state.doc.resolve(pos);
      const getPos = (curr) => {
        const results = findChildren(state.doc, (node) => node === curr);
        if (!results) {
          throw new Error();
        }
        return results[0].pos;
      };

      // console.log("start", {
      //   node,
      //   nodeAfter: node.nodeAfter,
      //   parent: node.parent,
      //   start: node.nodeAfter?.isBlock ? pos : getPos(node.parent),
      // });

      const start = node.nodeAfter?.isBlock ? pos : getPos(node.parent);
      const end =
        start +
        (node.nodeAfter?.isBlock
          ? node.nodeAfter.nodeSize
          : node.parent.nodeSize);
      console.log(
        `%c[${this.options.instance}] creating decoration`,
        `color: ${this.color}`,
        {
          pos,
          node,
          start,
          end,
        }
      );

      this.annotations.push({
        data: annotation.data,
        id: key,
        pos,
        start,
        end,
      });
      decorations.push(
        Decoration.node(
          start,
          end,
          // attrs
          {},
          {
            id: key,
            data: annotation.data,
            pos,
            destroy(node) {
              console.log("DESTROYED!", node);
            },
          }
        )
      );
    });

    this.decorations = DecorationSet.create(state.doc, decorations);
    return this;
  }

  apply(transaction: Transaction, state: EditorState, oldState: EditorState) {
    // Add/Remove annotations
    const action = transaction.getMeta(AnnotationPluginKey) as
      | AddAnnotationAction
      | UpdateAnnotationAction
      | ClearAnnotationsAction
      | MoveAnnotationsAction
      | CreateDecorationsAction
      | DeleteAnnotationAction;

    if (action && action.type) {
      if (action.type === "addAnnotation") {
        this.addAnnotation(action, state);
      }

      if (action.type === "clearAnnotations") {
        this.clearAnnotations(action, state);
      }

      if (action.type === "updateAnnotation") {
        this.updateAnnotation(action);
      }

      if (action.type === "deleteAnnotation") {
        this.deleteAnnotation(action.id);
      }

      if (action.type === "createDecorations") {
        this.createDecorations(state);
      }

      if (action.type === "moveAnnotations") {
        action.toMove.forEach((data) => {
          this.moveAnnotation(state, data.id, data.newPos);
        });
      }

      return this;
    }

    // Use Y.js to update positions
    const ystate = ySyncPluginKey.getState(state);

    // always re-render decorations for remote changes
    if (ystate.isChangeOrigin) {
      this.createDecorations(state);
      return this;
    }

    // LOCAL CHANGE
    return this.handleLocalChange(transaction, state);
  }

  /**
   * Updates decoration position to the joined block
   * NextBlock
   * @param transaction
   * @param state
   * @returns
   */
  handleLocalJoinBlock(
    currentBlockPos: number,
    joinedBlockPos: number,
    state: EditorState
  ): this {
    console.log(`${this.options.instance} decoration handleLocalJoinBlcok`, {
      currentBlockPos,
      joinedBlockPos,
    });
    // update decoration position
    const ystate = ySyncPluginKey.getState(state);
    const { type, binding } = ystate;
    if (!ystate.binding) {
      return this;
    }
    const { map } = this.options;
    const decorationsToUpdate = this.decorations.find(
      currentBlockPos,
      currentBlockPos
    );
    console.log(
      `found current decorations at ${currentBlockPos}`,
      decorationsToUpdate
    );
    if (decorationsToUpdate.length === 0) {
      // TODO figure out if we need to do decorations.map here
      return this;
    }

    decorationsToUpdate.forEach((deco) => {
      console.log(
        `${this.options.instance} updating decoration from ${currentBlockPos} to ${joinedBlockPos}`
      );
      const relativePos = absolutePositionToRelativePosition(
        joinedBlockPos,
        type,
        binding.mapping
      );
      const id = deco.spec.id;
      const existing = map.get(deco.spec.id);
      map.set(id, {
        ...existing,
        pos: relativePos,
      });
    });
    return this;
  }

  handleLocalChange(transaction: Transaction, state: EditorState): this {
    const splitBlockAtStart = transaction.getMeta("SPLIT_BLOCK_START");
    const joinBlock = transaction.getMeta("JOIN_BLOCK");

    if (joinBlock || splitBlockAtStart) {
      return this;
    }

    // no special cases, allow decoration mapping to happen
    this.decorations = this.decorations.map(
      transaction.mapping,
      transaction.doc
    );
    return this;
  }
}
