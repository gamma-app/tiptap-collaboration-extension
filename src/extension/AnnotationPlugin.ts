import { Plugin, PluginKey } from 'prosemirror-state'

import { AnnotationItem } from './AnnotationItem'
import { AnnotationState } from './AnnotationState'
import { AnnotationPluginParams } from './types'

export const AnnotationPluginKey = new PluginKey('annotation')

export const createAnnotationPlugin = (options: AnnotationPluginParams) =>
  new Plugin({
    key: AnnotationPluginKey,

    state: {
      init() {
        return new AnnotationState(options)
      },

      apply(transaction, pluginState, oldEditorState, newEditorState) {
        return pluginState.apply(transaction, newEditorState)
      },
    },

    props: {
      decorations(state) {
        const { decorations, annotations } = this.getState(
          state
        ) as AnnotationState

        options.onUpdate(
          decorations.find().map((d) => new AnnotationItem(d)),
          annotations
        )

        return decorations
      },
    },
  })
