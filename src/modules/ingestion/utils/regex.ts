
export const EMAIL_REGEX =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export const PHONE_REGEX =
  /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/;

export const LINKEDIN_REGEX =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i;

export const GITHUB_REGEX =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/i;

export const PORTFOLIO_URL_REGEX =
  /\bhttps?:\/\/(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?\b/i;



export const EXPERIENCE_REGEX =
  /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and|&)\s*(\d+)\s*(?:months?|mos?))?(?:\s+of\s+experience)?/i;

export const EXPERIENCE_RANGE_REGEX =
  /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i;

export const MONTHS_EXPERIENCE_REGEX =
  /(\d+)\s*(?:months?|mos?)(?:\s+of\s+experience)?/i;

export function extractNumberFromExperience(
  text: string
): number | null {
  const match = text.match(EXPERIENCE_REGEX);

  if (!match) {
    return null;
  }

  const years = Number.parseFloat(match[1]);

  if (!Number.isFinite(years)) {
    return null;
  }

  const months = match[2]
    ? Number.parseInt(match[2], 10)
    : 0;

  return years + months / 12;
}


// ─────────────────────────────────────────────────────────────
// Education
// ─────────────────────────────────────────────────────────────

export const DEGREE_REGEX =
  /\b(?:BSc|B\.Sc|BCA|BBA|BA|BE|B\.E|BTech|B\.Tech|Bachelor(?:'s)?|MSc|M\.Sc|MBA|MCA|MA|ME|M\.E|MTech|M\.Tech|Master(?:'s)?|PhD|Ph\.D|Diploma|ND|N\.Dip|HND|Higher\s+National\s+Diploma)\b/gi;

export const COMPUTER_SCIENCE_REGEX =
  /\b(?:computer\s+science|software\s+engineering|information\s+technology|IT|informatics|computer\s+engineering)\b/i;

export const UNIVERSITY_REGEX =
  /\b(?:university|college|institute|school|academy)\b/i;

export const EDUCATION_SECTION_REGEX =
  /\b(?:education|academic\s+background|educational\s+qualifications|qualifications)\b/i;

export const GRADUATION_YEAR_REGEX =
  /\b(?:19|20)\d{2}\b/g;

export const EDUCATION_STATUS_REGEX =
  /\b(?:currently\s+pursuing|pursuing|graduated|graduate|completed|in\s+progress|ongoing|expected\s+graduation)\b/i;

export const GPA_REGEX =
  /\b(?:CGPA|GPA)\s*(?:is|:|-)?\s*(\d+(?:\.\d+)?)(?:\s*(?:out\s+of|\/)\s*(\d+(?:\.\d+)?))?/i;



export const PROGRAMMING_LANGUAGE_REGEX =
  /\b(?:Python|Java|JavaScript|TypeScript|C\+\+|C#|C|Go|Golang|Rust|PHP|Ruby|Kotlin|Swift|SQL|Scala|Dart)\b/gi;


export const R_LANGUAGE_REGEX =
  /(?:^|[\s,;|])R(?=[\s,;|.]|$)/g;

export const FRAMEWORK_REGEX =
  /\b(?:React|React\.js|Angular|Vue|Vue\.js|Next\.js|Node\.js|Express|Express\.js|Django|Flask|FastAPI|Spring|Spring Boot|\.NET|ASP\.NET|Laravel|TensorFlow|PyTorch|Pandas|NumPy|Scikit[- ]learn)\b/gi;

export const DATABASE_REGEX =
  /\b(?:MySQL|PostgreSQL|MongoDB|Oracle|SQL Server|Microsoft SQL Server|Redis|DynamoDB|SQLite|Cassandra|Elasticsearch|MariaDB|Firebase)\b/gi;

export const CLOUD_REGEX =
  /\b(?:AWS|Amazon Web Services|Azure|Microsoft Azure|Google Cloud|GCP|Google Cloud Platform|Docker|Kubernetes|Terraform|CloudFormation|Heroku|Vercel|Netlify)\b/gi;

export const AI_ML_REGEX =
  /\b(?:Artificial Intelligence|AI|Machine Learning|ML|Deep Learning|NLP|Natural Language Processing|LLM|Large Language Model|Large Language Models|Generative AI|GenAI|RAG|Retrieval[- ]Augmented Generation|Computer Vision|Prompt Engineering|Embeddings|Vector Database|Vector Databases|Fine[- ]tuning|Reinforcement Learning|Neural Networks|Agentic AI|AI Engineering)\b/gi;

export const DATA_ANALYTICS_REGEX =
  /\b(?:Data Analysis|Data Analytics|Business Intelligence|BI|Power BI|Tableau|Excel|Microsoft Excel|Statistics|Statistical Analysis|Data Visualization)\b/gi;

export const DEVOPS_REGEX =
  /\b(?:CI\/CD|Jenkins|GitHub Actions|GitLab CI|Azure DevOps|Docker|Kubernetes|Terraform|Ansible|Linux|Bash|Shell Scripting)\b/gi;

export const VERSION_CONTROL_REGEX =
  /\b(?:Git|GitHub|GitLab|Bitbucket|SVN|Subversion)\b/gi;




export const JOB_TITLE_REGEX =
  /\b(?:Revenue Assurance Graduate|Software Engineer|Software Developer|Software Development Engineer|Full[- ]Stack Developer|Full[- ]Stack Engineer|Frontend Developer|Front[- ]end Developer|Backend Developer|Back[- ]end Developer|AI Engineer|AI Developer|ML Engineer|Machine Learning Engineer|Data Scientist|Data Analyst|Data Engineer|DevOps Engineer|Cloud Engineer|QA Engineer|QA Analyst|Test Engineer|Test Analyst|Automation Engineer|Automation Tester|Solutions Architect|Technical Architect|Technical Lead|Team Lead|Engineering Manager|Product Manager|Product Owner|Business Analyst|Business Intelligence Analyst|Marketing Manager|Marketing Executive|Marketing Assistant|Digital Marketing Executive|Digital Marketing Specialist|Operations Manager|Operations Executive|Operations Assistant|Operation Assistant|Operations Analyst|Operations Coordinator|HR Manager|HR Executive|HR Assistant|Human Resources Manager|Sales Manager|Sales Executive|Sales Associate|Customer Service Representative|Customer Support Representative|Customer Support|Consultant|Project Manager|Project Coordinator|Research Assistant|Research Analyst|Executive|Assistant|Analyst|Associate|Specialist|Officer|Intern|Trainee|Graduate Trainee|Graduate|Apprentice)\b/gi;



export const EMPLOYMENT_SECTION_REGEX =
  /\b(?:work\s+experience|professional\s+experience|employment\s+history|work\s+history|career\s+history|professional\s+background)\b/i;

export const EMPLOYMENT_TYPE_REGEX =
  /\b(?:internship|intern|full[-\s]?time|fulltime|part[-\s]?time|parttime|contract|contractor|freelance|temporary|permanent|trainee|apprenticeship|graduate|graduate\s+trainee|volunteer)\b/gi;

export const EMPLOYMENT_DATE_REGEX =
  /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\b/gi;

export const DATE_RANGE_REGEX =
  /\b(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2})\s*(?:[-–]|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|Present|Current|Ongoing)\b/gi;

export const CURRENT_JOB_REGEX =
  /\b(?:present|current|currently|ongoing)\b/i;

export const KNOWN_COMPANY_REGEX =
  /\b(?:MultiChoice|Microsoft|Google|Amazon|Meta|Apple|IBM|Oracle|Accenture|Deloitte|KPMG|PWC|EY)\b/i;

export const COMPANY_NAME_REGEX =
  /\b[A-Z][A-Za-z0-9&.,'() -]{2,}?\s+(?:PVT\.?\s+LTD\.?|PTY\.?\s+LTD\.?|PRIVATE\s+LIMITED|LTD\.?|LIMITED|LLC|INC\.?|CORP\.?|CORPORATION|PLC|GMBH)\b/i;

export const COMPANY_SUFFIX_REGEX =
  /\b(?:PVT\.?\s*LTD\.?|PRIVATE\s+LIMITED|LTD\.?|LIMITED|LLC|INC\.?|CORP\.?|CORPORATION|PLC|GMBH|CO\.?)\b/i;

export const EMPLOYMENT_ACTION_REGEX =
  /\b(?:worked|working|joined|employed|interned|internship|responsible|responsibilities|managed|developed|assisted|supported|led|coordinated|maintained|implemented|designed|created|delivered|handled|supervised)\b/gi;

export const EMPLOYMENT_LOCATION_LABEL_REGEX =
  /\b(?:location|based\s+in|office|city|location:)\s*:?\s*/i;


export const DURATION_REGEX =
  /(\d+(?:\.\d+)?)\s*(?:years?|yrs?|months?|mos?|weeks?|days?)\b/i;

export const EMPLOYMENT_DURATION_REGEX =
  /(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?|months?|mos?)\b(?:\s+(?:and|&)\s+(\d+)\s*(?:months?|mos?))?/i;


// Section identifier.
export const CERTIFICATION_SECTION_REGEX =
  /\b(?:certifications?|certificates?|professional\s+certifications?|licenses?|workshops?\s*(?:&|and)\s*certifications?)\b/i;

// Recognizes named certification providers/types,
// but does NOT match the generic word "certification" by itself.
export const CERTIFICATION_PROVIDER_REGEX =
  /\b(?:AWS Certified|Microsoft Certified|Azure Certified|Google Cloud Certified|Cisco Certified|CompTIA|Oracle Certified|IBM Certified|Google Certified|Meta Certified|PMI|Scrum Alliance|ISACA|ITIL)\b/gi;

export const CERTIFICATION_NAME_REGEX =
  /\b(?:Certified|Certification in|Certificate in|Fundamentals|Professional Certificate|Professional Certification)\b/gi;


// ─────────────────────────────────────────────────────────────
// Languages
// ─────────────────────────────────────────────────────────────

export const LANGUAGE_SECTION_REGEX =
  /\b(?:languages|language\s+skills|spoken\s+languages|linguistic\s+skills)\b/i;

export const HUMAN_LANGUAGE_REGEX =
  /\b(?:English|Hindi|Tamil|Telugu|French|German|Spanish|Portuguese|Italian|Arabic|Mandarin|Chinese|Japanese|Korean|Afrikaans|Zulu|Xhosa|Setswana|Sepedi|Sesotho|Tsonga|Venda|Swati|Ndebele)\b/gi;

export const LANGUAGE_PROFICIENCY_REGEX =
  /\b(?:basic|beginner|elementary|intermediate|upper[- ]intermediate|advanced|fluent|native|professional|conversational)\b/gi;


export const EMPLOYEE_ID_REGEX =
  /\b(?:employee\s*(?:id|number)|emp\s*(?:id|no))[\s:#-]*[A-Z0-9-]+\b/i;

export const REFERENCE_REGEX =
  /\b(?:references|referees|professional\s+references)\b/i;

export const NOTICE_PERIOD_REGEX =
  /\b(?:notice\s+period|available\s+after)\s*:?\s*\d+\s*(?:days?|weeks?|months?)\b/i;

export const SALARY_REGEX =
  /\b(?:salary|expected\s+salary|current\s+salary|desired\s+salary|CTC|compensation)\s*:?\s*(?:R|\$|€|£|₹)?\s?[\d,]+(?:\.\d+)?\b/i;

export const AVAILABILITY_REGEX =
  /\b(?:available\s+(?:immediately|now|from|after)|immediate\s+availability)\b/i;


// ─────────────────────────────────────────────────────────────
// Profile / Summary
// ─────────────────────────────────────────────────────────────

export const SUMMARY_SECTION_REGEX =
  /\b(?:professional\s+summary|executive\s+summary|career\s+summary|profile|about\s+me|objective|career\s+objective)\b/i;

export const SKILLS_SECTION_REGEX =
  /\b(?:skills|technical\s+skills|core\s+skills|key\s+skills|competencies|technical\s+competencies)\b/i;


// ─────────────────────────────────────────────────────────────
// Resume Section Headers
// ─────────────────────────────────────────────────────────────

export const RESUME_SECTION_REGEX =
  /\b(?:summary|profile|objective|education|experience|work\s+experience|employment\s+history|skills|technical\s+skills|projects|certifications?|workshops?|achievements?|awards?|languages|references|interests|publications)\b/gi;

