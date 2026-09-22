import { describe, expect, it } from "vitest";
import { buildFolderTree } from "./types";
import type { Folder } from "./types";

function folder(overrides: Partial<Folder>): Folder {
  return {
    id: "id",
    user_id: "user",
    course_id: "course",
    parent_id: null,
    name: "folder",
    position: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildFolderTree", () => {
  it("nests children under their parent, sorted by position", () => {
    const flat: Folder[] = [
      folder({ id: "b", name: "B", position: 1 }),
      folder({ id: "a", name: "A", position: 0 }),
      folder({ id: "a1", name: "A1", parent_id: "a", position: 0 }),
      folder({ id: "a2", name: "A2", parent_id: "a", position: 1 }),
    ];

    const tree = buildFolderTree(flat);

    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
    expect(tree[0].children.map((n) => n.id)).toEqual(["a1", "a2"]);
    expect(tree[1].children).toEqual([]);
  });

  it("treats a folder whose parent is missing as a root", () => {
    const flat: Folder[] = [folder({ id: "orphan", parent_id: "missing" })];
    const tree = buildFolderTree(flat);
    expect(tree.map((n) => n.id)).toEqual(["orphan"]);
  });
});
