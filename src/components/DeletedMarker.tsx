"use client";

import { useEffect } from "react";

// Deleted (Recycle Bin) staff accounts and outlets still appear wherever they were
// part of past records — the backend names them "<name> (Deleted)" everywhere
// (qistmarket-app-backend lib/prisma.js). This greys every such name out on every
// page, so it's obvious at a glance it's history only, without each screen having
// to know about deletion.
const MARK = "(Deleted)";
const CLASS = "qm-deleted";

function markIn(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.includes(MARK) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (el && !el.classList.contains(CLASS) && !["SCRIPT", "STYLE", "TEXTAREA"].includes(el.tagName)) {
      el.classList.add(CLASS);
      if (!el.title) el.title = "Deleted — kept for history only, can't be used";
    }
  }
}

export function DeletedMarker() {
  useEffect(() => {
    if (!document.getElementById("qm-deleted-style")) {
      const style = document.createElement("style");
      style.id = "qm-deleted-style";
      style.textContent = `.${CLASS}{color:#9ca3af !important;font-style:italic;}`;
      document.head.appendChild(style);
    }
    markIn(document.body);
    // Batch everything that changed within a frame, then check it once.
    const pending = new Set<Node>();
    let queued = false;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") { if (m.target.parentNode) pending.add(m.target.parentNode); }
        else m.addedNodes.forEach((node) => pending.add(node));
      }
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        pending.forEach((node) => { if (node.isConnected) markIn(node); });
        pending.clear();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
