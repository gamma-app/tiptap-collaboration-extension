import * as Y from 'yjs'

export type UndoOperation<K> = {
  type: 'set'
  key: string
  prev: K | undefined
  next: K | undefined
}

export function reverseOps<K>(ops: UndoOperation<K>[]): UndoOperation<K>[] {
  const res: UndoOperation<K>[] = []
  for (let i = ops.length - 1; i >= 0; i--) {
    const existing = ops[i]
    res.push({
      ...existing,
      prev: existing.next,
      next: existing.prev,
    })
  }
  return res
}

export class UndoableYMapWrapper<K> {
  public undoQueue: UndoOperation<K>[] = []

  constructor(private map: Y.Map<K>) {}

  /**
   * UndoOptioner
   */
  flushUndoQueue(): UndoOperation<K>[] {
    const { undoQueue } = this
    this.undoQueue = []
    return undoQueue
  }

  set(key: string, value: K): K {
    const next = this.map.get(key)
    this.undoQueue.unshift({
      type: 'set',
      key,
      next,
      prev: value,
    })

    return this.map.set(key, value)
  }

  delete(key: string): void {
    const existing = this.map.get(key)

    if (existing === undefined) {
      // nothing is there, delete is a no-op
    } else {
      this.undoQueue.unshift({
        type: 'set',
        key,
        next: existing,
        prev: undefined,
      })
    }

    return this.delete(key)
  }
}
