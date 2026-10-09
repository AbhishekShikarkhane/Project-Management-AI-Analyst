import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { generatePortfolioData } from '../src/lib/portfolioGenerator';

// Generate exactly 150 tasks from the portfolio generator
const rawTasks = generatePortfolioData(150);

// Format rows cleanly for Excel
const excelRows = rawTasks.map((t) => {
  return {
    'Task ID': t.Task_ID,
    'Project Name': t.Project_Name,
    'Task Title': t.Task_Title,
    'Sprint': t.Sprint,
    'Owner / Project Manager': t.Owner || t.Project_Manager,
    'Department': t.Department,
    'Priority': t.Priority,
    'Status': t.Status,
    'Progress (%)': Number(t.Progress_Percent),
    'Estimated Hours': Number(t.Estimated_Hours),
    'Actual Hours': Number(t.Actual_Hours),
    'Allocated Budget ($)': Number(t.Allocated_Budget_USD),
    'Actual Spend ($)': Number(t.Actual_Spend_USD),
    'Variance ($)': Number(t.Actual_Spend_USD) - Number(t.Allocated_Budget_USD),
    'Start Date': t.Start_Date,
    'Due Date': t.Due_Date,
    'Risk Level': t.Risk_Level,
    'Team Members': Number(t.Number_of_Team_Members ?? t.Team_Members_Count ?? 1),
    'Blocker Details': t.Blocker_Details || 'None',
  };
});

// Target directory
const dataSetDir = path.join(process.cwd(), 'Data set');
if (!fs.existsSync(dataSetDir)) {
  fs.mkdirSync(dataSetDir, { recursive: true });
}

// 1. Create native Excel Workbook (.xlsx)
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(excelRows);

// Auto-size columns for a professional Excel layout
const colKeys = Object.keys(excelRows[0]);
const colWidths = colKeys.map((key) => {
  let maxLen = key.length;
  for (const row of excelRows) {
    const val = String((row as any)[key] ?? '');
    if (val.length > maxLen) {
      maxLen = val.length;
    }
  }
  return { wch: Math.min(Math.max(maxLen + 2, 12), 45) };
});
ws['!cols'] = colWidths;

XLSX.utils.book_append_sheet(wb, ws, '150-Project Portfolio');

const xlsxFilePath = path.join(dataSetDir, '150-Project Portfolio (150 tasks).xlsx');
XLSX.writeFile(wb, xlsxFilePath);
console.log(`[SUCCESS] Excel workbook (.xlsx) written: ${xlsxFilePath}`);

// 2. Also create an Excel-compatible CSV copy
const csvContent = XLSX.utils.sheet_to_csv(ws);
const csvFilePath = path.join(dataSetDir, '150-Project Portfolio (150 tasks).csv');
fs.writeFileSync(csvFilePath, csvContent, 'utf-8');
console.log(`[SUCCESS] Excel CSV (.csv) written: ${csvFilePath}`);

console.log(`Exported ${excelRows.length} rows successfully.`);
