import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectTask } from './dataset';
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
 * Builds the bundled prompt combining strict analyst directives, the JSON dataset, and user conversation
 */
function buildBundledPrompt(
  question: string,
  records: ProjectTask[],
  conversationHistory: ChatMessage[] = []
): string {
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

  return `
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
        }
      } catch {}
    }
  }

  // Fallback: raw text without structured JSON
  if (!text_response) {
    text_response = trimmed;
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
 * Calls the Gemini API with the bundled prompt
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
  const activeKey =
    apiKey?.trim() ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!activeKey) {
    throw new Error(
      'MISSING_API_KEY: Gemini API Key is required. Please set GEMINI_API_KEY in .env.local or enter your key in the UI settings.'
    );
  }

  const bundledPrompt = buildBundledPrompt(question, records, conversationHistory);
  const systemInstruction = getSystemInstruction();

  // Primary model candidates in verified priority including latest preview models
  const candidateModels = [
    modelName,
    'gemini-3.1-pro-preview',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite-preview',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-pro-latest',
    'gemini-3.7-flash',
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
          maxOutputTokens: 3000,
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
      if (err?.message?.includes('API_KEY_INVALID') || err?.message?.includes('403')) {
        throw new Error('Invalid Gemini API Key. Please verify your API key in settings.');
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
          maxOutputTokens: 3000,
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

  throw new Error(
    lastError?.message ||
      'Failed to generate response from Gemini API. Please check your API key and network connection.'
  );
}
