"use client";

import { useEffect } from "react";

/** Scrolls the element with the given id to the middle of the screen once it is rendered. */
export function ScrollIntoView({ targetId }: { targetId: string }) {
  useEffect(() => {
    // Wait a frame: the router applies its own scroll after navigation and would override ours.
    const frame = requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [targetId]);

  return null;
}
