// @ts-ignore
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Extension } from '@tiptap/core'
import debounce from 'lodash/debounce'
import { yUndoPluginKey } from 'y-prosemirror'
import * as Y from 'yjs'

import { createAnnotationPlugin, AnnotationPluginKey } from './AnnotationPlugin'
import { AnnotationState } from './AnnotationState'
import {
  MoveInstruction,
  AnnotationOptions,
  AddAnnotationAction,
  DeleteAnnotationAction,
  AnnotationStateYMap,
} from './types'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotation: {
      addAnnotation: (params: AddAnnotationParams) => ReturnType
      deleteAnnotation: (id: string) => ReturnType
      clearAnnotations: () => ReturnType
      refreshDecorations: () => ReturnType
      moveAnnotations: (toMove: MoveInstruction[]) => ReturnType
    }
  }
}

type AddAnnotationParams = {
  id: string
  pos: number
  data?: any
}

const getMap = (doc: Y.Doc) => doc.getMap('annotations') as AnnotationStateYMap

export const AnnotationExtension = Extension.create({
  name: 'annotation',

  addOptions() {
    return {
      instance: '',
      color: 'green',
    } as AnnotationOptions
  },

  onCreate() {
    const undoManager: Y.UndoManager = yUndoPluginKey.getState(
      this.editor.state
    ).undoManager

    const annotationState: AnnotationState = AnnotationPluginKey.getState(
      this.editor.state
    )

    undoManager.on('stack-item-added', (event) => {
      const serialized = annotationState.serialize()
      console.log('jordan saving', serialized)
      event.stackItem.meta.set('annotations', serialized)
    })

    undoManager.on('stack-item-popped', (event) => {
      const serialized = event.stackItem.meta.get('annotations') as Y.Map<any>
      if (!serialized) {
        return
      }
      annotationState.restore(serialized)
    })

    getMap(this.options.document).observe(
      debounce(() => {
        console.log(
          `%c[${this.options.instance}] jordan map.observe updated → dispatching createDecorations`,
          `color: ${this.options.color}`
        )

        this.editor.commands.refreshDecorations()
      })
    )
  },

  addCommands() {
    return {
      moveAnnotations:
        (toMove: MoveInstruction[]) =>
        ({ dispatch, tr }) => {
          if (dispatch) {
            tr.setMeta(AnnotationPluginKey, {
              type: 'moveAnnotations',
              toMove,
            })
            dispatch(tr)
          }

          return true
        },
      clearAnnotations:
        () =>
        ({ dispatch, tr }) => {
          if (dispatch) {
            tr.setMeta(AnnotationPluginKey, {
              type: 'clearAnnotations',
            })
            dispatch(tr)
          }

          return true
        },
      refreshDecorations:
        () =>
        ({ dispatch, tr }) => {
          if (dispatch) {
            tr.setMeta(AnnotationPluginKey, {
              type: 'refreshAnnotationDecorations',
            })
            dispatch(tr)
          }

          return true
        },
      addAnnotation:
        ({ pos, id, data }: AddAnnotationParams) =>
        ({ dispatch, state }) => {
          if (dispatch) {
            state.tr.setMeta(AnnotationPluginKey, <AddAnnotationAction>{
              type: 'addAnnotation',
              id,
              data,
              pos,
            })
          }

          return true
        },
      deleteAnnotation:
        (id) =>
        ({ dispatch, state }) => {
          if (dispatch) {
            state.tr.setMeta(AnnotationPluginKey, <DeleteAnnotationAction>{
              type: 'deleteAnnotation',
              id,
            })
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const { document, onUpdate, instance, color } = this.options

    return [
      createAnnotationPlugin({
        map: getMap(document),
        instance,
        color,
        onUpdate,
      }),
    ]
  },
})
