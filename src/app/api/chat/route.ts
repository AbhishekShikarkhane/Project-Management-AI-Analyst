import { NextRequest, NextResponse } from 'next/server';
import { getProjectManagementDataset, ProjectTask } from '@/lib/dataset';
import { queryGeminiDataAnalyst } from '@/lib/gemini';

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

    // 1. Check for dynamic dataset from client state; otherwise fall back to local file
    let records: ProjectTask[] = [];
    let sourceFileName = 'Dynamic Upload';

    if (Array.isArray(clientDataset) && clientDataset.length > 0) {
      records = clientDataset;
      sourceFileName = 'Client State Dataset';
    } else {
      const defaultInfo = getProjectManagementDataset();
      records = defaultInfo.records;
      sourceFileName = defaultInfo.fileName;
    }

    if (!records || records.length === 0) {
      return NextResponse.json(
        {
          error:
            'No records available for analysis. Please upload a dataset or ensure the local "Project Management " file exists.',
        },
        { status: 400 }
      );
    }

    // 2. Query Gemini Data Analyst with strict anti-hallucination guardrails and structured highlighting
    const result = await queryGeminiDataAnalyst({
      question: query.trim(),
      records,
      apiKey: clientApiKey || undefined,
      conversationHistory: history,
      modelName: model,
    });

    return NextResponse.json({
      success: true,
      text_response: result.text_response,
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
