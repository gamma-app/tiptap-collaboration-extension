import { Extension } from "@tiptap/core";
import * as keymapCommands from "./keymapCommands";

export const KeymapOverride = Extension.create({
  name: "keymapOverride",
  priority: 101,

  addKeyboardShortcuts() {
    const handleEnter = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.newlineInCode(),
        () => commands.createParagraphNear(),
        () => commands.liftEmptyBlock(),
        keymapCommands.splitBlockWithAnnotations,
      ]);

    const handleBackspace = () =>
      this.editor.commands.first(({ commands, state }) => [
        () => commands.undoInputRule(),
        () => commands.deleteSelection(),
        keymapCommands.joinBackwardWithAnnotations,
        () => commands.selectNodeBackward(),
      ]);

    const handleDelete = () =>
      this.editor.commands.first(({ commands }) => [
        () => commands.deleteSelection(),
        keymapCommands.joinForwardWithAnnotations,
        () => commands.selectNodeForward(),
      ]);

    return {
      Enter: handleEnter,
      Backspace: handleBackspace,
      "Mod-Backspace": handleBackspace,
      "Shift-Backspace": handleBackspace,
      Delete: handleDelete,
      "Mod-Delete": handleDelete,
    };
  },
});
