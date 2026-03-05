/**
 * Compute a simple unified-style diff between two markdown strings.
 * No external dependencies — just line-by-line comparison.
 */
export function computeMarkdownDiff(
  oldMarkdown: string | null | undefined,
  newMarkdown: string
): { changeStatus: string; diffText: string | null } {
  if (!oldMarkdown) {
    return { changeStatus: 'new', diffText: null };
  }

  if (oldMarkdown === newMarkdown) {
    return { changeStatus: 'same', diffText: null };
  }

  const oldLines = oldMarkdown.split('\n');
  const newLines = newMarkdown.split('\n');

  const diffLines: string[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  // Simple line-by-line comparison producing +/- prefixed output
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  for (const line of oldLines) {
    if (!newSet.has(line)) {
      diffLines.push(`- ${line}`);
    }
  }
  for (const line of newLines) {
    if (!oldSet.has(line)) {
      diffLines.push(`+ ${line}`);
    }
  }

  // If no line-level differences found (e.g. only whitespace reordering), fall back to a summary
  if (diffLines.length === 0) {
    return {
      changeStatus: 'changed',
      diffText: `Content changed (${oldLines.length} lines → ${newLines.length} lines)`,
    };
  }

  // Truncate to reasonable size (max ~200 lines)
  const maxDiffLines = 200;
  const truncated = diffLines.length > maxDiffLines;
  const output = diffLines.slice(0, maxDiffLines).join('\n');

  return {
    changeStatus: 'changed',
    diffText: truncated
      ? `${output}\n\n... (${diffLines.length - maxDiffLines} more lines)`
      : output,
  };
}
