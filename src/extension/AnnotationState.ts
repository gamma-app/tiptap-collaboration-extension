import * as Y from "yjs";
import { EditorState, Transaction } from "prosemirror-state";
import { Mapping, StepMap } from "prosemirror-transform";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  ySyncPluginKey,
  relativePositionToAbsolutePosition,
  absolutePositionToRelativePosition,
} from "y-prosemirror";
import {
  AddAnnotationAction,
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

  addAnnotation(action: AddAnnotationAction, state: EditorState) {
    const ystate = ySyncPluginKey.getState(state);
    const { type, binding } = ystate;
    const { map } = this.options;
    const { from, data } = action;
    const absoluteFrom = absolutePositionToRelativePosition(
      from,
      type,
      binding.mapping
    );
    const randomId = this.randomId();
    map.set(randomId, {
      from: absoluteFrom,
      data,
    });
  }

  updateAnnotation(action: UpdateAnnotationAction) {
    console.log(
      `%c [${this.options.instance}] update annotation`,
      `color: ${this.color}`
    );
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

  createDecorations(state: EditorState, debug = false) {
    console.log(
      `%c [${this.options.instance}] calling create decorations`,
      `color: ${this.color}`
    );
    const { map } = this.options;
    const ystate = ySyncPluginKey.getState(state);
    const { doc, type, binding } = ystate;
    const decorations: Decoration[] = [];
    if (debug) {
      console.log("debug from other editor", type, binding);
    }

    map.forEach((annotation, key) => {
      const from = relativePositionToAbsolutePosition(
        doc,
        type,
        annotation.from,
        binding.mapping
      );

      if (!from) {
        return;
      }

      console.log(
        `%c [${this.options.instance}] Decoration.widget()`,
        `color: ${this.color}`,
        from,
        { key, data: annotation.data }
      );

      if (!this.domNodeMap[key]) {
        const el = document.createElement("span");
        el.classList.add("widget", "widget-" + key);
        this.domNodeMap[key] = el;
      }

      decorations.push(
        Decoration.widget(
          from,
          () => {
            const node = this.domNodeMap[key];
            node.innerHTML = annotation.data;
            return node;
          },
          {
            key,
            side: -1,
            destroy(node) {
              console.log("DESTROYED!", node);
            },
          }
        )
      );
    });

    this.decorations = DecorationSet.create(state.doc, decorations);
  }

  apply(transaction: Transaction, state: EditorState) {
    // Add/Remove annotations
    const action = transaction.getMeta(AnnotationPluginKey) as
      | AddAnnotationAction
      | UpdateAnnotationAction
      | DeleteAnnotationAction;

    if (action && action.type) {
      console.log(
        `%c [${this.options.instance}] action: ${action.type}`,
        `color: ${this.color}`
      );

      if (action.type === "addAnnotation") {
        this.addAnnotation(action, state);
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

      return this;
    }

    // Use Y.js to update positions
    const ystate = ySyncPluginKey.getState(state);

    if (ystate.isChangeOrigin) {
      // REMOTE CHANGE
      console.log(
        `%c [${this.options.instance}] isChangeOrigin: true → createDecorations`,
        `color: ${this.color}`
      );
      this.createDecorations(state, true);

      return this;
    }

    // LOCAL CHANGE
    //Use ProseMirror to update positions
    console.log(
      `%c [${this.options.instance}] isChangeOrigin: false → ProseMirror mapping`,
      `color: ${this.color}`
    );

    this.decorations = this.decorations.map(
      transaction.mapping,
      transaction.doc,
      {
        onRemove: (d) => {
          console.log("onRemove", d);
        },
      }
    );

    const splitBlockAtStart = transaction.getMeta("SPLIT_BLOCK_START");
    this.options.map.doc?.transact(() => {
      this.decorations.find().forEach((deco) => {
        const { from: currentFrom } = deco;
        let finalFrom = currentFrom;

        if (splitBlockAtStart) {
          const { from: splitFrom, offset } = splitBlockAtStart;
          if (splitFrom === currentFrom) {
            console.log(
              `%c [${this.options.instance}] split at start:, ${{
                splitFrom,
                offset,
              }}`,
              `color: ${this.color}`
            );

            finalFrom = currentFrom + offset;
          }
        }

        const newFrom = absolutePositionToRelativePosition(
          finalFrom,
          ystate.type,
          ystate.binding.mapping
        );

        const { key } = deco.spec;
        const annotation = this.options.map.get(key);

        annotation.from = newFrom;

        this.options.map.set(key, annotation);
      });
    }, AnnotationPluginKey);

    this.createDecorations(state);

    return this;
  }
}
