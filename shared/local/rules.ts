export interface EditingRule {
  from: string;
  to: string;
  category: 'phrasing' | 'vocabulary' | 'concision';
  level: 1 | 2 | 3;
  simpleOnly?: boolean;
}

// Deliberately small, context-safe substitutions, not a general thesaurus.
// Never remove qualifications such as "may", "sometimes", or "in most cases".
export const RULES: EditingRule[] = [
  { from: 'in order to', to: 'to', category: 'phrasing', level: 1 },
  { from: 'due to the fact that', to: 'because', category: 'phrasing', level: 1 },
  { from: 'in the event that', to: 'if', category: 'phrasing', level: 1 },
  { from: 'at this point in time', to: 'now', category: 'phrasing', level: 1 },
  { from: 'at the present time', to: 'now', category: 'phrasing', level: 1 },
  { from: 'for the purpose of', to: 'for', category: 'phrasing', level: 1 },
  { from: 'with regard to', to: 'about', category: 'phrasing', level: 2 },
  { from: 'with regards to', to: 'about', category: 'phrasing', level: 2 },
  { from: 'in regard to', to: 'about', category: 'phrasing', level: 2 },
  { from: 'in close proximity to', to: 'near', category: 'phrasing', level: 2 },
  { from: 'on a daily basis', to: 'daily', category: 'phrasing', level: 2 },
  { from: 'on a weekly basis', to: 'weekly', category: 'phrasing', level: 2 },
  { from: 'on a monthly basis', to: 'monthly', category: 'phrasing', level: 2 },
  { from: 'on a regular basis', to: 'regularly', category: 'phrasing', level: 2 },
  { from: 'a large number of', to: 'many', category: 'phrasing', level: 2 },
  { from: 'a small number of', to: 'a few', category: 'phrasing', level: 2 },
  { from: 'a sufficient amount of', to: 'enough', category: 'phrasing', level: 2 },
  { from: 'an adequate amount of', to: 'enough', category: 'phrasing', level: 2 },
  { from: 'has the ability to', to: 'can', category: 'phrasing', level: 2 },
  { from: 'have the ability to', to: 'can', category: 'phrasing', level: 2 },
  { from: 'had the ability to', to: 'could', category: 'phrasing', level: 2 },
  { from: 'in spite of the fact that', to: 'although', category: 'phrasing', level: 2 },
  { from: 'despite the fact that', to: 'although', category: 'phrasing', level: 2 },
  { from: 'until such time as', to: 'until', category: 'phrasing', level: 2 },
  { from: 'during the course of', to: 'during', category: 'phrasing', level: 2 },
  { from: 'in the near future', to: 'soon', category: 'phrasing', level: 3 },
  { from: 'in a timely manner', to: 'promptly', category: 'phrasing', level: 3 },
  { from: 'take into consideration', to: 'consider', category: 'phrasing', level: 3 },
  { from: 'taken into consideration', to: 'considered', category: 'phrasing', level: 3 },
  { from: 'give consideration to', to: 'consider', category: 'phrasing', level: 3 },
  { from: 'make use of', to: 'use', category: 'phrasing', level: 2 },
  { from: 'made use of', to: 'used', category: 'phrasing', level: 2 },
  { from: 'making use of', to: 'using', category: 'phrasing', level: 2 },
  { from: 'is able to', to: 'can', category: 'phrasing', level: 2 },
  { from: 'are able to', to: 'can', category: 'phrasing', level: 2 },
  { from: 'endeavor to', to: 'try to', category: 'phrasing', level: 2 },
  { from: 'endeavors to', to: 'tries to', category: 'phrasing', level: 2 },
  { from: 'endeavored to', to: 'tried to', category: 'phrasing', level: 2 },
  { from: 'demonstrates that', to: 'shows that', category: 'vocabulary', level: 2 },
  { from: 'demonstrate that', to: 'show that', category: 'vocabulary', level: 2 },
  { from: 'demonstrated that', to: 'showed that', category: 'vocabulary', level: 2 },
  { from: 'utilizing', to: 'using', category: 'vocabulary', level: 2 },
  { from: 'utilized', to: 'used', category: 'vocabulary', level: 2 },
  { from: 'utilizes', to: 'uses', category: 'vocabulary', level: 2 },
  { from: 'utilize', to: 'use', category: 'vocabulary', level: 2 },
  { from: 'prior to', to: 'before', category: 'vocabulary', level: 2 },
  { from: 'subsequent to', to: 'after', category: 'vocabulary', level: 2 },
  { from: 'subsequently', to: 'later', category: 'vocabulary', level: 3, simpleOnly: true },
  { from: 'numerous', to: 'many', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'assistance', to: 'help', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'frequently', to: 'often', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'additional', to: 'extra', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'commenced', to: 'started', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'commence', to: 'start', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'commences', to: 'starts', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'commencing', to: 'starting', category: 'vocabulary', level: 2, simpleOnly: true },
  { from: 'it is important to note that', to: 'note that', category: 'concision', level: 2 },
  { from: 'it is worth noting that', to: 'note that', category: 'concision', level: 2 },
  { from: 'the reason why is that', to: 'the reason is that', category: 'concision', level: 3 },
  { from: 'each and every', to: 'each', category: 'concision', level: 2 },
  { from: 'first and foremost', to: 'first', category: 'concision', level: 2 },
  { from: 'at a later point in time', to: 'later', category: 'concision', level: 2 },
  { from: 'at this particular point in time', to: 'now', category: 'concision', level: 2 },
];

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function rulePattern(phrase: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(phrase).replace(/ /gu, '[ \\t]+')}\\b`, 'giu');
}

export const CONTRACTIONS: Array<[string, string]> = [
  ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"],
  ['cannot', "can't"], ['will not', "won't"], ['should not', "shouldn't"],
  ['would not', "wouldn't"], ['could not', "couldn't"], ['is not', "isn't"],
  ['are not', "aren't"], ['was not', "wasn't"], ['were not', "weren't"],
  ['have not', "haven't"], ['has not', "hasn't"], ['had not', "hadn't"],
  ['I am', "I'm"], ['we are', "we're"], ['you are', "you're"],
  ['they are', "they're"], ['I will', "I'll"], ['we will', "we'll"],
  ['you will', "you'll"], ['they will', "they'll"],
];
