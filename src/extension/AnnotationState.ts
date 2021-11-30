import { EditorState, Transaction } from 'prosemirror-state'
import { findChildren } from 'prosemirror-utils'
import { Decoration, DecorationSet } from 'prosemirror-view'
import {
  ySyncPluginKey,
  relativePositionToAbsolutePosition,
  absolutePositionToRelativePosition,
} from 'y-prosemirror'
import * as Y from 'yjs'

import { AnnotationPluginKey } from './AnnotationPlugin'
import {
  AddAnnotationAction,
  ClearAnnotationsAction,
  DeleteAnnotationAction,
} from './extension'

import { CreateDecorationsAction, MoveAnnotationsAction } from '.'

export interface AnnotationStateOptions {
  map: Y.Map<any>
  instance: string
  color: string
}

export type AnnotationData = {
  data: string
  id: string
  start: number
  end: number
  relativePos: Y.RelativePosition
}

export class AnnotationState {
  options: AnnotationStateOptions

  decorations = DecorationSet.empty

  annotations: AnnotationData[] = []

  color: string

  constructor(options: AnnotationStateOptions) {
    this.options = options
    this.color = options.color
  }

  clearAnnotations(action: ClearAnnotationsAction, state: EditorState) {
    const ystate = ySyncPluginKey.getState(state)
    if (!ystate.binding) {
      return this
    }
    // TODO fix this
    // @ts-ignore
    this.options.map.forEach((val, key) => {
      this.options.map.delete(key)
    })
    return this
  }

  addAnnotation(action: AddAnnotationAction, state: EditorState) {
    const { map } = this.options
    const { pos, id, data } = action
    const relativePos = this.absToRel(state, pos)
    map.set(id, {
      id,
      pos: relativePos,
      data,
    })
  }

  deleteAnnotation(id: string) {
    const { map } = this.options

    map.delete(id)
  }

  moveAnnotation(state: EditorState, id: string, newPos: number) {
    console.log(
      `%c[${this.options.instance}] move annotation`,
      `color: ${this.color}`,
      {
        id,
        newPos,
      }
    )
    // update decoration position
    const { map } = this.options
    const existing = map.get(id)
    map.set(id, {
      ...existing,
      pos: this.absToRel(state, newPos),
    })
    return this
  }

  createDecorations(state: EditorState) {
    const { map } = this.options
    const ystate = ySyncPluginKey.getState(state)
    if (!ystate.binding) {
      return this
    }
    const { doc, type, binding } = ystate
    const decorations: Decoration[] = []
    const annotations: AnnotationData[] = []

    map.forEach((annotation, key) => {
      const pos = relativePositionToAbsolutePosition(
        doc,
        type,
        annotation.pos,
        binding.mapping
      )

      if (!pos) {
        return
      }

      const node = state.doc.resolve(pos)
      const getPos = (curr) => {
        const results = findChildren(state.doc, (node) => node === curr)
        if (!results) {
          throw new Error()
        }
        return results[0].pos
      }

      const start = node.nodeAfter?.isBlock ? pos : getPos(node.parent)
      const end =
        start +
        (node.nodeAfter?.isBlock
          ? node.nodeAfter.nodeSize
          : node.parent.nodeSize)

      console.log(
        `%c[${this.options.instance}] creating decoration`,
        `color: ${this.color}`,
        {
          pos,
          data: annotation.data,
          start,
          end,
        }
      )

      annotations.push({
        id: key,
        data: annotation.data,
        relativePos: annotation.pos,
        start,
        end,
      })
      decorations.push(
        Decoration.node(
          start,
          end,
          // attrs
          {},
          {
            isAnnotation: true,
            id: key,
            data: annotation.data,
            // pos,
          }
        )
      )
    })

    this.decorations = DecorationSet.create(state.doc, decorations)
    this.annotations = annotations
    return this
  }

  apply(transaction: Transaction, state: EditorState) {
    // Add/Remove annotations
    const action = transaction.getMeta(AnnotationPluginKey) as
      | AddAnnotationAction
      | ClearAnnotationsAction
      | MoveAnnotationsAction
      | CreateDecorationsAction
      | DeleteAnnotationAction

    if (action && action.type) {
      if (action.type === 'addAnnotation') {
        this.addAnnotation(action, state)
      }

      if (action.type === 'clearAnnotations') {
        this.clearAnnotations(action, state)
      }

      if (action.type === 'deleteAnnotation') {
        this.deleteAnnotation(action.id)
      }

      if (action.type === 'createDecorations') {
        // since we can't do batch updates to a Y.Map swallow errors
        // with the hope that things are "eventually right"
        try {
          this.createDecorations(state)
        } catch (e) {
          console.log(`could not create decorations: ${e.message}`, e)
          // swallow
        }
      }

      if (action.type === 'moveAnnotations') {
        action.toMove.forEach((data) => {
          this.moveAnnotation(state, data.id, data.newPos)
        })
      }

      return this
    }

    // Use Y.js to update positions
    const ystate = ySyncPluginKey.getState(state)

    // always re-render decorations for remote changes
    if (ystate.isChangeOrigin) {
      console.log(
        `%c[${this.options.instance}] remote change`,
        `color: ${this.color}`,
        { transaction: transaction }
      )
      // createDecoration may fail in the case of a remote update from
      // a special case like <enter>, <backspace> or <delete>
      // swallow and expect that a correction to the annotation ymap is incoming
      try {
        this.createDecorations(state)
      } catch (e) {
        console.log(`could not create decorations: ${e.message}`, e)
        // swallow
      }
      return this
    }

    // LOCAL CHANGE
    return this.handleLocalChange(transaction)
  }

  handleLocalChange(transaction: Transaction): this {
    const splitBlockAtStart = transaction.getMeta('SPLIT_BLOCK_START')
    const joinBlock = transaction.getMeta('JOIN_BLOCK')

    if (joinBlock || splitBlockAtStart) {
      return this
    }

    // no special cases, allow decoration mapping to happen
    this.decorations = this.decorations.map(
      transaction.mapping,
      transaction.doc
    )
    return this
  }

  // helpers for relative position
  absToRel(state: EditorState, abs: number): Y.RelativePosition {
    const ystate = ySyncPluginKey.getState(state)
    const { type, binding } = ystate
    if (!ystate.binding) {
      throw new Error('Y.State non initialized')
    }
    return absolutePositionToRelativePosition(abs, type, binding.mapping)
  }
}
