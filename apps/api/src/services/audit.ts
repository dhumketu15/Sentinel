type AuditRule = {
  id: string;
  rule_key: string;
  title: string;
  description: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  evaluation_instructions: string;
  compliant_examples?: string[];
  noncompliant_examples?: string[];
  source_reference?: string | null;
  mandatory: boolean;
};

type AuditBrand = { name: string; prohibited_phrases?: string[]; preferred_tone?: string | null };

const penalties: Record<AuditRule["severity"], number> = { critical: 32, high: 22, medium: 14, low: 7, informational: 2 };
const riskyPatterns = [
  { pattern: /\bguarantee(?:d|s)?\b/gi, label: "guaranteed claim" },
  { pattern: /#?1\s*(?:cure|solution|brand|product)|number\s*one/gi, label: "unsubstantiated superlative" },
  { pattern: /\b(?:cure|cures|heals|healing)\b/gi, label: "medical efficacy claim" },
  { pattern: /\b(?:instant|zero\s*risk|100%\s*safe|no\s*side\s*effects)\b/gi, label: "absolute claim" },
  { pattern: /\b(?:before\s*&?\s*after|miracle|permanent\s*results?)\b/gi, label: "high-risk outcome claim" },
];

function riskClass(score: number) {
  if (score < 40) return "critical";
  if (score < 60) return "high";
  if (score < 80) return "medium";
  if (score < 95) return "low";
  return "safe";
}

export function scoreAudit(content: string, brand: AuditBrand, rules: AuditRule[]) {
  const normalized = content.toLowerCase();
  const findings: Array<Record<string, unknown>> = [];
  let score = 100;
  const matchedRuleIds = new Set<string>();

  for (const rule of rules) {
    const examples = [...(rule.noncompliant_examples ?? []), rule.title, rule.category]
      .filter(Boolean)
      .map((value) => value.toLowerCase())
      .filter((value) => value.length > 4);
    const match = examples.find((value) => normalized.includes(value));
    if (!match) continue;
    matchedRuleIds.add(rule.id);
    const evidence = content.slice(Math.max(0, normalized.indexOf(match)), Math.min(content.length, normalized.indexOf(match) + Math.max(match.length + 60, 90)));
    score -= penalties[rule.severity];
    findings.push({
      rule_id: rule.id,
      category: rule.category,
      severity: rule.severity,
      description: rule.title,
      evidence,
      guideline_reference: rule.source_reference ?? `Rule ${rule.rule_key}`,
      explanation: rule.description,
      recommended_correction: rule.compliant_examples?.[0] ?? `Rewrite this ${rule.category.toLowerCase()} claim with specific, supportable language.`,
      confidence: 0.86,
    });
  }

  for (const risky of riskyPatterns) {
    risky.pattern.lastIndex = 0;
    const match = risky.pattern.exec(content);
    if (!match) continue;
    const existing = findings.find((finding) => String(finding.evidence ?? "").toLowerCase().includes(match[0].toLowerCase()));
    if (existing) continue;
    const fallbackRule = rules.find((rule) => rule.category.toLowerCase().includes("claim") || rule.title.toLowerCase().includes("claim")) ?? rules[0];
    const severity = fallbackRule?.severity ?? "high";
    score -= penalties[severity];
    findings.push({
      rule_id: fallbackRule?.id ?? null,
      category: fallbackRule?.category ?? "Claims & evidence",
      severity,
      description: risky.label,
      evidence: match[0],
      guideline_reference: fallbackRule?.source_reference ?? "Deterministic claim-risk heuristic",
      explanation: "The phrase may overstate an outcome or imply certainty without visible supporting evidence.",
      recommended_correction: "Use specific, supportable language and add the required qualifier or evidence reference before publishing.",
      confidence: 0.78,
    });
  }

  for (const phrase of brand.prohibited_phrases ?? []) {
    const index = normalized.indexOf(phrase.toLowerCase());
    if (index < 0) continue;
    if (findings.some((finding) => String(finding.evidence ?? "").toLowerCase().includes(phrase.toLowerCase()))) continue;
    score -= 16;
    findings.push({
      rule_id: null,
      category: "Prohibited language",
      severity: "high",
      description: "Prohibited phrase detected",
      evidence: content.slice(index, index + phrase.length + 50),
      guideline_reference: "Brand profile prohibited phrases",
      explanation: `The phrase “${phrase}” is listed as prohibited in the active brand profile.`,
      recommended_correction: "Remove the phrase or replace it with approved terminology from the brand profile.",
      confidence: 0.97,
    });
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const risk = riskClass(finalScore);
  const summary = findings.length === 0
    ? `${brand.name} alignment is strong in this deterministic review. No configured rule or claim-risk heuristic was triggered.`
    : `${findings.length} finding${findings.length === 1 ? "" : "s"} need review before publishing. Prioritize ${findings.filter((finding) => finding.severity === "critical" || finding.severity === "high").length} high-impact issue${findings.filter((finding) => finding.severity === "critical" || finding.severity === "high").length === 1 ? "" : "s"}.`;

  return { score: finalScore, riskClass: risk, summary, findings, modelId: "deterministic-demo-v1", promptVersion: "audit-rules-1", isDemo: true, matchedRuleIds: [...matchedRuleIds] };
}
