import { EditorContent } from "@tiptap/react";
// @ts-ignore
import applyDevTools from "prosemirror-dev-tools";
import { useEffect, useState } from "react";
import { useTestEditor } from "./useTestEditor";

const sleep: () => Promise<void> = () =>
  new Promise((res) => setTimeout(() => res(), 0));

export const Tiptap = ({ ydoc, instance, devTools = false, color }) => {
  const [comments, setComments] = useState([]);
  const [selection, setSelection] = useState<any>({});

  const onUpdate = (decos: any) => {
    setComments(decos);
  };

  const editor = useTestEditor({
    ydoc,
    content: `<h1>h</h1><p>block 1</p><p>block 2</p>`,
    instance,
    color,
    onUpdate,
    devTools,
  });

  useEffect(() => {
    if (!editor || instance !== "editor1") return;

    editor.on("transaction", ({ editor, transaction }) => {
      console.log("on transaction", transaction);
    });
    editor.on("selectionUpdate", ({ editor }) => {
      console.log("selection update");
      setSelection(editor.state.selection);
    });
    async function doit() {
      // editor.commands.clearAnnotations();
      await sleep();
      editor.commands.setTextSelection(6);
      await sleep();
      editor.commands.addAnnotation("c1");
      await sleep();

      editor.commands.setTextSelection(14);
      editor.commands.addAnnotation("c2");
    }
    setTimeout(() => doit(), 500);
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
              editor?.commands.enter();
            }}
          >
            Enter
          </button>
          <button
            onClick={() => {
              editor?.commands.refreshDecorations();
            }}
          >
            Refresh
          </button>
          <div style={{ marginLeft: "10px " }}>{JSON.stringify(selection)}</div>
        </div>
        {comments.map((c, idx) => {
          return <div key={idx}>{JSON.stringify(c)}</div>;
        })}
      </div>
    </>
  );
};
