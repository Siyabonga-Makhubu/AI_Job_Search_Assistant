import {
  EMAIL_REGEX,
  PHONE_REGEX,
  LINKEDIN_REGEX,
  GITHUB_REGEX,

  EXPERIENCE_REGEX,

  DEGREE_REGEX,
  EDUCATION_SECTION_REGEX,
  EDUCATION_STATUS_REGEX,
  GPA_REGEX,

  PROGRAMMING_LANGUAGE_REGEX,
  R_LANGUAGE_REGEX,
  FRAMEWORK_REGEX,
  DATABASE_REGEX,
  CLOUD_REGEX,
  AI_ML_REGEX,
  DATA_ANALYTICS_REGEX,
  DEVOPS_REGEX,
  VERSION_CONTROL_REGEX,

  JOB_TITLE_REGEX,

  EMPLOYMENT_SECTION_REGEX,
  EMPLOYMENT_TYPE_REGEX,
  EMPLOYMENT_DATE_REGEX,
  DATE_RANGE_REGEX,
  CURRENT_JOB_REGEX,
  COMPANY_NAME_REGEX,
  COMPANY_SUFFIX_REGEX,

  CERTIFICATION_SECTION_REGEX,

  LANGUAGE_SECTION_REGEX,
  HUMAN_LANGUAGE_REGEX,

  SUMMARY_SECTION_REGEX,
  SKILLS_SECTION_REGEX,
} from "../utils/regex";


// ─────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────

function unique(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}


function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}


function matchValues(
  text: string,
  regex: RegExp
): string[] {
  return text.match(regex) ?? [];
}


// ─────────────────────────────────────────────────────────────
// Section extraction
// ─────────────────────────────────────────────────────────────

function extractSection(
  text: string,
  sectionRegex: RegExp,
  nextSections: RegExp[]
): string | null {

  const match = text.match(sectionRegex);

  if (
    !match ||
    match.index === undefined
  ) {
    return null;
  }

  const start =
    match.index + match[0].length;

  const remaining =
    text.slice(start);

  let end =
    remaining.length;

  for (const nextRegex of nextSections) {

    const nextMatch =
      remaining.match(nextRegex);

    if (
      nextMatch &&
      nextMatch.index !== undefined &&
      nextMatch.index < end
    ) {
      end = nextMatch.index;
    }
  }

  return remaining
    .slice(0, end)
    .trim();
}


// ─────────────────────────────────────────────────────────────
// Experience
// ─────────────────────────────────────────────────────────────

function extractExplicitExperience(text: string) {

  const match =
    text.match(EXPERIENCE_REGEX);

  if (!match) {
    return {
      experience: null,
      yearsOfExperience: null,
    };
  }

  const years =
    Number.parseFloat(match[1]);

  const months =
    match[2]
      ? Number.parseInt(match[2], 10)
      : 0;

  if (!Number.isFinite(years)) {
    return {
      experience: match[0],
      yearsOfExperience: null,
    };
  }

  return {
    experience: match[0],
    yearsOfExperience:
      years + months / 12,
  };
}


// ─────────────────────────────────────────────────────────────
// Date parsing
// ─────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,

  february: 1,
  feb: 1,

  march: 2,
  mar: 2,

  april: 3,
  apr: 3,

  may: 4,

  june: 5,
  jun: 5,

  july: 6,
  jul: 6,

  august: 7,
  aug: 7,

  september: 8,
  sep: 8,
  sept: 8,

  october: 9,
  oct: 9,

  november: 10,
  nov: 10,

  december: 11,
  dec: 11,
};


function parseDatePart(
  value: string
): Date | null {

  const cleaned =
    value
      .trim()
      .toLowerCase()
      .replace(/\./g, "");

  const match =
    cleaned.match(
      /^(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{4})$/
    );

  if (!match) {
    const yearOnly =
      cleaned.match(/^(\d{4})$/);

    if (yearOnly) {
      return new Date(
        Number(yearOnly[1]),
        0,
        1
      );
    }

    return null;
  }

  const month =
    MONTHS[match[1]];

  const year =
    Number(match[2]);

  return new Date(
    year,
    month,
    1
  );
}


function parseDateRange(
  value: string
) {

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  const parts =
    normalized.split(
      /\s+(?:-|–|to)\s+/i
    );

  if (parts.length !== 2) {
    return {
      startDate: null,
      endDate: null,
      currentlyEmployed: false,
    };
  }

  const start =
    parseDatePart(parts[0]);

  const endText =
    parts[1].trim();

  const currentlyEmployed =
    /^(present|current|ongoing|currently)$/i.test(
      endText
    );

  const end =
    currentlyEmployed
      ? null
      : parseDatePart(endText);

  return {
    startDate: start
      ? start.toISOString().slice(0, 7)
      : null,

    endDate: end
      ? end.toISOString().slice(0, 7)
      : null,

    currentlyEmployed,
  };
}


// ─────────────────────────────────────────────────────────────
// Employment extraction
// ─────────────────────────────────────────────────────────────

function extractEmployment(
  text: string
) {

  const employmentSection =
    extractSection(
      text,
      EMPLOYMENT_SECTION_REGEX,
      [
        EDUCATION_SECTION_REGEX,
        SKILLS_SECTION_REGEX,
        CERTIFICATION_SECTION_REGEX,
        LANGUAGE_SECTION_REGEX,
        /\bprojects\b/i,
      ]
    );

  if (!employmentSection) {
    return [];
  }

  /*
   * Your PDF extractor has flattened some lines.
   * Therefore we work with both:
   *
   * - newline-separated content
   * - recognizable employment patterns
   */

  const lines =
    employmentSection
      .split(/\n+/)
      .map(normalizeText)
      .filter(Boolean);

  const employment: Array<{
    company: string | null;
    position: string | null;
    employmentType: string | null;
    location: string | null;
    dateRange: string | null;
    startDate: string | null;
    endDate: string | null;
    currentlyEmployed: boolean;
  }> = [];


  /*
   * ─────────────────────────────────────────────
   * Special structured pattern:
   *
   * MultiChoice – Revenue Assurance Graduate –
   * Johannesburg, GP
   *
   * March 2023 - May 2025
   * ─────────────────────────────────────────────
   */

  const structuredEmploymentRegex =
    /([a-z][a-z0-9&.' -]{2,}?)\s*[–-]\s*([a-z][a-z0-9&.' -]{2,}?)\s*[–-]\s*([a-z][a-z .,'-]+)\s+(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(\d{4})\s*[-–]\s*(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?(\d{4}|present|current|ongoing)/i;

  const structuredMatch =
    employmentSection.match(
      structuredEmploymentRegex
    );

  if (structuredMatch) {

    const company =
      normalizeText(
        structuredMatch[1]
      );

    const position =
      normalizeText(
        structuredMatch[2]
      );

    const location =
      normalizeText(
        structuredMatch[3]
      );

    const startMonth =
      structuredMatch[4];

    const startYear =
      structuredMatch[5];

    const endMonth =
      structuredMatch[6];

    const endYear =
      structuredMatch[7];

    const startText =
      startMonth
        ? `${startMonth} ${startYear}`
        : startYear;

    const endText =
      endMonth
        ? `${endMonth} ${endYear}`
        : endYear;

    const dateInfo =
      parseDateRange(
        `${startText} - ${endText}`
      );

    const employmentType =
      /\bgraduate\b/i.test(position)
        ? "graduate"
        : null;

    employment.push({
      company,
      position,
      employmentType,
      location,
      dateRange:
        `${startText} - ${endText}`,

      startDate:
        dateInfo.startDate,

      endDate:
        dateInfo.endDate,

      currentlyEmployed:
        dateInfo.currentlyEmployed,
    });

    return employment;
  }


  /*
   * ─────────────────────────────────────────────
   * Generic fallback parser
   * ─────────────────────────────────────────────
   */

  let current: typeof employment[number] | null =
    null;

  for (const line of lines) {

    const dateRange =
      line.match(DATE_RANGE_REGEX)?.[0] ??
      null;

    const jobTitle =
      line.match(JOB_TITLE_REGEX)?.[0] ??
      null;

    const employmentType =
      line.match(EMPLOYMENT_TYPE_REGEX)?.[0] ??
      null;

    const companySuffix =
      COMPANY_SUFFIX_REGEX.test(line);

    const companyMatch =
      line.match(COMPANY_NAME_REGEX)?.[0] ??
      null;


    if (
      companyMatch &&
      !jobTitle
    ) {

      if (current) {
        employment.push(current);
      }

      current = {
        company: companyMatch,
        position: null,
        employmentType: null,
        location: null,
        dateRange: null,
        startDate: null,
        endDate: null,
        currentlyEmployed: false,
      };

      continue;
    }


    if (
      companySuffix &&
      !jobTitle &&
      !current
    ) {

      current = {
        company: line,
        position: null,
        employmentType: null,
        location: null,
        dateRange: null,
        startDate: null,
        endDate: null,
        currentlyEmployed: false,
      };

      continue;
    }


    if (
      jobTitle &&
      !current
    ) {

      current = {
        company: null,
        position: jobTitle,
        employmentType,
        location: null,
        dateRange,
        startDate: null,
        endDate: null,
        currentlyEmployed:
          CURRENT_JOB_REGEX.test(line),
      };

      if (dateRange) {
        const dates =
          parseDateRange(dateRange);

        current.startDate =
          dates.startDate;

        current.endDate =
          dates.endDate;

        current.currentlyEmployed =
          dates.currentlyEmployed;
      }

      continue;
    }


    if (!current) {
      continue;
    }


    if (
      jobTitle &&
      !current.position
    ) {
      current.position = jobTitle;
    }


    if (
      employmentType &&
      !current.employmentType
    ) {
      current.employmentType =
        employmentType;
    }


    if (dateRange) {

      const dates =
        parseDateRange(dateRange);

      current.dateRange =
        dateRange;

      current.startDate =
        dates.startDate;

      current.endDate =
        dates.endDate;

      current.currentlyEmployed =
        dates.currentlyEmployed;
    }
  }


  if (current) {
    employment.push(current);
  }


  return employment;
}


// ─────────────────────────────────────────────────────────────
// Calculate experience from employment dates
// ─────────────────────────────────────────────────────────────

function calculateEmploymentExperience(
  employment: ReturnType<typeof extractEmployment>
): number | null {

  let totalMonths = 0;

  let foundValidDates = false;

  for (const job of employment) {

    if (!job.startDate) {
      continue;
    }

    const start =
      new Date(`${job.startDate}-01`);

    const end =
      job.currentlyEmployed || !job.endDate
        ? new Date()
        : new Date(`${job.endDate}-01`);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      continue;
    }

    const months =
      (
        (end.getFullYear() -
          start.getFullYear()) *
          12
      ) +
      (
        end.getMonth() -
        start.getMonth()
      );

    if (months > 0) {
      totalMonths += months;
      foundValidDates = true;
    }
  }

  if (!foundValidDates) {
    return null;
  }

  return Number(
    (totalMonths / 12).toFixed(2)
  );
}


// ─────────────────────────────────────────────────────────────
// Education extraction
// ─────────────────────────────────────────────────────────────

function extractEducation(text: string) {
  const educationSection = extractSection(
    text,
    EDUCATION_SECTION_REGEX,
    [
      CERTIFICATION_SECTION_REGEX,
      LANGUAGE_SECTION_REGEX,
      /\bprojects\b/i,
      /\bwebsites\s+and\s+profiles\b/i,
    ]
  );

  if (!educationSection) {
    return [];
  }

  const normalized = educationSection
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const education: Array<{
    qualification: string | null;
    fieldOfStudy: string | null;
    institution: string | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string | null;
    gpa: number | null;
    gpaScale: number | null;
  }> = [];

  /*
   * ─────────────────────────────────────────────
   * BSc / university pattern
   *
   * university of kwazulu-natal –
   * bsc in computer science and
   * information technology –
   * durban, kzn
   * may 2023
   * ─────────────────────────────────────────────
   */

  const universityMatch = normalized.match(
    /(?:university|college|institute|school)[^,\n]*?\s*[-–]\s*([a-z][a-z0-9.,' -]*?)\s*[-–]\s*([a-z][a-z .,'-]+?)(?=\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|$)/i
  );

  if (universityMatch) {
    const institution = normalizeText(
      universityMatch[0]
        .split(/\s*[-–]\s*/)[0]
    );

    const qualificationText =
      normalizeText(universityMatch[1]);

    const location =
      normalizeText(universityMatch[2]);

    const degreeMatch =
      qualificationText.match(DEGREE_REGEX);

    const qualification =
      degreeMatch?.[0] ?? null;

    const fieldOfStudy =
      qualificationText
        .replace(
          DEGREE_REGEX,
          ""
        )
        .replace(/^in\s+/i, "")
        .trim() || null;

    const dateMatch =
      normalized.match(
        /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}/i
      );

    education.push({
      qualification,
      fieldOfStudy,
      institution,
      location,
      startDate: null,
      endDate: dateMatch?.[0] ?? null,
      status: null,
      gpa: null,
      gpaScale: null,
    });
  }


  /*
   * ─────────────────────────────────────────────
   * Matric / school pattern
   *
   * injabulo combined school –
   * matric –
   * piet retief, mpumalanga
   * ─────────────────────────────────────────────
   */

  const matricMatch = normalized.match(
    /([a-z][a-z0-9.' -]+?)\s*[-–]\s*(matric|grade\s*12|high\s+school)\s*[-–]\s*([a-z][a-z .,'-]+?)(?=\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|$)/i
  );

  if (matricMatch) {
    const dateMatch =
      normalized.match(
        /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}/i
      );

    education.push({
      qualification:
        matricMatch[2],

      fieldOfStudy:
        null,

      institution:
        normalizeText(matricMatch[1]),

      location:
        normalizeText(matricMatch[3]),

      startDate:
        null,

      endDate:
        dateMatch?.[0] ?? null,

      status:
        "completed",

      gpa:
        null,

      gpaScale:
        null,
    });
  }


  /*
   * ─────────────────────────────────────────────
   * Generic fallback
   * ─────────────────────────────────────────────
   *
   * This catches qualifications that don't match
   * the two patterns above.
   */

  if (education.length === 0) {
    const lines = educationSection
      .split(/\n+/)
      .map(normalizeText)
      .filter(Boolean);

    for (const line of lines) {
      const degreeMatches =
        line.match(DEGREE_REGEX) ?? [];

      if (degreeMatches.length === 0) {
        continue;
      }

      const years =
        line.match(
          /\b(?:19|20)\d{2}\b/g
        ) ?? [];

      const gpa =
        line.match(GPA_REGEX);

      const status =
        line.match(
          EDUCATION_STATUS_REGEX
        )?.[0] ?? null;

      education.push({
        qualification:
          unique(degreeMatches)[0] ?? null,

        fieldOfStudy:
          null,

        institution:
          line,

        location:
          null,

        startDate:
          null,

        endDate:
          years.at(-1) ?? null,

        status,

        gpa:
          gpa?.[1]
            ? Number.parseFloat(gpa[1])
            : null,

        gpaScale:
          gpa?.[2]
            ? Number.parseFloat(gpa[2])
            : null,
      });
    }
  }

  return education;
}


// ─────────────────────────────────────────────────────────────
// Certifications
// ─────────────────────────────────────────────────────────────

function extractCertifications(
  text: string
) {

  const certificationSection =
    extractSection(
      text,
      CERTIFICATION_SECTION_REGEX,
      [
        /\bprojects\b/i,
        EDUCATION_SECTION_REGEX,
        LANGUAGE_SECTION_REGEX,
        /\bwebsites\s+and\s+profiles\b/i,
      ]
    );

  if (!certificationSection) {
    return [];
  }

  const lines =
    certificationSection
      .split(/\n+/)
      .map(normalizeText)
      .filter(Boolean);

  /*
   * In this CV:
   *
   * certifications
   * business data analyst
   * full stack development july 2025
   *
   * Therefore we should preserve meaningful
   * lines rather than requiring "Certified".
   */

  return unique(
    lines.filter((line) => {

      if (
        /^certifications?$/i.test(line)
      ) {
        return false;
      }

      return (
        line.length >= 3
      );
    })
  );
}


// ─────────────────────────────────────────────────────────────
// Human languages
// ─────────────────────────────────────────────────────────────

function extractLanguages(
  text: string
) {

  const languageSection =
    extractSection(
      text,
      LANGUAGE_SECTION_REGEX,
      [
        /\bprojects\b/i,
        EDUCATION_SECTION_REGEX,
        CERTIFICATION_SECTION_REGEX,
      ]
    );

  if (!languageSection) {
    return [];
  }

  return unique(
    matchValues(
      languageSection,
      HUMAN_LANGUAGE_REGEX
    )
  );
}


// ─────────────────────────────────────────────────────────────
// Main extractor
// ─────────────────────────────────────────────────────────────

export function extractCVIdentifiers(
  text: string
) {

  const explicitExperience =
    extractExplicitExperience(text);

  const employment =
    extractEmployment(text);

  /*
   * If explicit experience exists,
   * prefer it.
   *
   * Otherwise calculate it from
   * employment date ranges.
   */
  const calculatedExperience =
    calculateEmploymentExperience(
      employment
    );

  const yearsOfExperience =
    explicitExperience.yearsOfExperience ??
    calculatedExperience;


  const programmingLanguages =
    unique(
      matchValues(
        text,
        PROGRAMMING_LANGUAGE_REGEX
      )
    );


  /*
   * Handle R separately.
   */
  if (
    R_LANGUAGE_REGEX.test(text)
  ) {
    if (
      !programmingLanguages
        .some(
          (language) =>
            language.toLowerCase() === "r"
        )
    ) {
      programmingLanguages.push("R");
    }
  }


  const education =
    extractEducation(text);

  const certifications =
    extractCertifications(text);

  const languages =
    extractLanguages(text);


  const educationSection =
    text.match(
      EDUCATION_SECTION_REGEX
    );

  const skillsSection =
    text.match(
      SKILLS_SECTION_REGEX
    );

  const summarySection =
    text.match(
      SUMMARY_SECTION_REGEX
    );

  const experienceSection =
    text.match(
      EMPLOYMENT_SECTION_REGEX
    );

  const certificationSection =
    text.match(
      CERTIFICATION_SECTION_REGEX
    );

  const languageSection =
    text.match(
      LANGUAGE_SECTION_REGEX
    );


  return {

    // Contact
    email:
      text.match(EMAIL_REGEX)?.[0] ??
      null,

    phone:
      text.match(PHONE_REGEX)?.[0] ??
      null,

    linkedin:
      text.match(LINKEDIN_REGEX)?.[0] ??
      null,

    github:
      text.match(GITHUB_REGEX)?.[0] ??
      null,


    // Experience
    experience:
      explicitExperience.experience,

    yearsOfExperience,

    employment,


    // Education
    degrees:
      unique(
        matchValues(
          text,
          DEGREE_REGEX
        )
      ),

    education,


    // Technical skills
    programmingLanguages,

    frameworks:
      unique(
        matchValues(
          text,
          FRAMEWORK_REGEX
        )
      ),

    databases:
      unique(
        matchValues(
          text,
          DATABASE_REGEX
        )
      ),

    cloudTechnologies:
      unique(
        matchValues(
          text,
          CLOUD_REGEX
        )
      ),

    aiSkills:
      unique(
        matchValues(
          text,
          AI_ML_REGEX
        )
      ),

    dataAnalytics:
      unique(
        matchValues(
          text,
          DATA_ANALYTICS_REGEX
        )
      ),

    devOps:
      unique(
        matchValues(
          text,
          DEVOPS_REGEX
        )
      ),

    versionControl:
      unique(
        matchValues(
          text,
          VERSION_CONTROL_REGEX
        )
      ),


    // Career
    jobTitles:
      unique(
        matchValues(
          text,
          JOB_TITLE_REGEX
        )
      ),


    // Certifications
    certifications,


    // Languages
    languages,


    // Section information
    sections: {
      hasEducation:
        Boolean(educationSection),

      hasSkills:
        Boolean(skillsSection),

      hasSummary:
        Boolean(summarySection),

      hasExperience:
        Boolean(experienceSection),

      hasCertifications:
        Boolean(certificationSection),

      hasLanguages:
        Boolean(languageSection),
    },
  };
}