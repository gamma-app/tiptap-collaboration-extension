import * as Y from "yjs";
import { EditorState, Transaction } from "prosemirror-state";
import { Mapping, StepMap, Transform } from "prosemirror-transform";
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

export interface AnnotationStateOptions {
  map: Y.Map<any>;
  instance: string;
  color: string;
}

export class AnnotationState {
  options: AnnotationStateOptions;

  decorations = DecorationSet.empty;

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
    // console.log(
    //   `%c [${this.options.instance}] update annotation`,
    //   `color: ${this.color}`
    // );
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

    map.forEach((annotation, key) => {
      const pos = relativePositionToAbsolutePosition(
        doc,
        type,
        annotation.pos,
        binding.mapping
      );

      if (!pos) {
        return;
      }

      const node = state.doc.resolve(pos);
      decorations.push(
        Decoration.node(
          pos,
          pos + node.nodeAfter?.nodeSize || 0,
          // attrs
          {},
          {
            id: key,
            data: annotation.data,
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

      // @ts-ignore
      if (action.type === "createDecorations") {
        this.createDecorations(state);
      }

      // @ts-ignore
      if (action.type === "refreshDecorations") {
        this.createDecorations(state);
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
      console.log("handling local join forward");
      // TODO figure out if we need to do decorations.map here
      return this;
    }

    decorationsToUpdate.forEach((deco) => {
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

    if (joinBlock) {
      return this.handleLocalJoinBlock(
        joinBlock.currentDecorationPos,
        joinBlock.newDecorationPos,
        state
      );
    }

    if (splitBlockAtStart) {
      // splitting block
      // refreshDecorations call in KeymapOverride will handle updating
      return this;
    }

    // no special cases, allow decoration mapping to happen
    this.decorations = this.decorations.map(
      transaction.mapping,
      transaction.doc
    );
    return this
  }
}
