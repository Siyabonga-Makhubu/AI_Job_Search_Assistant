import { z } from "zod";
import { ResumeRetrievalRepository } from "../../retrieval/repositories/ResumeRetrievalRepository";
import { findDuplicateResumesTool } from "./findDuplicateResumes.tool";
import type { McpDeleteDuplicatesResult } from "../types/mcp.types";

export const deleteDuplicateResumesSchema = {
  confirm: z
    .literal(true)
    .describe(
      "Must be exactly `true` to confirm the deletion. " +
        "Call find_duplicate_resumes first to preview what will be removed."
    ),
};

/**
 * Deletes duplicate resume documents from MongoDB.
 *
 * Strategy:
 *   - Runs the same duplicate-detection logic as find_duplicate_resumes.
 *   - For each duplicate group, KEEPS the most recently ingested document.
 *   - Permanently deletes all older duplicates.
 *
 * This operation is IRREVERSIBLE. Always call find_duplicate_resumes
 * first to preview the groups before confirming.
 */
export async function deleteDuplicateResumesTool(
  args: { confirm: true }
): Promise<McpDeleteDuplicatesResult> {
  // Re-use the detection logic so the two tools stay in sync
  const preview = await findDuplicateResumesTool();

  if (preview.duplicateGroups === 0) {
    return {
      deletedCount: 0,
      keptCount: preview.totalDocuments,
      groups: [],
    };
  }

  const repository = new ResumeRetrievalRepository();
  let deletedCount = 0;

  const resultGroups: McpDeleteDuplicatesResult["groups"] = [];

  for (const group of preview.groups) {
    const deletedEntries: Array<{ resumeId: string; name: string | null }> = [];

    for (const dup of group.duplicates) {
      const deleted = await repository.deleteById(dup.resumeId);
      if (deleted) {
        deletedCount++;
        deletedEntries.push({ resumeId: dup.resumeId, name: dup.name });
      }
    }

    resultGroups.push({
      duplicateKey: group.duplicateKey,
      matchedBy: group.matchedBy,
      kept: { resumeId: group.kept.resumeId, name: group.kept.name },
      deleted: deletedEntries,
    });
  }

  return {
    deletedCount,
    keptCount: preview.totalDocuments - deletedCount,
    groups: resultGroups,
  };
}
