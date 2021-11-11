import * as Y from "yjs";
import { Extension } from "@tiptap/core";
import { findParentNodeClosestToPos } from "prosemirror-utils";

import { AnnotationPlugin, AnnotationPluginKey } from "./AnnotationPlugin";

export interface AddAnnotationAction {
  type: "addAnnotation";
  data: any;
  from: number;
  to: number;
}

export interface UpdateAnnotationAction {
  type: "updateAnnotation";
  id: string;
  data: any;
}

export interface DeleteAnnotationAction {
  type: "deleteAnnotation";
  id: string;
}

export interface AnnotationOptions {
  HTMLAttributes: {
    [key: string]: any;
  };
  /**
   * An event listener which receives annotations for the current selection.
   */
  onUpdate: (items: [any?]) => void;
  /**
   * An initialized Y.js document.
   */
  document: Y.Doc | null;
  /**
   * Name of a Y.js map, can be changed to sync multiple fields with one Y.js document.
   */
  field: string;
  /**
   * A raw Y.js map, can be used instead of `document` and `field`.
   */
  map: Y.Map<any> | null;
  instance: string;

  color: string;
}

function getMapFromOptions(options: AnnotationOptions): Y.Map<any> {
  return options.map
    ? options.map
    : (options.document?.getMap(options.field) as Y.Map<any>);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    annotation: {
      addAnnotation: (data: any) => ReturnType;
      updateAnnotation: (id: string, data: any) => ReturnType;
      deleteAnnotation: (id: string) => ReturnType;
    };
  }
}

export const CollaborationAnnotation = Extension.create({
  name: "annotation",

  priority: 1000,

  defaultOptions: <AnnotationOptions>{
    HTMLAttributes: {
      class: "annotation",
    },
    onUpdate: (decorations) => decorations,
    document: null,
    field: "annotations",
    map: null,
    instance: "",
    color: "green",
  },

  onCreate() {
    const map = getMapFromOptions(this.options);

    map.observe(() => {
      console.log(
        `%c [${this.options.instance}] map.observe updated  → createDecorations`,
        `color: ${this.options.color}`
      );

      const transaction = this.editor.state.tr.setMeta(AnnotationPluginKey, {
        type: "createDecorations",
      });

      this.editor.view.dispatch(transaction);
    });
  },

  addCommands() {
    return {
      addAnnotation:
        (data: any) =>
        ({ dispatch, state, tr }) => {
          const { selection } = state;
          const parent = findParentNodeClosestToPos(
            this.editor.state.doc.resolve(selection.from),
            (node) => node.type.isBlock
          );

          if (!parent) {
            return false;
          }
          const from = parent.start;
          console.log("addAnnotation", { from, parent });

          if (dispatch && data) {
            state.tr.setMeta(AnnotationPluginKey, <AddAnnotationAction>{
              type: "addAnnotation",
              from,
              data,
            });
          }

          return true;
        },
      updateAnnotation:
        (id: string, data: any) =>
        ({ dispatch, state }) => {
          if (dispatch) {
            state.tr.setMeta(AnnotationPluginKey, <UpdateAnnotationAction>{
              type: "updateAnnotation",
              id,
              data,
            });
          }

          return true;
        },
      deleteAnnotation:
        (id) =>
        ({ dispatch, state }) => {
          if (dispatch) {
            state.tr.setMeta(AnnotationPluginKey, <DeleteAnnotationAction>{
              type: "deleteAnnotation",
              id,
            });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      AnnotationPlugin({
        HTMLAttributes: this.options.HTMLAttributes,
        onUpdate: this.options.onUpdate,
        map: getMapFromOptions(this.options),
        instance: this.options.instance,
        color: this.options.color,
      }),
    ];
  },
});
