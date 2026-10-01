'use client';

import React from 'react';
import { Sparkles, AlertOctagon, TrendingUp, Users, DollarSign, FileSpreadsheet } from 'lucide-react';

interface QuickSuggestionsProps {
  onSelectQuery: (query: string) => void;
  disabled?: boolean;
}

const PRESET_QUERIES = [
  {
    icon: <AlertOctagon size={13} color="#FB7185" />,
    label: 'Blocked Tasks & Blockers',
    query: 'Identify all blocked tasks in the dataset, their owners, and detail the exact blocker reasons preventing progress.',
  },
  {
    icon: <DollarSign size={13} color="#34D399" />,
    label: 'Budget Variance Analysis',
    query: 'Analyze the budget variance across all projects. Which tasks or projects are exceeding their allocated budget, and by how much?',
  },
  {
    icon: <TrendingUp size={13} color="#38BDF8" />,
    label: 'Department Progress & Status',
    query: 'Calculate the average progress percentage and task completion breakdown grouped by department.',
  },
  {
    icon: <Users size={13} color="#C084FC" />,
    label: 'Owner Workload Distribution',
    query: 'List all project owners, the number of tasks assigned to each, their active statuses, and identify who has the heaviest critical-priority workload.',
  },
  {
    icon: <FileSpreadsheet size={13} color="#FBBF24" />,
    label: 'Executive Project Summary',
    query: 'Provide an executive summary of overall project health based strictly on this dataset, highlighting critical risks, overall spend vs budget, and upcoming deadlines.',
  },
];

export const QuickSuggestions: React.FC<QuickSuggestionsProps> = ({
  onSelectQuery,
  disabled,
}) => {
  return (
    <div className="suggestions-bar">
      <div className="suggestions-title">
        <Sparkles size={12} color="#818CF8" />
        <span>Suggested Data Analyst Prompts</span>
      </div>
      <div className="chips-row">
        {PRESET_QUERIES.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className="chip-btn"
            disabled={disabled}
            onClick={() => onSelectQuery(item.query)}
            title={item.query}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
