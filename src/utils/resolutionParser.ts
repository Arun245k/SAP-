export interface ParsedStep {
  id: string;
  index: number;
  type: 'solve' | 'recover' | 'mitigate' | 'standard';
  title: string;
  description: string;
  tcode?: string;
  details: string[];
}

/**
 * Parses markdown to extract resolution playbook steps and action sequences.
 */
export function parseResolutionSteps(markdown: string): ParsedStep[] {
  if (!markdown) return [];

  // Try to find a section matching standard playbook keywords
  const headingRegex = /^#{2,4}\s+.*(?:playbook|recovery|resolution|step|remediation).*$/gim;
  let match;
  let startIndex = -1;
  let endIndex = markdown.length;

  while ((match = headingRegex.exec(markdown)) !== null) {
    startIndex = match.index + match[0].length;
    // Find the next heading after this to demarcate the section
    const nextHeadingRegex = /^#{1,4}\s+.*$/gim;
    nextHeadingRegex.lastIndex = startIndex;
    const nextMatch = nextHeadingRegex.exec(markdown);
    if (nextMatch) {
      endIndex = nextMatch.index;
    }
    break;
  }

  // If found specific segment, parse it, else fallback to whole text
  const sectionText = startIndex !== -1 ? markdown.substring(startIndex, endIndex) : markdown;

  const lines = sectionText.split('\n');
  const steps: ParsedStep[] = [];
  let currentStep: ParsedStep | null = null;

  // Regex to look for list items like "1. **[SOLVE: PERMANENT CONFIG/CODE FIX]**:"
  const itemRegex = /^\s*(\d+)\.\s+(\*\*\[.*?\]\*\*|\*\*.*?\*\*|[^:\n]+)(?::| \-)?\s*(.*)$/i;

  for (const line of lines) {
    const itemMatch = line.match(itemRegex);
    if (itemMatch) {
      if (currentStep) {
        steps.push(currentStep);
      }

      const num = parseInt(itemMatch[1], 10);
      const title = itemMatch[2].trim();
      const desc = itemMatch[3].trim();

      let type: 'solve' | 'recover' | 'mitigate' | 'standard' = 'standard';
      const cleanTitleUpper = title.toUpperCase();
      if (cleanTitleUpper.includes('SOLVE')) {
        type = 'solve';
      } else if (cleanTitleUpper.includes('RECOVER')) {
        type = 'recover';
      } else if (cleanTitleUpper.includes('MITIGATE')) {
        type = 'mitigate';
      }

      // Clean up bold/bracket markers
      let cleanTitle = title.replace(/^\*\*+/, '').replace(/\*\*+$/, '').trim();
      if (cleanTitle.startsWith('[') && cleanTitle.endsWith(']')) {
        cleanTitle = cleanTitle.substring(1, cleanTitle.length - 1).trim();
      }

      let tcode: string | undefined;
      // Extract T-code from first line desc if present
      const tcodeMatch = desc.match(/T-Code:\s*`?([A-Z0-9_\-/]+)`?/i);
      if (tcodeMatch) {
        tcode = tcodeMatch[1];
      }

      currentStep = {
        id: `step-${num}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        index: num,
        type,
        title: cleanTitle,
        description: desc,
        details: [],
        tcode,
      };
    } else if (currentStep) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*') || trimmedLine.match(/^\d+\./)) {
        // Strip markdown list prefix
        const subText = trimmedLine.replace(/^[-*\d.]+\s*/, '').trim();
        if (subText) {
          const tcodeMatch = subText.match(/T-Code:\s*`?([A-Z0-9_\-/]+)`?/i);
          if (tcodeMatch && !currentStep.tcode) {
            currentStep.tcode = tcodeMatch[1];
          }
          currentStep.details.push(subText);
        }
      } else if (trimmedLine && !trimmedLine.startsWith('#')) {
        if (!currentStep.description) {
          currentStep.description = trimmedLine;
        } else {
          currentStep.details.push(trimmedLine);
        }
      }
    }
  }

  if (currentStep) {
    steps.push(currentStep);
  }

  return steps;
}
