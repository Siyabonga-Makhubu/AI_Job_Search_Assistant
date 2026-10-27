import type { ResumeMetadataFilter } from "../types/retrieval.types";

export class AtlasVectorFilterService {
  buildFilter(
    filters?: ResumeMetadataFilter
  ): Record<string, unknown> {
    if (!filters) {
      return {};
    }

    const conditions: Record<string, unknown>[] = [];

    // Skills
    //
    // Atlas Vector Search does not support:
    //
    // skills: { $all: ["Python", "RAG"] }
    //
    // Instead, create one $in condition per skill.
    if (filters.skills && filters.skills.length > 0) {
      for (const skill of filters.skills) {
        const normalizedSkill = skill.trim();

        if (!normalizedSkill) {
          continue;
        }

        conditions.push({
          skills: {
            $in: [normalizedSkill]
          }
        });
      }
    }

    // Minimum experience
    if (
      filters.minimumExperience !== undefined &&
      filters.minimumExperience !== null
    ) {
      conditions.push({
        totalExperience: {
          $gte: Number(filters.minimumExperience)
        }
      });
    }

    // Maximum experience
    if (
      filters.maximumExperience !== undefined &&
      filters.maximumExperience !== null
    ) {
      conditions.push({
        totalExperience: {
          $lte: Number(filters.maximumExperience)
        }
      });
    }

    // Roles
    if (filters.roles && filters.roles.length > 0) {
      const roles = filters.roles
        .map((role) => role.trim())
        .filter(Boolean);

      if (roles.length > 0) {
        conditions.push({
          role: {
            $in: roles
          }
        });
      }
    }

    // Companies
    if (filters.companies && filters.companies.length > 0) {
      const companies = filters.companies
        .map((company) => company.trim())
        .filter(Boolean);

      if (companies.length > 0) {
        conditions.push({
          company: {
            $in: companies
          }
        });
      }
    }

    // Locations
    if (filters.locations && filters.locations.length > 0) {
      const locations = filters.locations
        .map((location) => location.trim())
        .filter(Boolean);

      if (locations.length > 0) {
        conditions.push({
          location: {
            $in: locations
          }
        });
      }
    }

    // If there are no Atlas-compatible filters
    if (conditions.length === 0) {
      return {};
    }

    // One condition does not need $and
    if (conditions.length === 1) {
      return conditions[0];
    }

    // Multiple conditions must all be satisfied
    return {
      $and: conditions
    };
  }
}