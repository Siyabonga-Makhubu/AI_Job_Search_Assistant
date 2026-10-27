import { z } from "zod";
import { ResumeRetrievalRepository } from "../../retrieval/repositories/ResumeRetrievalRepository";
import type { McpFindDuplicatesResult, McpDuplicateGroup } from "../types/mcp.types";

export const findDuplicateResumesSchema = {};

/**
 * Groups all resume documents by three fingerprint signals (priority order):
 *   1. Normalised email    — most reliable signal; same person re-uploaded
 *   2. name + experience   — catches the same candidate under a different file name
 *   3. Normalised fileName — same file uploaded more than once
 *
 * This is a READ-ONLY preview. Nothing is deleted here.
 * Use delete_duplicate_resumes to act on the result.
 */
export async function findDuplicateResumesTool(): Promise<McpFindDuplicatesResult> {
  const repository = new ResumeRetrievalRepository();
  const docs = await repository.findAllForDeduplication();

  // --- build fingerprint → document[] map ----------------------------------
  // Each document may match more than one signal; we process in priority order
  // and skip a document once it has already been assigned to a group.

  const grouped = new Map<
    string,
    {
      matchedBy: string;
      docs: typeof docs;
    }
  >();

  const assigned = new Set<string>(); // ids already placed in a group

  const idOf = (doc: (typeof docs)[number]) => String(doc._id);

  const normEmail = (e?: string | null) =>
    e ? e.trim().toLowerCase() : null;

  const normName = (n?: string | null) =>
    n ? n.trim().toLowerCase().replace(/\s+/g, " ") : null;

  const normFileName = (f?: string | null) =>
    f ? f.trim().toLowerCase() : null;

  // Pass 1 — group by email
  const byEmail = new Map<string, typeof docs>();
  for (const doc of docs) {
    const key = normEmail(doc.email);
    if (!key) continue;
    const bucket = byEmail.get(key) ?? [];
    bucket.push(doc);
    byEmail.set(key, bucket);
  }
  for (const [key, bucket] of byEmail) {
    if (bucket.length < 2) continue;
    const groupKey = `email:${key}`;
    grouped.set(groupKey, { matchedBy: "email", docs: bucket });
    for (const d of bucket) assigned.add(idOf(d));
  }

  // Pass 2 — group by name + totalExperience (unassigned docs only)
  const byNameExp = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (assigned.has(idOf(doc))) continue;
    const name = normName(doc.name);
    if (!name) continue;
    const exp = doc.totalExperience ?? "null";
    const key = `${name}||${exp}`;
    const bucket = byNameExp.get(key) ?? [];
    bucket.push(doc);
    byNameExp.set(key, bucket);
  }
  for (const [key, bucket] of byNameExp) {
    if (bucket.length < 2) continue;
    const groupKey = `name_exp:${key}`;
    grouped.set(groupKey, { matchedBy: "name_experience", docs: bucket });
    for (const d of bucket) assigned.add(idOf(d));
  }

  // Pass 3 — group by fileName (unassigned docs only)
  const byFileName = new Map<string, typeof docs>();
  for (const doc of docs) {
    if (assigned.has(idOf(doc))) continue;
    const key = normFileName(doc.fileName);
    if (!key) continue;
    const bucket = byFileName.get(key) ?? [];
    bucket.push(doc);
    byFileName.set(key, bucket);
  }
  for (const [key, bucket] of byFileName) {
    if (bucket.length < 2) continue;
    const groupKey = `filename:${key}`;
    grouped.set(groupKey, { matchedBy: "filename", docs: bucket });
    for (const d of bucket) assigned.add(idOf(d));
  }

  // --- build output groups ------------------------------------------------
  const groups: McpDuplicateGroup[] = [];
  let totalDuplicatesToRemove = 0;

  for (const [groupKey, { matchedBy, docs: bucket }] of grouped) {
    // docs are already sorted oldest→newest from the repository query
    // keep the last (newest) document
    const sorted = [...bucket].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    const keepDoc = sorted[sorted.length - 1];
    const deleteDocs = sorted.slice(0, -1);
    totalDuplicatesToRemove += deleteDocs.length;

    const toEntry = (d: (typeof docs)[number]) => ({
      resumeId: idOf(d),
      name: d.name ?? null,
      fileName: d.fileName ?? null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    });

    groups.push({
      duplicateKey: groupKey,
      matchedBy,
      count: bucket.length,
      kept: toEntry(keepDoc),
      duplicates: deleteDocs.map(toEntry),
    });
  }

  return {
    totalDocuments: docs.length,
    duplicateGroups: groups.length,
    duplicatesToRemove: totalDuplicatesToRemove,
    groups,
  };
}
