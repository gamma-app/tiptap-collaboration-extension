import "./styles.css";
import { Tiptap } from "./Tiptap";
import * as Y from "yjs";
import { EditorView } from "prosemirror-view";

EditorView.prototype.updateState = function updateState(state) {
  if (!this.docView) return; // This prevents the matchesNode error on hot reloads
  this.updateStateInner(state, this.state.plugins != state.plugins);
};

export default function App() {
  const ydoc = new Y.Doc();
  return (
    <div className="App">
      <h3>editor1</h3>
      <Tiptap
        ydoc={ydoc}
        instance={"editor1"}
        devTools={true}
        color="magenta"
      />

      <br />
      <br />

      <h3>editor2 </h3>
      <Tiptap ydoc={ydoc} instance={"editor2"} color="cornflowerblue" />
    </div>
  );
}
