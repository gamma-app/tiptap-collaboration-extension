import Bold from '@tiptap/extension-bold'
import Collaboration from '@tiptap/extension-collaboration'
import Document from '@tiptap/extension-document'
import Heading from '@tiptap/extension-heading'
import Text from '@tiptap/extension-text'
import { useEditor } from '@tiptap/react'
import applyDevTools from 'prosemirror-dev-tools'
import * as Y from 'yjs'

import AnnotationExtension from './extension'
import { KeymapOverride } from './KeymapOverride'
import { Paragraph } from './Paragraph'
// @ts-ignore

export const useTestEditor = ({
  ydoc,
  instance,
  color,
  content = '',
  onUpdate = () => {},
  devTools = false,
}: {
  ydoc: Y.Doc
  instance: string
  color: string
  content?: string
  devTools?: boolean
  onUpdate?: (decos: any, annotations: any) => void
}) => {
  return useEditor({
    onCreate({ editor }) {
      if (devTools) applyDevTools(editor.view)
    },
    extensions: [
      KeymapOverride,
      Document,
      Paragraph,
      Text,
      Bold,
      Heading,
      Collaboration.configure({
        document: ydoc,
      }),
      AnnotationExtension.configure({
        document: ydoc,
        onUpdate: onUpdate,
        instance,
        color,
      }),
    ],
    content,
  })
}
