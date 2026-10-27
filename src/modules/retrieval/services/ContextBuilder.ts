export interface ContextCandidate {
  resumeId: string;
  name?: string | null;
  role?: string | null;
  company?: string | null;
  skills?: string[];
  totalExperience?: number | null;
  score?: number;
  evidence?: string[];
}

export class ContextBuilder {
  buildContext(results: ContextCandidate[], maxCharacters = 12_000): string {
    if (!results.length) return "No retrieved candidates available.";
    const blocks: string[] = [];
    let remaining = maxCharacters;
    for (const candidate of results.slice(0, 5)) {
      const evidence = [...new Set([...(candidate.evidence ?? []), ...(candidate.skills ?? [])])]
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
      const block = [
        `Candidate ID: ${candidate.resumeId}`,
        `Name: ${candidate.name ?? "Unknown"}`,
        `Role: ${candidate.role ?? "Unknown"}`,
        `Company: ${candidate.company ?? "Unknown"}`,
        `Experience: ${candidate.totalExperience ?? "Unknown"} years`,
        `Retrieved evidence: ${evidence.join("; ") || "No explicit evidence listed"}`,
      ].join("\n");
      if (block.length > remaining) break;
      blocks.push(block);
      remaining -= block.length + 2;
    }
    return blocks.join("\n\n") || "No retrieved candidates available.";
  }
}
