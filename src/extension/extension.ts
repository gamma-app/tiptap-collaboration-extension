/* eslint-disable @typescript-eslint/consistent-type-assertions */
import * as Y from "yjs";
import { Extension } from "@tiptap/core";
import { findParentNodeClosestToPos } from "prosemirror-utils";

import {
  createAnnotationPlugin,
  AnnotationPluginKey,
} from "./AnnotationPlugin";

export interface AddAnnotationAction {
  type: "addAnnotation";
  data: any;
  pos: number;
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
  /**
   * An event listener which receives annotations for the current selection.
   */
  onUpdate: (items: any[]) => void;
  /**
   * An initialized Y.js document.
   */
  document: Y.Doc;
  /**
   * A raw Y.js map, can be used instead of `document` and `field`.
   */
  map: Y.Map<any> | null;

  instance: string;

  color: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    annotation: {
      addAnnotation: (data: any) => ReturnType;
      updateAnnotation: (id: string, data: any) => ReturnType;
      deleteAnnotation: (id: string) => ReturnType;
      refreshDecorations: () => ReturnType;
    };
  }
}

const getMap = (doc: any) => doc.getMap("annotations") as Y.Map<any>;

export const CollaborationAnnotation = Extension.create({
  name: "annotation",

  defaultOptions: {
    onUpdate: (decorations) => decorations,
    document: null,
    field: "annotations",
    map: null,
    instance: "",
    color: "green",
  } as AnnotationOptions,

  onCreate() {
    getMap(this.options.document).observe((ev) => {
      // console.log(
      //   `%c [${this.options.instance}] map.observe updated → dispatching createDecorations`,
      //   `color: ${this.options.color}`
      // );

      this.editor.commands.refreshDecorations();
    });
  },

  addCommands() {
    return {
      refreshDecorations:
        () =>
        ({ dispatch, state, tr }) => {
          if (dispatch) {
            tr.setMeta(AnnotationPluginKey, {
              type: "createDecorations",
            });
            dispatch(tr);
          }

          return true;
        },
      addAnnotation:
        (data: any) =>
        ({ dispatch, state, tr }) => {
          const { selection } = state;
          const blockParent = findParentNodeClosestToPos(
            this.editor.state.doc.resolve(selection.from),
            (node) => node.type.isBlock
          );

          if (!blockParent) {
            return false;
          }
          const { pos } = blockParent;

          if (dispatch && data) {
            state.tr.setMeta(AnnotationPluginKey, <AddAnnotationAction>{
              type: "addAnnotation",
              pos,
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
      createAnnotationPlugin({
        onUpdate: this.options.onUpdate,
        map: getMap(this.options.document),
        instance: this.options.instance,
        color: this.options.color,
      }),
    ];
  },
});
