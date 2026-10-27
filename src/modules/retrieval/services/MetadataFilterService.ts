import type { ResumeMetadataFilter } from "../types/retrieval.types";

export class MetadataFilterService {
  buildMongoFilter(filters?: ResumeMetadataFilter): Record<string, unknown> {
    const mongoFilter: Record<string, unknown> = {};

    if (!filters) {
      return mongoFilter;
    }

    if (filters.skills && filters.skills.length > 0) {
      mongoFilter.skills = { $all: filters.skills.map((skill) => skill.trim()).filter(Boolean) };
    }

    if (filters.minimumExperience !== undefined && filters.minimumExperience !== null) {
      mongoFilter.totalExperience = {
        ...(typeof mongoFilter.totalExperience === "object" ? mongoFilter.totalExperience : {}),
        $gte: Number(filters.minimumExperience)
      };
    }

    if (filters.maximumExperience !== undefined && filters.maximumExperience !== null) {
      mongoFilter.totalExperience = {
        ...(typeof mongoFilter.totalExperience === "object" ? mongoFilter.totalExperience : {}),
        $lte: Number(filters.maximumExperience)
      };
    }

    if (filters.roles && filters.roles.length > 0) {
      mongoFilter.role = { $in: filters.roles.map((role) => role.trim()).filter(Boolean) };
    }

    if (filters.companies && filters.companies.length > 0) {
      mongoFilter.company = { $in: filters.companies.map((company) => company.trim()).filter(Boolean) };
    }

    if (filters.locations && filters.locations.length > 0) {
      mongoFilter.location = { $in: filters.locations.map((location) => location.trim()).filter(Boolean) };
    }

    if (filters.education) {
      mongoFilter.education = { $regex: filters.education.trim(), $options: "i" };
    }

    return mongoFilter;
  }
}
