import { EditorContent } from "@tiptap/react";
// @ts-ignore
import applyDevTools from "prosemirror-dev-tools";
import { useEffect, useState } from "react";
import { useTestEditor } from "./useTestEditor";

export const Tiptap = ({ ydoc, instance, devTools = false, color }) => {
  const [comments, setComments] = useState([]);

  const editor = useTestEditor({
    ydoc,
    content: `<h1>h</h1><p>block 1</p>`,
    instance,
    color,
    onUpdate: setComments,
    devTools,
  });

  if (!window["editor"]) {
    window["editor"] = editor;
  }

  return (
    <>
      <EditorContent editor={editor} />
      <div
        style={{
          marginLeft: "70px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row" }}>
          <button
            style={{
              marginTop: "15px",
            }}
            onClick={() => {
              const comment = "c #" + Math.floor(Math.random() * 100);
              editor?.commands.addAnnotation(comment);
            }}
          >
            Comment
          </button>
          <button
            style={{
              marginTop: "15px",
            }}
            onClick={() => {
              editor?.commands.refreshDecorations();
            }}
          >
            Refresh
          </button>
        </div>

        {comments.map((c, idx) => {
          return <div key={idx}>{JSON.stringify(c)}</div>;
        })}
      </div>
    </>
  );
};
