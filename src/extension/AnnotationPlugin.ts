import * as Y from "yjs";
import { Plugin, PluginKey } from "prosemirror-state";
import { AnnotationState } from "./AnnotationState";

export const AnnotationPluginKey = new PluginKey("annotation");

export interface AnnotationPluginOptions {
  onUpdate: (items: any[]) => void;
  map: Y.Map<any>;
  instance: string;
  color: string;
}

export const createAnnotationPlugin = (options: AnnotationPluginOptions) =>
  new Plugin({
    key: AnnotationPluginKey,
    state: {
      init() {
        return new AnnotationState({
          map: options.map,
          instance: options.instance,
          color: options.color,
        });
      },

      apply(transaction, pluginState, oldEditorState, newEditorState) {
        return pluginState.apply(transaction, newEditorState);
      },
    },

    props: {
      decorations(state) {
        const { decorations } = this.getState(state);
        const { selection } = state;

        if (!selection.empty) {
          return decorations;
        }

        const annotations = this.getState(state).annotationsAt(selection.from);

        options.onUpdate(annotations);

        return decorations;
      },
    },
  });
