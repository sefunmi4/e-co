import React, { useState } from 'react';
import Window from './Window';
import Taskbar from './Taskbar';

interface Item {
  id: string;
  name: string;
  type: 'file' | 'folder';
  x: number;
  y: number;
  parentId: string | null;
}

const initialItems: Item[] = [
  { id: 'file-1', name: 'Notes.txt', type: 'file', x: 40, y: 40, parentId: null },
  { id: 'folder-1', name: 'Projects', type: 'folder', x: 140, y: 40, parentId: null },
];

export default function Desktop() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [openFolders, setOpenFolders] = useState<string[]>([]);

  const handleDragStart = (id: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDesktopDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, x, y, parentId: null } : it
      )
    );
  };

  const handleFolderDrop = (folderId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id || id === folderId) return;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, parentId: folderId } : it))
    );
  };

  const openFolder = (id: string) => {
    if (!openFolders.includes(id)) setOpenFolders((prev) => [...prev, id]);
  };
  const closeFolder = (id: string) => {
    setOpenFolders((prev) => prev.filter((f) => f !== id));
  };

  const folderContents = (folderId: string) =>
    items.filter((it) => it.parentId === folderId);

  return (
    <>
      <div
        className="absolute inset-0 z-20"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDesktopDrop}
      >
        {items
          .filter((it) => it.parentId === null)
          .map((it) => (
            <div
              key={it.id}
              draggable
              onDragStart={handleDragStart(it.id)}
              onDoubleClick={() => it.type === 'folder' && openFolder(it.id)}
              onDrop={
                it.type === 'folder' ? handleFolderDrop(it.id) : undefined
              }
              onDragOver={
                it.type === 'folder' ? (e) => e.preventDefault() : undefined
              }
              className="absolute w-16 text-center select-none"
              style={{ left: it.x, top: it.y }}
            >
              <div className="w-16 h-16 bg-white/70 rounded mb-1 flex items-center justify-center">
                {it.type === 'folder' ? '📁' : '📄'}
              </div>
              <span className="text-xs">{it.name}</span>
            </div>
          ))}
        {openFolders.map((id) => {
          const folder = items.find((it) => it.id === id)!;
          return (
            <Window key={id} className="top-24 left-24 w-48 bg-white p-2">
              <div className="font-bold mb-2 flex justify-between">
                {folder.name}
                <button onClick={() => closeFolder(id)}>×</button>
              </div>
              <ul>
                {folderContents(id).map((child) => (
                  <li key={child.id}>{child.name}</li>
                ))}
              </ul>
            </Window>
          );
        })}
      </div>
      <Taskbar
        openFolders={openFolders.map(
          (id) => items.find((it) => it.id === id)?.name || id
        )}
      />
    </>
  );
}
