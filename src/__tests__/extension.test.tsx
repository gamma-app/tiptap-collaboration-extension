import React from "react";
import { cleanup, act, render, RenderResult } from "@testing-library/react";
import * as Y from "yjs";
import { Editor, EditorContent } from "@tiptap/react";
import { useTestEditor } from "../useTestEditor";
import { EditorView } from "prosemirror-view";

EditorView.prototype.updateState = function updateState(state) {
  if (!this.docView) return; // This prevents the matchesNode error on hot reloads
  this.updateStateInner(state, this.state.plugins != state.plugins);
};

// sleep util
const sleep: () => Promise<void> = () =>
  new Promise((res) => setTimeout(() => res(), 0));

let LocalEditor: React.FC<any> = null;
let RemoteEditor: React.FC<any> = null;
let localEditorInstance: Editor = null;
let remoteEditorInstance: Editor = null;
let ydoc: Y.Doc = null;
beforeEach(() => {
  ydoc = new Y.Doc();
  RemoteEditor = ({
    instance = "remote",
    color = "blue",
    onUpdate = () => {},
    ydoc,
    content,
  }) => {
    remoteEditorInstance = useTestEditor({
      instance,
      color,
      onUpdate,
      content,
      ydoc,
    });
    return <EditorContent editor={remoteEditorInstance} />;
  };
  LocalEditor = ({
    instance = "local",
    color = "green",
    onUpdate = () => {},
    ydoc,
    content,
  }) => {
    localEditorInstance = useTestEditor({
      instance,
      color,
      onUpdate,
      content,
      ydoc,
    });
    return <EditorContent editor={localEditorInstance} />;
  };
});

afterEach(() => {
  cleanup();
  remoteEditorInstance = null;
  localEditorInstance = null;
});

describe("local editor", () => {
  let localEditor: RenderResult = null;
  let decos = [];
  const content = `<h1>h</h1><p>block 1</p>`;

  beforeEach(async () => {
    act(() => {
      localEditor = render(
        <LocalEditor
          ydoc={ydoc}
          onUpdate={(d) => (decos = d)}
          content={content}
        />
      );
    });
    await sleep();
  });

  it("renders with or without a name", () => {
    expect(localEditor.queryByText("block 1")).toHaveTextContent("block 1");
  });

  it("creates a decoration when adding an annotation", async () => {
    act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
    });
    expect(localEditor.queryByText("block 1")).toHaveTextContent("block 1");
    expect(decos[0]).toMatchObject({
      decoration: {
        from: 3,
        to: 12,
        type: {
          spec: {
            data: "comment 1",
          },
        },
      },
    });
  });

  it("moves decoration if adding content before", async () => {
    act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(2);
      localEditorInstance.commands.insertContent("hello");
    });
    expect(localEditor.queryByText("block 1")).toHaveTextContent("block 1");
    console.log();
    expect(localEditorInstance.getHTML()).toBe(`<h1>hhello</h1><p>block 1</p>`);
    expect(decos[0]).toMatchObject({
      decoration: {
        from: 8,
        to: 17,
        type: {
          spec: {
            data: "comment 1",
          },
        },
      },
    });
  });

  it("expands decoration if adding content in between", async () => {
    act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(6);
      localEditorInstance.commands.insertContent("oo");
    });
    expect(localEditor.queryByText("blooock 1")).toHaveTextContent("blooock 1");
    expect(localEditorInstance.getHTML()).toBe(`<h1>h</h1><p>blooock 1</p>`);
    expect(decos[0]).toMatchObject({
      decoration: {
        from: 3,
        to: 14,
        type: {
          spec: {
            data: "comment 1",
          },
        },
      },
    });
  });
});
