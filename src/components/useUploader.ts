"use client";
import { useCallback, useRef, useState } from "react";
import { uploadMany, type QueueItem, type UploadParams } from "@/lib/image-client";

/** Hook tải nhiều ảnh có tiến độ. `run` trả về các ảnh đã tải xong (done). */
export function useUploader() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async (files: File[], params: UploadParams, concurrency = 2): Promise<QueueItem[]> => {
    if (busyRef.current || files.length === 0) return [];
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await uploadMany(files, params, setItems, concurrency);
      return result.filter((x) => x.status === "done");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);
  return { items, busy, run, clear };
}
