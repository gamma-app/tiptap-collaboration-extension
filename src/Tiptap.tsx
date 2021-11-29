import { EditorContent } from "@tiptap/react";
// @ts-ignore
import applyDevTools from "prosemirror-dev-tools";
import { useEffect, useState } from "react";
import { useTestEditor } from "./useTestEditor";

const sleep: () => Promise<void> = () =>
  new Promise((res) => setTimeout(() => res(), 0));

export const Tiptap = ({ ydoc, instance, devTools = false, color }) => {
  const [comments, setComments] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [selection, setSelection] = useState<any>({});

  const onUpdate = (decos: any, annotations: any) => {
    // console.log(`%c [${instance}] on decos update`, `color: ${color}`, decos);
    setComments(decos);
    setAnnotations(annotations);
  };

  const editor = useTestEditor({
    ydoc,
    content: `<h1>h</h1><p>block 1</p><p>block 2</p><p>block 3</p>`,
    instance,
    color,
    onUpdate,
    devTools,
  });

  useEffect(() => {
    if (!editor || instance !== "editor1") return;

    editor.on("selectionUpdate", ({ editor }) => {
      setSelection(editor.state.selection);
    });
    async function doit() {
      // return;
      editor.commands.clearAnnotations();
      await sleep();
      editor.commands.setTextSelection(14);
      await sleep();
      editor.commands.addAnnotation("c1");
      await sleep();
      editor.commands.setTextSelection(25);
      await sleep();
      editor.commands.addAnnotation("c2");
      return;
    }
    // setTimeout(() => doit(), 500);
  }, [editor, instance]);

  if (devTools && !window["editor"]) {
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
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginTop: "10px",
            marginBottom: "10px",
          }}
        >
          <button
            onClick={() => {
              const comment = "c #" + Math.floor(Math.random() * 100);
              editor?.commands.addAnnotation(comment);
            }}
          >
            Comment
          </button>
          <button
            onClick={() => {
              editor?.commands.refreshDecorations();
            }}
          >
            Refresh
          </button>
          <div style={{ marginLeft: "10px " }}>{}</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div>
            Selection: <strong>{selection?.anchor}</strong>
          </div>
          <pre style={{ marginTop: 0 }}>{JSON.stringify(selection)}</pre>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div>Decorations</div>

          {comments.map((c, idx) => {
            return (
              <pre style={{ marginTop: 0, marginBottom: 0 }} key={idx}>
                {JSON.stringify(c)}
              </pre>
            );
          })}
        </div>
        <div>
          <div>Annotations</div>
          {annotations.map((c, idx) => {
            return (
              <pre style={{ marginTop: 0, marginBottom: 0 }} key={idx}>
                {JSON.stringify(c)}
              </pre>
            );
          })}
        </div>
      </div>
    </>
  );
};
