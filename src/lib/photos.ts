"use client";

import { useEffect, useState } from "react";

// Progress photos (D39): private by design, so they never leave the device. Stored in IndexedDB (not localStorage:
// images are too big), never synced or uploaded. Each photo is re-encoded on the way in: max 1280 px, JPEG, which also
// drops EXIF data (GPS location, camera) and applies the phone's rotation.

const DB = "prana-photos";
const STORE = "photos";
const MAX_SIDE = 1280;

export type Photo = { id: string; date: string; blob: Blob; w: number; h: number; createdAt: number };

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

export async function listPhotos(): Promise<Photo[]> {
  const all = await run<Photo[]>("readonly", (s) => s.getAll() as IDBRequest<Photo[]>);
  return all.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

export async function addPhoto(file: File, date: string): Promise<Photo> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
  const photo: Photo = { id: crypto.randomUUID(), date, blob, w, h, createdAt: Date.now() };
  await run("readwrite", (s) => s.put(photo));
  changed();
  return photo;
}

export async function deletePhoto(id: string) {
  await run("readwrite", (s) => s.delete(id));
  changed();
}

/** Photos with object URLs for <img>; URLs are revoked when the list changes or the component unmounts. */
export function usePhotos() {
  const [photos, setPhotos] = useState<(Photo & { url: string })[] | null>(null);
  useEffect(() => {
    let alive = true;
    let urls: string[] = [];
    const load = () =>
      listPhotos()
        .then((list) => {
          if (!alive) return;
          urls.forEach((u) => URL.revokeObjectURL(u));
          const next = list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
          urls = next.map((p) => p.url);
          setPhotos(next);
        })
        .catch(() => alive && setPhotos([])); // private mode / IndexedDB blocked: the card says so
    void load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  return photos;
}
