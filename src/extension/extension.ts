// @ts-ignore
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Extension } from '@tiptap/core'
import * as Y from 'yjs'

import { createAnnotationPlugin, AnnotationPluginKey } from './AnnotationPlugin'

export interface AddAnnotationAction {
  type: 'addAnnotation'
  id: string
  pos: number
  data?: any
}

export interface CreateDecorationsAction {
  type: 'createDecorations'
}

export interface ClearAnnotationsAction {
  type: 'clearAnnotations'
}

export interface UpdateAnnotationAction {
  type: 'updateAnnotation'
  id: string
  data: any
}

export interface DeleteAnnotationAction {
  type: 'deleteAnnotation'
  id: string
}

export type MoveInstruction = {
  id: string
  newPos: number
}

export interface MoveAnnotationsAction {
  type: 'moveAnnotations'
  toMove: MoveInstruction[]
}

export interface AnnotationOptions {
  /**
   * An event listener which receives annotations for the current selection.
   */
  onUpdate: (items: any[], annotations: any[]) => void
  /**
   * An initialized Y.js document.
   */
  document: Y.Doc
  /**
   * A raw Y.js map, can be used instead of `document` and `field`.
   */
  map: Y.Map<any> | null

  instance: string

  color: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    annotation: {
      addAnnotation: (params: AddAnnotationParams) => ReturnType
      updateAnnotation: (id: string, data: any) => ReturnType
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

const getMap = (doc: any) => doc.getMap('annotations') as Y.Map<any>

export const AnnotationExtension = Extension.create({
  name: 'annotation',

  defaultOptions: {
    onUpdate: (decorations) => decorations,
    document: {} as any,
    field: 'annotations',
    map: null,
    instance: '',
    color: 'green',
  } as AnnotationOptions,

  onCreate() {
    getMap(this.options.document).observe(() => {
      console.log(
        `%c[${this.options.instance}] map.observe updated → dispatching createDecorations`,
        `color: ${this.options.color}`
      )

      this.editor.commands.refreshDecorations()
    })
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
              type: 'createDecorations',
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
    return [
      createAnnotationPlugin({
        onUpdate: this.options.onUpdate,
        map: getMap(this.options.document),
        instance: this.options.instance,
        color: this.options.color,
      }),
    ]
  },
})
