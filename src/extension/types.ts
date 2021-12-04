import { Decoration } from 'prosemirror-view'
import * as Y from 'yjs'

import { AnnotationItem } from './AnnotationItem'

export interface AddAnnotationAction {
  type: 'addAnnotation'
  id: string
  pos: number
  data?: any
}

export interface RefreshAnnotationDecorationsAction {
  type: 'refreshAnnotationDecorations'
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

export type AnnotationActions =
  | AddAnnotationAction
  | ClearAnnotationsAction
  | MoveAnnotationsAction
  | RefreshAnnotationDecorationsAction
  | DeleteAnnotationAction

export type AnnotationOptions = {
  /**
   * An event listener which receives annotations for the current selection.
   */
  onUpdate: (items: AnnotationItem[], annotations: any[]) => void

  document: Y.Doc

  instance: string

  color: string
}

export type AnnotationData = {
  data: string
  id: string
  relativePos: Y.RelativePosition
  pos: number
}

export type AnnotationStateYMap = Y.Map<AnnotationStateEntry>

export type AnnotationStateEntry = {
  id: string
  data: any
  pos: Y.RelativePosition
}

export type AnnotationPluginParams = Omit<AnnotationOptions, 'document'> & {
  map: AnnotationStateYMap
}

export type AnnotationDecoration = Decoration<{
  id: string
  isAnnotation: true
}>
