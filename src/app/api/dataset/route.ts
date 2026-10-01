import { NextResponse } from 'next/server';
import { getProjectManagementDataset } from '@/lib/dataset';

export async function GET() {
  try {
    const datasetInfo = getProjectManagementDataset();
    return NextResponse.json({
      success: true,
      data: {
        fileName: datasetInfo.fileName,
        filePath: datasetInfo.filePath,
        recordCount: datasetInfo.recordCount,
        columns: datasetInfo.columns,
        fileSizeBytes: datasetInfo.fileSizeBytes,
        summary: datasetInfo.summary,
        previewRecords: datasetInfo.records.slice(0, 100),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load dataset information.' },
      { status: 500 }
    );
  }
}
