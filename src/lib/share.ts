/**
 * Sharing a receipt on WhatsApp without any paid API.
 *
 * 1. On a phone the browser's share sheet can hand the actual PDF to WhatsApp, so the owner receives the
 *    file itself and the receipt link never has to be reachable from the internet.
 * 2. Where file sharing is not available (most desktop browsers) it opens a wa.me link with the message
 *    already written; the treasurer presses send, and can attach the downloaded PDF if they wish.
 */

const files = new Map<string, Promise<File | null>>();
const ready = new Map<string, File | null>();

/** Starts downloading the receipt PDF in the background so it is ready the moment the user taps Share. */
export function prepareReceiptFile(path: string): Promise<File | null> {
  let promise = files.get(path);
  if (!promise) {
    promise = (async () => {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) return null;
        const blob = await res.blob();
        const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "receipt.pdf";
        return new File([blob], name, { type: "application/pdf" });
      } catch {
        return null;
      }
    })().then((file) => {
      ready.set(path, file);
      if (!file) files.delete(path);        // let a later tap try again
      return file;
    });
    files.set(path, promise);
  }
  return promise;
}

export type ShareOutcome = "shared" | "link" | "cancelled" | "unavailable";

export async function shareReceipt(receiptPath: string, shareUrl: string | null): Promise<ShareOutcome> {
  const text = shareUrl ? new URL(shareUrl).searchParams.get("text") ?? "" : "";

  // Normally already downloaded; otherwise wait a moment, but never so long that the tap stops counting.
  let file = ready.get(receiptPath);
  if (file === undefined) {
    file = await Promise.race([
      prepareReceiptFile(receiptPath),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
    ]);
  }

  if (file && typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: file.name });
      return "shared";
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled";   // the user closed the share sheet
    }
  }

  if (shareUrl) {
    window.open(shareUrl, "_blank", "noopener");
    return "link";
  }
  return "unavailable";
}
