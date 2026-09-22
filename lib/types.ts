import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];

export type Course = Tables["courses"]["Row"];
export type Folder = Tables["folders"]["Row"];
export type Note = Tables["notes"]["Row"];
export type Attachment = Tables["attachments"]["Row"];
export type Task = Tables["tasks"]["Row"];
export type Event = Tables["events"]["Row"];

/** A folder with its direct children attached, built client-side from a flat list. */
export type FolderNode = Folder & { children: FolderNode[] };

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>(folders.map((f) => [f.id, { ...f, children: [] }]));
  const roots: FolderNode[] = [];
  for (const folder of byId.values()) {
    const parent = folder.parent_id ? byId.get(folder.parent_id) : undefined;
    if (parent) parent.children.push(folder);
    else roots.push(folder);
  }
  const byPosition = (a: Folder, b: Folder) => a.position - b.position || a.name.localeCompare(b.name);
  const sortTree = (nodes: FolderNode[]) => {
    nodes.sort(byPosition);
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}
