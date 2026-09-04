export const GENERATOR_ISSUE_KEYS = [
  "issueClientDic",
  "issueIssuerDic",
  "issueIssuerEmail",
  "issueIssuerIco",
  "issueIssuerName",
  "issueClientName",
  "issueLine",
  "issueZip",
  "issueBank",
  "issueGeneric",
] as const;

export type GeneratorIssueKey = (typeof GENERATOR_ISSUE_KEYS)[number];

const RULES: { key: GeneratorIssueKey; test: RegExp }[] = [
  {
    key: "issueClientDic",
    test: /client\.dic|client di[cč]|reverse_charge requires client/iu,
  },
  { key: "issueIssuerDic", test: /issuer\.dic|issuer di[cč]/iu },
  { key: "issueIssuerEmail", test: /issuer\.contactEmail|contactEmail/iu },
  { key: "issueIssuerIco", test: /issuer\.ico/iu },
  { key: "issueIssuerName", test: /issuer\.name/iu },
  { key: "issueClientName", test: /client\.name/iu },
  { key: "issueLine", test: /line description|items\.\d+\.description/iu },
  { key: "issueZip", test: /address\.zip|\.zip:/iu },
  { key: "issueBank", test: /iban|accountNumber|account number/iu },
];

/** Map a Zod/build failure string to a short list of copy keys. */
export function generatorIssueKeys(message: string): GeneratorIssueKey[] {
  const keys = RULES.filter((rule) => rule.test.test(message)).map(
    (rule) => rule.key,
  );
  if (keys.length === 0) return ["issueGeneric"];
  return keys;
}
