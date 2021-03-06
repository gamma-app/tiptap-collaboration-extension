import { EditorState, Transaction } from 'prosemirror-state'
import { findChildren } from 'prosemirror-utils'
import { Decoration, DecorationSet } from 'prosemirror-view'
import {
  yUndoPluginKey,
  ySyncPluginKey,
  relativePositionToAbsolutePosition,
  absolutePositionToRelativePosition,
} from 'y-prosemirror'
import * as Y from 'yjs'

import { AnnotationPluginKey } from './AnnotationPlugin'
import {
  AddAnnotationAction,
  AnnotationData,
  AnnotationPluginParams,
  AnnotationActions,
  AnnotationStateYMap,
  AnnotationStateEntry,
} from './types'
import { UndoableYMapWrapper, UndoOperation } from './UndoableYMap'

export class AnnotationState {
  public decorations = DecorationSet.empty

  public annotations: AnnotationData[] = []

  public map: AnnotationStateYMap

  public undoableMap: UndoableYMapWrapper<AnnotationStateEntry>

  constructor(protected options: AnnotationPluginParams) {
    this.map = options.map
    this.undoableMap = new UndoableYMapWrapper<AnnotationStateEntry>(this.map)
  }

  clearAnnotations() {
    this.map.forEach((_val, key) => {
      this.map.delete(key)
    })
  }

  addAnnotation(action: AddAnnotationAction, state: EditorState) {
    console.log(
      `%c[${this.options.instance}] addAnnotation`,
      `color: ${this.options.color}`
    )
    const { pos, id, data } = action
    const relativePos = this.absToRel(state, pos)
    this.map.set(id, {
      id,
      pos: relativePos,
      data,
    })
  }

  deleteAnnotation(id: string) {
    console.log(
      `%c[${this.options.instance}] deleteAnnotation`,
      `color: ${this.options.color}`
    )
    this.map.delete(id)
  }

  moveAnnotation(state: EditorState, id: string, newPos: number) {
    console.log(
      `%c[${this.options.instance}] move annotation`,
      `color: ${this.options.color}`,
      {
        id,
        newPos,
      }
    )
    // update decoration position
    const { map } = this
    const existing = map.get(id)
    if (!existing) {
      throw new Error(`No YMap annotations entry for ${id}`)
    }

    this.undoableMap.set(id, {
      ...existing,
      pos: this.absToRel(state, newPos),
    })

    // NOTE(jordan): this is kind of hacky for this plugin state to reach into
    // another plugin, but it seems to be the simplest way
    const undoManager: Y.UndoManager =
      yUndoPluginKey.getState(state).undoManager

    if (undoManager.undoStack.length > 0) {
      const serialized = this.undoableMap.flushUndoQueue()
      undoManager.undoStack[undoManager.undoStack.length - 1].meta.set(
        'annotations',
        serialized
      )
    }
  }

  createDecorations(state: EditorState) {
    const { map } = this.options
    const ystate = ySyncPluginKey.getState(state)
    if (!ystate.binding) {
      return
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

      if (pos == null) {
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
        `color: ${this.options.color}`,
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
        pos,
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
  }

  apply(transaction: Transaction, state: EditorState): this {
    // Add/Remove annotations
    const action = transaction.getMeta(AnnotationPluginKey) as AnnotationActions

    if (action && action.type) {
      if (action.type === 'addAnnotation') {
        this.addAnnotation(action, state)
      }

      if (action.type === 'clearAnnotations') {
        this.clearAnnotations()
      }

      if (action.type === 'deleteAnnotation') {
        this.deleteAnnotation(action.id)
      }

      if (action.type === 'refreshAnnotationDecorations') {
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
        `color: ${this.options.color}`,
        { transaction: transaction }
      )
      // createDecoration may fail in the case of a remote update from
      // a special case like <enter>, <backspace> or <delete>
      // swallow and expect that a correction to the annotation ymap is incoming
      try {
        this.createDecorations(state)
      } catch (e) {
        console.log(`could not create decorations: ${e.message}`)
        // swallow
      }
      return this
    }

    // LOCAL CHANGE
    return this.handleLocalChange(transaction)
  }

  handleLocalChange(transaction: Transaction): this {
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

  serialize() {
    return this.undoableMap.flushUndoQueue()
  }

  restore(queue: UndoOperation<AnnotationStateEntry>[]) {
    queue.forEach((op) => {
      const { next, key } = op
      if (next === undefined) {
        this.map.delete(key)
      } else {
        this.map.set(key, next)
      }
    })
  }
}
