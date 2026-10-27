/**
 * Input and output types for the job parsing pipeline.
 */

export interface JobParseInput {
  /** Cleaned job description text ready for parsing. */
  cleanedText: string;
  /** Optional title extracted from the source page before parsing. */
  rawTitle?: string;
  /** Optional company name extracted from the source page. */
  rawCompany?: string;
  /** Optional location string extracted from the source page. */
  rawLocation?: string;
}

/**
 * Structured output from the parser.
 *
 * Every field is optional because not all job posts expose all information.
 * The parser must never invent values that are not present in the input text.
 */
export interface ParsedJob {
  title?: string;
  company?: string;
  location?: string;
  remote?: boolean;

  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  technologies: string[];
  qualifications: string[];
  experienceRequirements: string[];
  educationRequirements: string[];

  employmentType?: string;

  /** Raw section text kept for debugging / audit. */
  _raw?: {
    responsibilitiesSection?: string;
    requirementsSection?: string;
  };
}
