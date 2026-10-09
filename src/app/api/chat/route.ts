import { NextRequest, NextResponse } from 'next/server';
import { ProjectTask } from '@/lib/dataset';
import { getAllTasksFromDB } from '@/lib/db';
import { queryGeminiDataAnalyst } from '@/lib/gemini';
import { analyzeBudgetVariance, calculateDatasetSummary } from '@/lib/analytics';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { query, dataset: clientDataset, history = [], model } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'A query question is required.' },
        { status: 400 }
      );
    }

    const clientApiKey =
      req.headers.get('x-gemini-api-key') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    // 1. Check for dynamic dataset from client state; otherwise retrieve from persistent database
    let records: ProjectTask[] = [];
    let sourceFileName = 'Database-Backed Portfolio (SQLite)';

    if (Array.isArray(clientDataset)) {
      records = clientDataset;
      sourceFileName = 'Client State Dataset';

      if (records.length === 0) {
        return NextResponse.json({
          success: true,
          answer:
            'No project records are available in the current dataset. Please upload a dataset or adjust your filter selection to begin analysis.',
          text_response:
            'No project records are available in the current dataset. Please upload a dataset or adjust your filter selection to begin analysis.',
          data: {
            metric: 'empty_dataset',
            allocated_budget: 0,
            actual_spend: 0,
            variance: 0,
          },
          highlight_ids: [],
          meta: {
            sourceFileName: 'Empty Dataset',
            recordCount: 0,
            timestamp: new Date().toISOString(),
          },
        });
      }
    } else {
      records = getAllTasksFromDB();
      sourceFileName = 'Database (pm_insight_engine.db)';
    }

    if (!records || records.length === 0) {
      return NextResponse.json({
        success: true,
        answer:
          'No project records are available in the current dataset. Please upload a dataset or ensure the project file is available.',
        text_response:
          'No project records are available in the current dataset. Please upload a dataset or ensure the project file is available.',
        data: {
          metric: 'empty_dataset',
          allocated_budget: 0,
          actual_spend: 0,
          variance: 0,
        },
        highlight_ids: [],
        meta: {
          sourceFileName,
          recordCount: 0,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 2. Compute verified deterministic figures
    const summary = calculateDatasetSummary(records);
    const varianceAnalysis = analyzeBudgetVariance(records);

    // 3. Query Gemini Data Analyst with strict anti-hallucination guardrails and structured highlighting
    const result = await queryGeminiDataAnalyst({
      question: query.trim(),
      records,
      apiKey: clientApiKey || undefined,
      conversationHistory: history,
      modelName: model,
    });

    // Clean answer guaranteeing no raw JSON wrappers
    const cleanAnswer = result.text_response;

    return NextResponse.json({
      success: true,
      answer: cleanAnswer,
      text_response: cleanAnswer,
      data: {
        metric: 'budget_variance',
        allocated_budget: summary.totalBudget,
        actual_spend: summary.totalSpend,
        variance: varianceAnalysis.portfolio.netVariance,
        over_budget_projects: varianceAnalysis.overBudgetProjects.length,
        over_budget_tasks: varianceAnalysis.overBudgetTasks.length,
        average_progress: summary.avgProgress,
      },
      highlight_ids: result.highlight_ids || [],
      meta: {
        sourceFileName,
        recordCount: records.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('API /api/chat error:', error);
    const isMissingKey =
      error?.message?.includes('MISSING_API_KEY') ||
      error?.message?.includes('Invalid Gemini API Key');

    return NextResponse.json(
      {
        error: error?.message || 'Internal server error processing analysis query.',
        code: isMissingKey ? 'AUTH_REQUIRED' : 'ANALYSIS_ERROR',
      },
      { status: isMissingKey ? 401 : 500 }
    );
  }
}
