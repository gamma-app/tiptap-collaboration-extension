import React from "react";
import ReactDOM from "react-dom";
import chai, { expect } from "chai";
import doit from "chai-better-shallow-deep-equal";

import userEvent from "@testing-library/user-event";
import {
  cleanup,
  act,
  render,
  RenderResult,
  fireEvent,
} from "@testing-library/react";
import * as Y from "yjs";
import { Editor, EditorContent } from "@tiptap/react";
import ReactTestUtils from "react-dom/test-utils";
import { useTestEditor } from "../useTestEditor";
import { EditorView } from "prosemirror-view";
// @ts-ignore
chai.use(doit);

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
let container;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
  container = null;
});

beforeEach(() => {
  console.log("new ydoc");
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

afterEach(async () => {
  console.log("after each");
  await cleanup();
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
        />,
        container
      );
    });
    await sleep();
  });

  it("renders with or without a name", () => {
    expect(localEditor.queryByText("block 1").textContent).to.equal("block 1");
  });

  it("creates a decoration when adding an annotation at beginning", async () => {
    await act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
    });
    expect(localEditor.queryByText("block 1").textContent).to.equal("block 1");
    expect(decos[0]).to.shallowDeepEqual({
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

  it("creates a decoration when adding an annotation in middle", async () => {
    await act(() => {
      localEditorInstance.commands.setTextSelection(6);
      localEditorInstance.commands.addAnnotation("comment 1");
    });
    expect(localEditor.queryByText("block 1").textContent).to.equal("block 1");
    expect(decos[0]).to.shallowDeepEqual({
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

  it("creates a decoration when adding an annotation at end", async () => {
    await act(() => {
      localEditorInstance.commands.setTextSelection(11);
      localEditorInstance.commands.addAnnotation("comment 1");
    });
    expect(localEditor.queryByText("block 1").textContent).to.eql("block 1");
    expect(decos[0]).to.shallowDeepEqual({
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
    await act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(2);
      localEditorInstance.commands.insertContent("hello");
    });
    expect(localEditor.queryByText("block 1").textContent).to.eql("block 1");
    console.log();
    expect(localEditorInstance.getHTML()).to.eql(
      `<h1>hhello</h1><p>block 1</p>`
    );
    expect(decos[0]).to.shallowDeepEqual({
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
    await act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(6);
      localEditorInstance.commands.insertContent("oo");
    });
    expect(localEditor.queryByText("blooock 1").textContent).to.eql(
      "blooock 1"
    );
    expect(localEditorInstance.getHTML()).to.eql(`<h1>h</h1><p>blooock 1</p>`);
    expect(decos[0]).to.shallowDeepEqual({
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

  it("puts the decoration on the previous block when splitting block in middle", async () => {
    await act(() => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(6);
      localEditorInstance.commands.insertContent("oo");
    });
    expect(localEditor.queryByText("blooock 1").textContent).to.eql(
      "blooock 1"
    );
    expect(localEditorInstance.getHTML()).to.eql(`<h1>h</h1><p>blooock 1</p>`);
    expect(decos[0]).to.shallowDeepEqual({
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

  it("splitting block", async () => {
    await act(async () => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(6);
      const node = await localEditor.findByText("block 1");
      fireEvent.keyDown(node, { key: "Enter", code: "Enter", charCode: 13 });
    });
    // let other transactions go through
    await sleep();

    expect(localEditor.queryByText("bl").textContent).to.equal("bl");
    expect(localEditor.queryByText("ock 1").textContent).to.equal("ock 1");
    expect(localEditorInstance.getHTML()).to.equal(
      `<h1>h</h1><p>bl</p><p>ock 1</p>`
    );
    await sleep();
    expect(decos[0]).to.shallowDeepEqual({
      decoration: {
        from: 3,
        to: 7,
        type: {
          spec: {
            data: "comment 1",
          },
        },
      },
    });
  });

  it("splitting block and backspacing", async () => {
    await act(async () => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(6);

      const node = await localEditor.findByText("block 1");

      fireEvent.keyDown(node, { key: "Enter", code: "Enter", charCode: 13 });
      localEditorInstance.commands.setTextSelection(8);

      const node2 = await localEditor.findByText("ock 1");
      fireEvent.keyDown(node2, {
        key: "Backspace",
        code: "Backspace",
        charCode: 8,
      });
    });
    // let other transactions go through

    await sleep();
    expect(localEditor.queryByText("block 1").textContent).to.equal("block 1");
    expect(localEditorInstance.getHTML()).to.equal(`<h1>h</h1><p>block 1</p>`);
    // deco should be joined back
    expect(decos[0]).to.shallowDeepEqual({
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

  it("splitting block and deleting", async () => {
    await act(async () => {
      localEditorInstance.commands.setTextSelection(4);
      localEditorInstance.commands.addAnnotation("comment 1");
      localEditorInstance.commands.setTextSelection(6);

      const node = await localEditor.findByText("block 1");

      fireEvent.keyDown(node, { key: "Enter", code: "Enter", charCode: 13 });
      localEditorInstance.commands.setTextSelection(6);

      const node2 = await localEditor.findByText("ock 1");
      fireEvent.keyDown(node2, {
        key: "Delete",
        code: "Delete",
        charCode: 46,
      });
    });
    // let other transactions go through

    await sleep();
    expect(localEditor.queryByText("block 1").textContent).to.equal("block 1");
    expect(localEditorInstance.getHTML()).to.equal(`<h1>h</h1><p>block 1</p>`);
    // deco should be joined back
    expect(decos[0]).to.shallowDeepEqual({
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
});

describe("multiple comments", () => {
  let localEditor: RenderResult = null;
  let decos = [];
  const content = `<h1>h</h1><p>block 1</p><p>block 2</p><p>block 3</p>`;

  beforeEach(async () => {
    act(() => {
      localEditor = render(
        <LocalEditor
          ydoc={ydoc}
          onUpdate={(d) => (decos = d)}
          content={content}
        />,
        container
      );
    });
    await sleep();
  });

  it("comment on two blocks", async () => {
    await act(async () => {
      localEditorInstance.commands.setTextSelection(6);
      localEditorInstance.commands.addAnnotation("comment 1");
      await sleep();
      localEditorInstance.commands.setTextSelection(14);
      localEditorInstance.commands.addAnnotation("comment 2");
    });

    await sleep();
    expect(decos[0]).to.shallowDeepEqual({
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
    expect(decos[1]).to.shallowDeepEqual({
      decoration: {
        from: 12,
        to: 21,
        type: {
          spec: {
            data: "comment 2",
          },
        },
      },
    });
  });

  it("comment on second block, first block - split block at middle", async () => {
    await act(async () => {
      localEditorInstance.commands.setTextSelection(13);
      localEditorInstance.commands.addAnnotation("comment 2");
      await sleep();

      localEditorInstance.commands.setTextSelection(6);
      const node = await localEditor.findByText("block 1");
      fireEvent.keyDown(node, { key: "Enter", code: "Enter", charCode: 13 });
    });

    await sleep();
    console.log(localEditorInstance.getHTML());
    expect(decos[0]).to.shallowDeepEqual({
      decoration: {
        from: 14,
        to: 23,
        type: {
          spec: {
            data: "comment 2",
          },
        },
      },
    });
  });

  describe("split block - ENTER", () => {
    beforeEach(async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(6);
        localEditorInstance.commands.addAnnotation("comment 1");
        await sleep();
        localEditorInstance.commands.setTextSelection(14);
        localEditorInstance.commands.addAnnotation("comment 2");
        await sleep();
      });
    });
    it("two comments split block in middle", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(6);
        const node = await localEditor.findByText("block 1");

        fireEvent.keyDown(node, { key: "Enter", code: "Enter", charCode: 13 });
      });
      // let other transactions go through

      await sleep();
      console.log(localEditorInstance.getHTML());
      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>bl</p><p>ock 1</p><p>block 2</p><p>block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 3,
          to: 7,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });
      expect(decos[1]).to.shallowDeepEqual({
        decoration: {
          from: 14,
          to: 23,
          type: {
            spec: {
              data: "comment 2",
            },
          },
        },
      });
    });

    it("two comments split block in front", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(4);
        const node = await localEditor.findByText("block 1");

        fireEvent.keyDown(node, { key: "Enter", code: "Enter", charCode: 13 });
      });
      // let other transactions go through

      await sleep();
      console.log(localEditorInstance.getHTML());
      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p></p><p>block 1</p><p>block 2</p><p>block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 5,
          to: 14,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });
      expect(decos[1]).to.shallowDeepEqual({
        decoration: {
          from: 14,
          to: 23,
          type: {
            spec: {
              data: "comment 2",
            },
          },
        },
      });
    });
  });

  describe("join block - DELETE", () => {
    beforeEach(async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(14);
        localEditorInstance.commands.addAnnotation("comment 1");
        await sleep();
      });
    });

    it("joins next block to current comment block", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(20);

        const node = await localEditor.findByText("block 2");
        fireEvent.keyDown(node, {
          key: "Delete",
          code: "Delete",
          charCode: 46,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1</p><p>block 2block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 12,
          to: 28,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });
    });

    it("joins current comment block with previous block", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(11);

        const node = await localEditor.findByText("block 1");
        fireEvent.keyDown(node, {
          key: "Delete",
          code: "Delete",
          charCode: 46,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1block 2</p><p>block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 3,
          to: 19,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });
    });

    it("joins current comment block with previous block also a comment", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(22);
        localEditorInstance.commands.addAnnotation("comment 2");
        await sleep();

        localEditorInstance.commands.setTextSelection(20);
        const node = await localEditor.findByText("block 1");
        fireEvent.keyDown(node, {
          key: "Delete",
          code: "Delete",
          charCode: 46,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1</p><p>block 2block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 12,
          to: 28,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });

      expect(decos[1]).to.shallowDeepEqual({
        decoration: {
          from: 12,
          to: 28,
          type: {
            spec: {
              data: "comment 2",
            },
          },
        },
      });
    });

    it("joins next comment block with previous non comment block and a farther down comment block is unaffected", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(22);
        localEditorInstance.commands.addAnnotation("comment 2");
        await sleep();

        localEditorInstance.commands.setTextSelection(11);
        const node = await localEditor.findByText("block 1");
        fireEvent.keyDown(node, {
          key: "Delete",
          code: "Delete",
          charCode: 46,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1block 2</p><p>block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 3,
          to: 19,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });

      expect(decos[1]).to.shallowDeepEqual({
        decoration: {
          from: 19,
          to: 28,
          type: {
            spec: {
              data: "comment 2",
            },
          },
        },
      });
    });
  });

  describe("join block - BACKSPACE", () => {
    beforeEach(async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(14);
        localEditorInstance.commands.addAnnotation("comment 1");
        await sleep();
      });
    });

    it("joins current non-comment block to previous comment block", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(22);

        const node = await localEditor.findByText("block 2");
        fireEvent.keyDown(node, {
          key: "Backspace",
          code: "Backspace",
          charCode: 8,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1</p><p>block 2block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 12,
          to: 28,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });
    });

    it("joins current comment block with previous block", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(13);

        const node = await localEditor.findByText("block 1");
        fireEvent.keyDown(node, {
          key: "Backspace",
          code: "Backspace",
          charCode: 8,
        })
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1block 2</p><p>block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 3,
          to: 19,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });
    });

    it("joins current comment block with previous block also a comment", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(22);
        localEditorInstance.commands.addAnnotation("comment 2");
        await sleep();

        localEditorInstance.commands.setTextSelection(22);
        const node = await localEditor.findByText("block 1");
        fireEvent.keyDown(node, {
          key: "Backspace",
          code: "Backspace",
          charCode: 8,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1</p><p>block 2block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 12,
          to: 28,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });

      expect(decos[1]).to.shallowDeepEqual({
        decoration: {
          from: 12,
          to: 28,
          type: {
            spec: {
              data: "comment 2",
            },
          },
        },
      });
    });

    it("joins next comment block with previous non comment block and a farther down comment block is unaffected", async () => {
      await act(async () => {
        localEditorInstance.commands.setTextSelection(22);
        localEditorInstance.commands.addAnnotation("comment 2");
        await sleep();

        localEditorInstance.commands.setTextSelection(13);
        const node = await localEditor.findByText("block 1");
        fireEvent.keyDown(node, {
          key: "Backspace",
          code: "Backspace",
          charCode: 8,
        });
      });
      await sleep();

      expect(localEditorInstance.getHTML()).to.equal(
        `<h1>h</h1><p>block 1block 2</p><p>block 3</p>`
      );
      // deco should be joined back
      expect(decos[0]).to.shallowDeepEqual({
        decoration: {
          from: 3,
          to: 19,
          type: {
            spec: {
              data: "comment 1",
            },
          },
        },
      });

      expect(decos[1]).to.shallowDeepEqual({
        decoration: {
          from: 19,
          to: 28,
          type: {
            spec: {
              data: "comment 2",
            },
          },
        },
      });
    });
  });
});
