/**
 * Copies text to the clipboard. The modern API is refused in many embedded pages, so fall back to
 * selecting a textarea and the older copy command (both need a click or tap to have started this).
 * Returns whether it worked; when it didn't, the text is at least selected so Ctrl/Cmd+C finishes the job.
 */
export async function copyText(text: string, field?: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* fall through to the older route */
  }
  if (!field) return false
  field.focus()
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  }
}
