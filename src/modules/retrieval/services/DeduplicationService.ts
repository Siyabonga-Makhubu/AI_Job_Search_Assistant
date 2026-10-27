import { ResumeRetrievalRepository } from "../repositories/ResumeRetrievalRepository";

export interface DuplicateGroup {
  duplicateKey: string;
  matchedBy: string;
  count: number;
  kept: { resumeId: string; name: string | null; fileName: string | null; createdAt: string | null };
  duplicates: Array<{ resumeId: string; name: string | null; fileName: string | null; createdAt: string | null }>;
}

export interface DeduplicationPreview {
  totalDocuments: number;
  duplicateGroups: number;
  duplicatesToRemove: number;
  groups: DuplicateGroup[];
}

export interface DeduplicationResult {
  totalBefore: number;
  deletedCount: number;
  totalAfter: number;
  groups: Array<{
    duplicateKey: string;
    matchedBy: string;
    kept: { resumeId: string; name: string | null };
    deleted: Array<{ resumeId: string; name: string | null }>;
  }>;
}

export class DeduplicationService {
  constructor(
    private readonly repository = new ResumeRetrievalRepository()
  ) {}

  /**
   * Identifies duplicate resume documents using three signals (priority order):
   *   1. Normalised email  — most reliable; same person re-uploaded
   *   2. name + experience — same candidate, different filename
   *   3. Normalised fileName — identical file uploaded more than once
   *
   * Returns a preview without deleting anything.
   */
  async findDuplicates(): Promise<DeduplicationPreview> {
    const docs = await this.repository.findAllForDeduplication();
    const groups = this.buildGroups(docs);

    let duplicatesToRemove = 0;
    const outputGroups: DuplicateGroup[] = [];

    for (const { key, by, docs: bucket } of groups) {
      const sorted = this.sortByDate(bucket);
      const keep = sorted[sorted.length - 1];
      const toDelete = sorted.slice(0, -1);
      duplicatesToRemove += toDelete.length;

      outputGroups.push({
        duplicateKey: key,
        matchedBy: by,
        count: bucket.length,
        kept: this.toEntry(keep),
        duplicates: toDelete.map((d) => this.toEntry(d)),
      });
    }

    return {
      totalDocuments: docs.length,
      duplicateGroups: groups.length,
      duplicatesToRemove,
      groups: outputGroups,
    };
  }

  /**
   * Finds duplicate groups and permanently deletes all but the newest
   * document in each group. Returns a summary of what was removed.
   */
  async deleteDuplicates(): Promise<DeduplicationResult> {
    const docs = await this.repository.findAllForDeduplication();
    const totalBefore = docs.length;
    const groups = this.buildGroups(docs);

    let deletedCount = 0;
    const resultGroups: DeduplicationResult["groups"] = [];

    for (const { key, by, docs: bucket } of groups) {
      const sorted = this.sortByDate(bucket);
      const keep = sorted[sorted.length - 1];
      const toDelete = sorted.slice(0, -1);

      const deletedEntries: Array<{ resumeId: string; name: string | null }> = [];

      for (const d of toDelete) {
        const id = String(d._id);
        const wasDeleted = await this.repository.deleteById(id);
        if (wasDeleted) {
          deletedCount++;
          deletedEntries.push({ resumeId: id, name: d.name ?? null });
        }
      }

      resultGroups.push({
        duplicateKey: key,
        matchedBy: by,
        kept: { resumeId: String(keep._id), name: keep.name ?? null },
        deleted: deletedEntries,
      });
    }

    return {
      totalBefore,
      deletedCount,
      totalAfter: totalBefore - deletedCount,
      groups: resultGroups,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildGroups(
    docs: Awaited<ReturnType<ResumeRetrievalRepository["findAllForDeduplication"]>>
  ): Array<{
    key: string;
    by: string;
    docs: typeof docs;
  }> {
    const assigned = new Set<string>();
    const groups: Array<{ key: string; by: string; docs: typeof docs }> = [];

    const idOf = (d: (typeof docs)[number]) => String(d._id);
    const norm = (s?: string | null) => (s ? s.trim().toLowerCase() : null);

    // Pass 1 — email
    const byEmail = new Map<string, typeof docs>();
    for (const d of docs) {
      const k = norm(d.email);
      if (!k) continue;
      const b = byEmail.get(k) ?? [];
      b.push(d);
      byEmail.set(k, b);
    }
    for (const [k, bucket] of byEmail) {
      if (bucket.length < 2) continue;
      groups.push({ key: `email:${k}`, by: "email", docs: bucket });
      bucket.forEach((d) => assigned.add(idOf(d)));
    }

    // Pass 2 — name + experience
    const byNameExp = new Map<string, typeof docs>();
    for (const d of docs) {
      if (assigned.has(idOf(d))) continue;
      const name = norm(d.name);
      if (!name) continue;
      const k = `${name}||${d.totalExperience ?? "null"}`;
      const b = byNameExp.get(k) ?? [];
      b.push(d);
      byNameExp.set(k, b);
    }
    for (const [k, bucket] of byNameExp) {
      if (bucket.length < 2) continue;
      groups.push({ key: `name_exp:${k}`, by: "name+experience", docs: bucket });
      bucket.forEach((d) => assigned.add(idOf(d)));
    }

    // Pass 3 — fileName
    const byFile = new Map<string, typeof docs>();
    for (const d of docs) {
      if (assigned.has(idOf(d))) continue;
      const k = norm(d.fileName);
      if (!k) continue;
      const b = byFile.get(k) ?? [];
      b.push(d);
      byFile.set(k, b);
    }
    for (const [k, bucket] of byFile) {
      if (bucket.length < 2) continue;
      groups.push({ key: `filename:${k}`, by: "filename", docs: bucket });
      bucket.forEach((d) => assigned.add(idOf(d)));
    }

    return groups;
  }

  private sortByDate<T extends { createdAt?: Date | string }>(docs: T[]): T[] {
    return [...docs].sort(
      (a, b) =>
        new Date(a.createdAt ?? 0).getTime() -
        new Date(b.createdAt ?? 0).getTime()
    );
  }

  private toEntry(d: {
    _id?: unknown;
    name?: string | null;
    fileName?: string | null;
    createdAt?: Date | string;
  }): DuplicateGroup["kept"] {
    return {
      resumeId: String(d._id ?? ""),
      name: d.name ?? null,
      fileName: d.fileName ?? null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    };
  }
}
