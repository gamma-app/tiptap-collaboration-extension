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

  domNodeMap: any = {};

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
    const absoluteFrom = absolutePositionToRelativePosition(
      pos,
      type,
      binding.mapping
    );
    const randomId = this.randomId();
    map.set(randomId, {
      pos: absoluteFrom,
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
      // console.log(
      //   `%c [${this.options.instance}] createDecorations Decoration.widget()`,
      //   `color: ${this.color}`,

      //   {
      //     key,
      //     // doc,
      //     annotation,
      //     from: pos,
      //     to: pos + node.nodeAfter?.nodeSize || 0,
      //   }
      // );

      decorations.push(
        Decoration.node(
          pos,
          pos + node.nodeAfter?.nodeSize || 0,
          // attrs
          {},
          {
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

    console.log("is remote change", ystate.isChangeOrigin);
    if (ystate.isChangeOrigin) {
      // REMOTE CHANGE
      // console.log(
      //   `%c [${this.options.instance}] isChangeOrigin: true → createDecorations`,
      //   `color: ${this.color}`
      // );
      // create decorations off YMap RelativeChange
      this.createDecorations(state);

      return this;
    }

    // LOCAL CHANGE
    return this.handleLocalChange(transaction, state);
  }

  handleLocalChange(transaction: Transaction, state: EditorState): this {
    return this;

    const splitBlockAtStart = transaction.getMeta("SPLIT_BLOCK_START");
    const joinBackward = transaction.getMeta("JOIN_BACKWARD");
    const joinForward = transaction.getMeta("JOIN_FORWARD");
    // console.log("in local change", transaction);
    return this;
    if (splitBlockAtStart) {
      console.log(
        `%c [${this.options.instance}] LOCAL CHANGE IS split block`,
        `color: ${this.color}`,
        splitBlockAtStart
      );

      if (splitBlockAtStart.parentOffset === 0) {
        const ranges = [
          splitBlockAtStart.from - 1,
          0,
          splitBlockAtStart.offset,
        ];
        // transaction.mapping.appendMap();
        this.decorations = this.decorations.map(
          new Mapping([new StepMap(ranges)]),
          transaction.doc
        );
        // can't create decorations at this point, need to wait until state
        // this.createDecorations(state);
        return this;
      }
      return this;
      // check split at decoration
      const decos = this.decorations.find(
        splitBlockAtStart.from,
        splitBlockAtStart.from
      );
      if (decos.length > 0) {
        // split inbetween the decoration
        // recreate from YMap
        console.log("recreating decorations");
        this.createDecorations(state);
        return this;
      }
    } else if (joinBackward) {
      console.log(
        `%c [${this.options.instance}] LOCAL CHANGE IS join backward`,
        `color: ${this.color}`,
        joinBackward,
        this.options.map.toJSON()
      );

      const decos = this.decorations.find(
        joinBackward.joinedPos,
        joinBackward.joinedPos + joinBackward.joinedNode.nodeSize
      );
      if (decos.length > 0) {
        this.createDecorations(state);
        return this;
      }
    } else if (joinForward) {
      // console.log(
      //   `%c [${this.options.instance}] LOCAL CHANGE IS join forward`,
      //   `color: ${this.color}`,
      //   joinForward
      // );

      const decos = this.decorations.find(
        joinForward.joinedPos,
        joinForward.joinedPos + joinForward.joinedNode.nodeSize
      );
      // console.log(
      //   "join forward finding ",
      //   [
      //     joinForward.joinedPos,
      //     joinForward.joinedPos + joinForward.joinedNode.nodeSize,
      //   ],
      //   decos
      // );
      if (decos.length > 0) {
        this.createDecorations(state);
        return this;
      }
    }

    // console.log(
    //   `%c [${this.options.instance}] LOCAL CHANGE no special block stuff, mapping decorations`,
    //   `color: ${this.color}`
    // );
    this.decorations = this.decorations.map(
      transaction.mapping,
      transaction.doc
    );
    return this;
  }
}
