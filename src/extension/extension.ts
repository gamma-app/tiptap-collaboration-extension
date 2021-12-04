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
  AnnotationStateEntry,
} from './types'
import { reverseOps, UndoOperation } from './UndoableYMap'

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

    undoManager.on('stack-item-popped', (event) => {
      const serialized = event.stackItem.meta.get('annotations') as
        | UndoOperation<AnnotationStateEntry>[]
        | undefined

      if (!serialized) {
        return
      }

      const { undoStack, redoStack } = undoManager

      // an undo happened add info to redo stack
      if (event.type === 'undo' && redoStack.length > 0) {
        redoStack[redoStack.length - 1].meta.set(
          'annotations',
          reverseOps(serialized)
        )
      }
      // an redo happened, add info to undo stack
      else if (event.type === 'redo' && undoStack.length > 0) {
        undoStack[undoStack.length - 1].meta.set(
          'annotations',
          reverseOps(serialized)
        )
      }
      annotationState.restore(serialized)
    })

    annotationState.map.observe(
      debounce(() => {
        console.log(
          `%c[${this.options.instance}] map.observe updated → dispatching createDecorations`,
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
