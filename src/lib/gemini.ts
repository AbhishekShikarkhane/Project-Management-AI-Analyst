import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectTask } from './dataset';
import {
  extractDeterministicFacts,
  auditDataQuality,
  analyzeSchedule,
  analyzeResources,
} from './analytics';
import fs from 'fs';
import path from 'path';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

export interface AnalystResponse {
  text_response: string;
  highlight_ids: string[];
}

function getSystemInstruction(): string {
  let baseGuardrails = '';
  try {
    const instructionsPath = path.join(process.cwd(), 'PROJECT_INSTRUCTIONS.md');
    if (fs.existsSync(instructionsPath)) {
      baseGuardrails = fs.readFileSync(instructionsPath, 'utf-8').trim();
    }
  } catch (err) {
    console.warn('Could not read PROJECT_INSTRUCTIONS.md, using default guardrails');
  }

  if (!baseGuardrails) {
    baseGuardrails = `
# AI Agent Guardrails & Grounding Instructions
## 1. Role & Identity
You are a highly restrictive, deterministic data analyst API route. Your sole purpose is to process incoming natural language queries against a provided JSON dataset and return factual, mathematically sound answers based entirely on that data. 

## 2. Anti-Hallucination Protocols
* Strict Grounding: You must ONLY base your answers on the provided JSON data payload. Do not use pre-training knowledge to guess, fill in gaps, or assume external metrics.
* Missing Data Fallback: If a user asks a question that cannot be explicitly answered by the rows and columns present in the dataset, you must reply strictly with: "Data not available in the current project file."
* No Creative Synthesis: Do not invent trends, hypothetical risks, or future projections unless the math within the provided dataset explicitly supports it.

## 3. Data Handling
* When executing data parsing, ensure all dates, numerical values (costs, hours), and status strings are accurately converted and correctly typed in the JSON array.
* Strip out any highly sensitive identifiable information before transmitting the payload to the language model.
`.trim();
  }

  return `
${baseGuardrails}

CRITICAL STRUCTURED OUTPUT REQUIREMENT:
You must respond ONLY with a valid JSON object matching this exact schema:
{
  "text_response": "Your full, rigorous conversational answer in Markdown format (use tables, bold numbers, bullet points, Task IDs, and executive structure). If data is not available, output: Data not available in the current project file.",
  "highlight_ids": ["task_id_1", "task_id_2"]
}

CRITICAL MATHEMATICAL GROUNDING RULE:
You MUST cite the verified deterministic calculation figures provided in the prompt section "VERIFIED DETERMINISTIC ANALYTICAL CALCULATIONS".
Do NOT perform ad-hoc mental addition or approximation of budgets, spending, or averages. If asked for total budget, actual spend, or average progress, quote the exact verified numbers provided.

ANALYST CAPABILITIES ON GRANULAR PROJECT DATA:
- Deadline Forecasting: Utilize Start_Date, End_Date, and Progress_Percent to assess timeline health and project delay risks. Highlight tasks with high priority, low progress, or looming end dates.
- Resource Bottlenecks: Analyze Number_of_Team_Members, Project_Manager, and Department allocations. Identify individuals or teams that are over-allocated or constrained.
- Financial Variance: Compare Allocated_Budget_USD against Actual_Spend_USD alongside Risk_Level and Status.

HIGHLIGHT RULES:
- In "highlight_ids", include an array of exact Task_ID strings (e.g. ["TASK-001", "TASK-002"]) for every task that is directly mentioned, analyzed, belongs to the queried category/owner/department/status, or caused a blocker/variance/deadline risk/resource bottleneck.
- If the question is about blocked tasks, return the IDs of all blocked tasks.
- If the question is about over-budget items, return the IDs of those over-budget tasks.
- If the question is about deadline risks or high-risk tasks, return their IDs.
- If no specific tasks apply or if information is not found, return an empty array: [].
- Output purely the JSON object without markdown wrapper if possible, or inside a clean json codeblock.
`.trim();
}

/**
 * Builds the bundled prompt combining strict analyst directives, the JSON dataset, verified deterministic math, and user conversation
 */
function buildBundledPrompt(
  question: string,
  records: ProjectTask[],
  conversationHistory: ChatMessage[] = []
): string {
  const deterministicFacts = extractDeterministicFacts(question, records);
  const dataQuality = auditDataQuality(records);

  const analyticalFacts = [
    `Data Quality Compliance: ${dataQuality.complianceRatePercent}% clean records (${dataQuality.totalIssuesCount} validation issues identified)`,
  ];

  // Strip sensitive info if needed and prepare lightweight, enriched JSON payload
  const lightweightRecords = records.map((r) => ({
    Task_ID: r.Task_ID,
    Project_Name: r.Project_Name,
    Task_Title: r.Task_Title,
    Sprint: r.Sprint,
    Owner: r.Owner || r.Project_Manager,
    Project_Manager: r.Project_Manager || r['Project Manager'] || r.Owner,
    Department: r.Department,
    Priority: r.Priority,
    Status: r.Status,
    Progress_Percent: r.Progress_Percent,
    Estimated_Hours: r.Estimated_Hours,
    Actual_Hours: r.Actual_Hours,
    Allocated_Budget_USD: r.Allocated_Budget_USD,
    Actual_Spend_USD: r.Actual_Spend_USD,
    Start_Date: r.Start_Date,
    Due_Date: r.Due_Date,
    End_Date: r.End_Date || r.Due_Date,
    Risk_Level: r.Risk_Level,
    Number_of_Team_Members:
      r.Number_of_Team_Members ?? r['Number of Team Members'] ?? r.Team_Members_Count ?? 1,
    Blocker_Details: r.Blocker_Details,
  }));

  const datasetJson = JSON.stringify(lightweightRecords);

  let historyContext = '';
  if (conversationHistory.length > 0) {
    historyContext =
      `\n--- CONVERSATION CONTEXT ---\n` +
      conversationHistory
        .map((m) => `${m.role === 'user' ? 'User' : 'Analyst'}: ${m.content}`)
        .join('\n') +
      `\n---------------------------\n`;
  }

  const verifiedMathSection = `
=== VERIFIED DETERMINISTIC ANALYTICAL CALCULATIONS (SINGLE SOURCE OF TRUTH) ===
CRITICAL: These figures are pre-computed directly from the database using certified business logic identical to the dashboard.
You MUST use these EXACT numerical figures when stating totals, averages, variances, and forecasts. Do NOT attempt to mental-math or re-aggregate:
${deterministicFacts.contextFacts.map((f) => `- ${f}`).join('\n')}
${analyticalFacts.map((f) => `- ${f}`).join('\n')}
================================================================================
`.trim();

  return `
${verifiedMathSection}

=== VERIFIED DATASET PAYLOAD ===
Total Records: ${records.length}
JSON Array:
${datasetJson}
================================

${historyContext}
Current User Query:
"${question}"

Remember: Return ONLY valid JSON with "text_response" and "highlight_ids".
`.trim();
}

function parseAnalystResponse(rawText: string): AnalystResponse {
  let text_response = '';
  let highlight_ids: string[] = [];
  const trimmed = rawText.trim();

  // Try direct parse
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj.text_response === 'string') {
      text_response = obj.text_response;
      highlight_ids = Array.isArray(obj.highlight_ids) ? obj.highlight_ids.map(String) : [];
    } else if (obj && typeof obj.answer === 'string') {
      text_response = obj.answer;
      highlight_ids = Array.isArray(obj.highlight_ids) ? obj.highlight_ids.map(String) : [];
    }
  } catch {}

  // Try extracting from markdown ```json ... ```
  if (!text_response) {
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[1]);
        if (obj && typeof obj.text_response === 'string') {
          text_response = obj.text_response;
          highlight_ids = Array.isArray(obj.highlight_ids) ? obj.highlight_ids.map(String) : [];
        } else if (obj && typeof obj.answer === 'string') {
          text_response = obj.answer;
          highlight_ids = Array.isArray(obj.highlight_ids) ? obj.highlight_ids.map(String) : [];
        }
      } catch {}
    }
  }

  // Try locating curly brackets { ... }
  if (!text_response) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        const slice = trimmed.substring(firstBrace, lastBrace + 1);
        const obj = JSON.parse(slice);
        if (obj && typeof obj.text_response === 'string') {
          text_response = obj.text_response;
          highlight_ids = Array.isArray(obj.highlight_ids) ? obj.highlight_ids.map(String) : [];
        } else if (obj && typeof obj.answer === 'string') {
          text_response = obj.answer;
          highlight_ids = Array.isArray(obj.highlight_ids) ? obj.highlight_ids.map(String) : [];
        }
      } catch {}
    }
  }

  // Resilient regex and marker unwrap if text_response still looks like a JSON wrapper or was unclosed
  if (
    !text_response ||
    text_response.includes('"text_response"') ||
    text_response.includes('"answer"') ||
    text_response.trim().startsWith('{')
  ) {
    const target = (text_response || trimmed).trim();
    const markerMatch = target.match(/"(?:text_response|answer)"\s*:\s*"/);
    if (markerMatch && markerMatch.index !== undefined) {
      const startIndex = markerMatch.index + markerMatch[0].length;
      let extracted = target.slice(startIndex);
      const endMatch = extracted.match(/"(?:\s*,\s*"highlight_ids"|\s*\}|\s*$)/);
      if (endMatch && endMatch.index !== undefined) {
        extracted = extracted.slice(0, endMatch.index);
      } else if (extracted.endsWith('"}') || extracted.endsWith('"\n}')) {
        extracted = extracted.replace(/"\s*\}\s*$/, '');
      } else if (extracted.endsWith('"')) {
        extracted = extracted.slice(0, -1);
      }
      text_response = extracted;
    } else if (target.startsWith('{') && target.endsWith('}')) {
      text_response = target.slice(1, -1).trim();
    }
  }

  // Fallback: raw text without structured JSON
  if (!text_response) {
    text_response = trimmed;
  }

  // Final unescape pass for literal \n sequences if present
  if (text_response.includes('\\n')) {
    text_response = text_response.replace(/\\n/g, '\n');
  }
  if (text_response.includes('\\"')) {
    text_response = text_response.replace(/\\"/g, '"');
  }
  if (text_response.includes('\\r')) {
    text_response = text_response.replace(/\\r/g, '');
  }

  // Automatic Task ID extraction if highlight_ids is empty
  if (highlight_ids.length === 0 && text_response) {
    const matched = text_response.match(/\b(?:TASK|PRJ)-\d{3,4}\b/gi);
    if (matched) {
      highlight_ids = Array.from(new Set(matched.map((m) => m.toUpperCase())));
    }
  }

  return {
    text_response,
    highlight_ids,
  };
}

/**
 * Generates a deterministic, database-grounded response when the AI provider is unavailable
 * or offline, fulfilling strict reliability requirements (Test Case 12).
 */
export function generateDeterministicFallbackResponse(
  question: string,
  records: ProjectTask[]
): AnalystResponse {
  if (!records || records.length === 0) {
    return {
      text_response:
        'No project records are available in the current dataset. Please upload a dataset or configure project data to perform analysis.',
      highlight_ids: [],
    };
  }

  const facts = extractDeterministicFacts(question, records);
  const { summary, varianceAnalysis, relevantTasks, contextFacts } = facts;
  const qLower = question.toLowerCase();

  let text = '';
  let highlightIds = relevantTasks.map((t) => t.Task_ID).filter(Boolean);

  // Dedicated Budget Variance & Over-Budget Analysis (Priority 2)
  if (
    qLower.includes('variance') ||
    qLower.includes('over budget') ||
    qLower.includes('overrun') ||
    qLower.includes('exceed') ||
    qLower.includes('exceeding')
  ) {
    const { portfolio, overBudgetProjects, overBudgetTasks } = varianceAnalysis;
    text =
      `### Executive Budget Variance Analysis\n\n` +
      `- **Total Portfolio Budget:** $${portfolio.totalBudget.toLocaleString()}\n` +
      `- **Total Actual Spend:** $${portfolio.totalSpend.toLocaleString()}\n` +
      `- **Net Portfolio Variance:** $${Math.abs(portfolio.netVariance).toLocaleString()} **${portfolio.isUnderBudget ? 'Under Budget (Surplus)' : 'Over Budget (Overrun)'}**\n` +
      `- **Scope:** ${records.length} tasks across ${summary.projects.length} projects.\n\n` +
      `> **Key Financial Rule:** An overall portfolio surplus does not prove that every individual project is under budget. ` +
      (overBudgetProjects.length > 0
        ? `While the overall portfolio maintains a **$${Math.abs(portfolio.netVariance).toLocaleString()}** net surplus, **${overBudgetProjects.length} project(s)** and **${overBudgetTasks.length} task(s)** are currently exceeding their allocations.\n\n`
        : `All project initiatives are currently operating within their allocated budgets.\n\n`);

    if (overBudgetProjects.length > 0) {
      text +=
        `#### Projects Exceeding Budget (${overBudgetProjects.length})\n\n` +
        `| Project Name | Allocated Budget | Actual Spend | Overrun Amount | % Over Budget |\n` +
        `|---|---|---|---|---|\n` +
        overBudgetProjects
          .map(
            (p) =>
              `| **${p.project}** | $${p.budget.toLocaleString()} | $${p.spend.toLocaleString()} | +$${p.overAmount.toLocaleString()} | **+${p.overPercentage}%** |`
          )
          .join('\n') +
        `\n\n`;
    } else {
      text += `*No individual projects exceed their allocated budget at the aggregate project level.*\n\n`;
    }

    if (overBudgetTasks.length > 0) {
      text +=
        `#### Tasks Exceeding Budget (${overBudgetTasks.length} Total Overruns)\n\n` +
        `| Task ID | Project | Task Title | Allocated | Actual Spend | Overrun | % Over |\n` +
        `|---|---|---|---|---|---|---|\n` +
        overBudgetTasks
          .slice(0, 10)
          .map(
            (t) =>
              `| \`${t.taskId}\` | ${t.project} | ${t.title} | $${t.budget.toLocaleString()} | $${t.spend.toLocaleString()} | +$${t.overAmount.toLocaleString()} | ${t.overPercentage !== null ? `+${t.overPercentage}%` : 'N/A'} |`
          )
          .join('\n') +
        `\n\n`;
    }
  } else if (qLower.includes('data quality') || qLower.includes('compliance') || qLower.includes('missing data')) {
    const quality = auditDataQuality(records);
    text =
      `### Data Quality & Integrity Audit\n\n` +
      `- **Total Records Evaluated:** ${quality.totalRecordsChecked}\n` +
      `- **Clean Records:** ${quality.cleanRecordsCount} (**${quality.complianceRatePercent}% compliance rate**)\n` +
      `- **Missing / Invalid Dates:** ${quality.missingDatesCount}\n` +
      `- **Invalid Progress Values:** ${quality.invalidProgressCount}\n` +
      `- **Missing Budget Records:** ${quality.missingBudgetCount}\n` +
      `- **Status / Progress Inconsistencies:** ${quality.inconsistentStatusProgressCount}\n` +
      `- **Invalid Financials (Negative values):** ${quality.invalidFinancialsCount}\n\n` +
      `*No records have been silently replaced with fabricated values.*`;
  } else if (qLower.includes('budget') && !qLower.includes('over')) {
    text =
      `### Budget Analysis\n\n` +
      `- **Total Allocated Budget:** $${summary.totalBudget.toLocaleString()}\n` +
      `- **Total Actual Spend:** $${summary.totalSpend.toLocaleString()}\n` +
      `- **Net Budget Variance:** $${(summary.totalBudget - summary.totalSpend).toLocaleString()} (${summary.totalBudget >= summary.totalSpend ? 'Under Budget' : 'Overrun'})\n` +
      `- **Dataset Scope:** ${records.length} tasks across ${summary.projects.length} projects and ${summary.departments.length} departments.`;
  } else if (qLower.includes('progress') || qLower.includes('average progress')) {
    text =
      `### Progress Summary\n\n` +
      `- **Unweighted Average Progress:** ${summary.avgProgress}%\n` +
      `- **Total Tasks Evaluated:** ${records.length}\n` +
      `- **Completed Tasks:** ${summary.completedCount}\n` +
      `- **In Progress Tasks:** ${summary.inProgressCount}\n` +
      `- **Blocked Tasks:** ${summary.blockedCount}`;
  } else if (qLower.includes('block') || qLower.includes('delay') || qLower.includes('risk')) {
    text =
      `### Blocked & Critical Risk Tasks\n\n` +
      `- **Blocked Tasks Count:** ${summary.blockedCount}\n` +
      `- **Critical Risk Tasks:** ${summary.criticalRiskCount}\n\n` +
      (relevantTasks.length > 0
        ? `| Task ID | Project | Title | Status | Risk |\n|---|---|---|---|---|\n` +
          relevantTasks
            .slice(0, 10)
            .map(
              (t) =>
                `| ${t.Task_ID} | ${t.Project_Name} | ${t.Task_Title} | ${t.Status} | ${t.Risk_Level} |`
            )
            .join('\n')
        : 'No tasks currently identified as blocked.');
  } else if (qLower.includes('how many') || qLower.includes('count') || qLower.includes('task')) {
    text =
      `### Task Distribution Overview\n\n` +
      `- **Total Tasks:** ${records.length}\n` +
      `- **In Progress:** ${summary.inProgressCount}\n` +
      `- **Completed:** ${summary.completedCount}\n` +
      `- **Blocked:** ${summary.blockedCount}\n` +
      `- **Total Allocated Budget:** $${summary.totalBudget.toLocaleString()}\n` +
      `- **Total Actual Spend:** $${summary.totalSpend.toLocaleString()}`;
  } else {
    text =
      `### Portfolio Overview\n\n` +
      `- **Total Tasks:** ${records.length}\n` +
      `- **Total Budget:** $${summary.totalBudget.toLocaleString()}\n` +
      `- **Total Spend:** $${summary.totalSpend.toLocaleString()}\n` +
      `- **Average Progress:** ${summary.avgProgress}%\n` +
      `- **Blocked Tasks:** ${summary.blockedCount}\n\n` +
      `**Verified Facts:**\n` +
      contextFacts.map((f) => `- ${f}`).join('\n');
  }

  text += `\n\n*(Note: Explanatory AI service is currently operating in deterministic verification mode using authoritative database records.)*`;

  if (highlightIds.length > 20) {
    highlightIds = highlightIds.slice(0, 20);
  }

  return {
    text_response: text,
    highlight_ids: highlightIds,
  };
}

/**
 * Calls the Gemini API with the bundled prompt and deterministic facts
 */
export async function queryGeminiDataAnalyst({
  question,
  records,
  apiKey,
  conversationHistory = [],
  modelName = 'gemini-3.5-flash',
}: {
  question: string;
  records: ProjectTask[];
  apiKey?: string;
  conversationHistory?: ChatMessage[];
  modelName?: string;
}): Promise<AnalystResponse> {
  // 1. Handle empty dataset explicitly (Test Case 6)
  if (!records || records.length === 0) {
    return {
      text_response:
        'No project records are available in the current dataset. Please upload a dataset or configure project data to perform analysis.',
      highlight_ids: [],
    };
  }

  const activeKey =
    apiKey?.trim() ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!activeKey) {
    // If API key is not configured, gracefully return verified deterministic analysis
    console.warn('Gemini API key not found. Providing deterministic factual analysis.');
    return generateDeterministicFallbackResponse(question, records);
  }

  const bundledPrompt = buildBundledPrompt(question, records, conversationHistory);
  const systemInstruction = getSystemInstruction();

  // Primary model candidates in verified priority
  const candidateModels = [
    modelName,
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i) as string[];

  let lastError: Error | null = null;

  for (const modelId of candidateModels) {
    try {
      const genAI = new GoogleGenerativeAI(activeKey);
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      });

      const result = await model.generateContent(bundledPrompt);
      const response = await result.response;
      const text = response.text();

      if (text) {
        return parseAnalystResponse(text);
      }
    } catch (err: any) {
      console.warn(`Gemini model ${modelId} error:`, err?.message || err);
      lastError = err;
      if (
        err?.message?.includes('API_KEY_INVALID') ||
        err?.message?.includes('403') ||
        err?.message?.includes('429') ||
        err?.message?.includes('Quota') ||
        err?.message?.includes('503') ||
        err?.message?.includes('Service Unavailable')
      ) {
        // Immediately fall back to deterministic calculation with disclaimer
        return generateDeterministicFallbackResponse(question, records);
      }
    }
  }

  // Direct REST API fallback
  try {
    const directModel = modelName || 'gemini-3.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${directModel}:generateContent?key=${activeKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            parts: [{ text: bundledPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return parseAnalystResponse(candidateText);
      }
    }
  } catch (directErr: any) {
    console.error('Direct Gemini REST fallback error:', directErr);
  }

  // Gracefully handle AI-provider failure using deterministic analytical facts (Test Case 12)
  console.warn('AI models unavailable; falling back to deterministic calculation.');
  return generateDeterministicFallbackResponse(question, records);
}
