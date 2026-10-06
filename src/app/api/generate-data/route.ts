import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectTask } from '@/lib/dataset';

// Realistic randomized fallback generator
function generateProceduralMockData(): ProjectTask[] {
  const projects = [
    'Cloud Migration Platform',
    'AI Analytics Pipeline',
    'CyberSec Zero-Trust Guard',
    'Mobile Payment Engine',
    'Customer Experience 360',
    'Global Data Mesh',
  ];

  const owners = [
    { name: 'Sarah Connor', dept: 'Backend Architecture' },
    { name: 'Alex Rivera', dept: 'Frontend Engineering' },
    { name: 'David Kim', dept: 'Backend Architecture' },
    { name: 'Priya Sharma', dept: 'Data Science' },
    { name: 'Marcus Brody', dept: 'DevSecOps' },
    { name: 'Elena Rostova', dept: 'Quality Assurance' },
    { name: 'Liam O\'Connor', dept: 'Product & Design' },
  ];

  const taskTemplates = [
    'Zero-Downtime Database Migration to PostgreSQL 16',
    'OAuth2 & OpenID Connect Single Sign-On Gateway',
    'Real-time Fraud Detection ML Model Fine-Tuning',
    'Kubernetes Cluster Multi-Region Failover Architecture',
    'Automated End-to-End Cypress & Playwright Test Suite',
    'Next.js 15 App Router Frontend Optimization',
    'PCI DSS v4.0 Security Audit & Key Vault Rotation',
    'FastAPI & ONNX Inference Microservice Pipeline',
    'Redis Distributed Lock & Cache Stampede Shield',
    'Kafka Event Streaming Topology Refactoring',
    'Stripe & Adyen Payment Webhook Idempotency Engine',
    'Role-Based Granular Access Control UI & Auditing',
    'SOC2 Type II Compliance Logging & SIEM Integration',
    'Vector Database Embeddings Pipeline for Search',
    'Cross-Region Read Replica Latency Optimization',
    'GraphQL Schema Federation Gateway Consolidation',
    'Automated Disaster Recovery Drill & Snapshot Sync',
    'Elasticsearch Cluster Shard Rebalancing',
    'CI/CD GitHub Actions Pipeline Parallelization',
    'Synthetic Training Data Generator for Privacy Shield',
    'Multi-Tenant Tenant Isolation & Sharding Layer',
    'Prometheus & Grafana Enterprise Telemetry Exporters',
    'Terraform Infrastructure as Code Cloud Migration',
    'WebRTC Low-Latency Audio/Video Streaming Bridge',
    'Customer Churn Prediction Model v3 Deployment',
    'Billing Invoicing & Tax Calculation Microservice',
    'Network Vulnerability Penetration Testing Suite',
    'Micro-Frontend Architecture Modular Federation',
    'Snowflake Data Warehouse Reverse ETL Integration',
    'Automated Canary Release & Blue-Green Traffic Router',
  ];

  const blockerOptions = [
    'Awaiting security audit sign-off from compliance team',
    'Third-party payment gateway webhook sandbox downtime',
    'GPU node cluster quota exhausted in AWS us-east-1',
    'Database read-replica network partition under investigation',
    'Pending legal approval on cross-border data residency transfer',
    'Pending API key authorization from third-party vendor',
  ];

  const tasks: ProjectTask[] = [];

  for (let i = 0; i < 30; i++) {
    const id = `PRJ-${201 + i}`;
    const ownerObj = owners[i % owners.length];
    const project = projects[i % projects.length];
    const sprint = `Sprint ${24 + (i % 4)}`;

    // Randomize status: ~5 blocked, ~8 completed, ~12 in progress, ~3 review, ~2 planned
    let status = 'In Progress';
    let progress = Math.floor(Math.random() * 60) + 20; // 20 - 80
    let blocker = 'None';
    let risk = 'Low';

    if (i % 6 === 2) {
      status = 'Blocked';
      blocker = blockerOptions[i % blockerOptions.length];
      risk = 'Critical';
      progress = Math.floor(Math.random() * 40) + 15;
    } else if (i % 5 === 0) {
      status = 'Completed';
      progress = 100;
      risk = 'Low';
    } else if (i % 7 === 0) {
      status = 'In Review';
      progress = Math.floor(Math.random() * 15) + 85;
      risk = 'Medium';
    } else if (i % 9 === 0) {
      status = 'Planned';
      progress = Math.floor(Math.random() * 10) + 10;
      risk = 'High';
    } else {
      status = 'In Progress';
      risk = Math.random() > 0.6 ? 'High' : 'Medium';
    }

    const estimatedHours = Math.floor(Math.random() * 90) + 30; // 30 - 120
    const actualHours =
      status === 'Completed'
        ? Math.floor(estimatedHours * (0.85 + Math.random() * 0.35))
        : Math.floor(estimatedHours * (progress / 100) * (0.9 + Math.random() * 0.3));

    // Budget between $10,000 and $80,000
    const budget = Math.floor(Math.random() * 70 + 10) * 1000;
    // Actual spend with realistic variance
    const spendMultiplier =
      status === 'Completed'
        ? 0.9 + Math.random() * 0.25 // occasional overrun
        : (progress / 100) * (0.85 + Math.random() * 0.3);
    const spend = Math.round(budget * spendMultiplier);

    const priorityOptions = ['Critical', 'High', 'Medium', 'Low'];
    const priority =
      status === 'Blocked'
        ? 'Critical'
        : priorityOptions[Math.floor(Math.random() * priorityOptions.length)];

    tasks.push({
      Task_ID: id,
      Project_Name: project,
      Task_Title: taskTemplates[i] || `Technical Implementation Task ${i + 1}`,
      Sprint: sprint,
      Owner: ownerObj.name,
      Department: ownerObj.dept,
      Priority: priority,
      Status: status,
      Progress_Percent: Number(progress),
      Estimated_Hours: Number(estimatedHours),
      Actual_Hours: Number(actualHours),
      Allocated_Budget_USD: Number(budget),
      Actual_Spend_USD: Number(spend),
      Start_Date: `2026-09-${String((i % 25) + 1).padStart(2, '0')}`,
      Due_Date: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
      Risk_Level: risk,
      Blocker_Details: blocker,
    });
  }

  return tasks;
}

export async function POST(req: NextRequest) {
  try {
    const clientApiKey =
      req.headers.get('x-gemini-api-key') ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    const activeKey =
      clientApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!activeKey) {
      // If no key, return high quality procedural mock data
      const mockData = generateProceduralMockData();
      return NextResponse.json({
        success: true,
        data: mockData,
        count: mockData.length,
        source: 'Procedural Realistic Generator (No API Key)',
      });
    }

    const prompt = `
Generate a realistic, randomized JSON array of EXACTLY 30 project management tasks for modern tech engineering initiatives.
Requirements:
- Task_ID: "PRJ-201" to "PRJ-230"
- Project_Name: Mix between "Cloud Migration Platform", "AI Analytics Pipeline", "CyberSec Zero-Trust Guard", "Mobile Payment Engine", "Customer Experience 360", "Global Data Mesh"
- Task_Title: Realistic engineering tasks
- Sprint: "Sprint 24", "Sprint 25", "Sprint 26"
- Owner: Realistic engineer names
- Department: Backend Architecture, Frontend Engineering, DevSecOps, Data Science, Quality Assurance, Product & Design
- Priority: Critical, High, Medium, Low
- Status: Completed, In Progress, Blocked, In Review, Planned (ensure 4-6 are Blocked with blocker reasons)
- Progress_Percent: Integer between 10 and 100
- Estimated_Hours: Integer between 20 and 160
- Actual_Hours: Integer between 15 and 180
- Allocated_Budget_USD: Integer between 10000 and 80000
- Actual_Spend_USD: Integer between 8000 and 95000 (include budget variances with overruns and underruns)
- Start_Date: "2026-09-01" to "2026-09-25"
- Due_Date: "2026-10-01" to "2026-11-15"
- Risk_Level: Critical, High, Medium, Low
- Blocker_Details: If Blocked, describe the exact technical blocker; otherwise "None"

STRICT CONSTRAINT: Return ONLY a valid JSON array of 30 task objects with all numerical values typed as Numbers.
`.trim();

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-3.5-flash',
    ];

    let generatedTasks: ProjectTask[] | null = null;

    for (const modelId of candidateModels) {
      try {
        const genAI = new GoogleGenerativeAI(activeKey);
        const model = genAI.getGenerativeModel({
          model: modelId,
          generationConfig: {
            temperature: 0.7, // Higher temperature for rich diversity and variance
            responseMimeType: 'application/json',
            maxOutputTokens: 5000,
          },
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        if (text) {
          const parsed = JSON.parse(text);
          const array = Array.isArray(parsed) ? parsed : parsed.tasks || parsed.data;
          if (Array.isArray(array) && array.length >= 10) {
            // Strictly cast and sanitize all numbers
            generatedTasks = array.map((t: any, idx: number) => ({
              Task_ID: String(t.Task_ID || `PRJ-${201 + idx}`),
              Project_Name: String(t.Project_Name || 'Cloud Migration Platform'),
              Task_Title: String(t.Task_Title || `Task ${idx + 1}`),
              Sprint: String(t.Sprint || 'Sprint 24'),
              Owner: String(t.Owner || 'Senior Engineer'),
              Department: String(t.Department || 'Engineering'),
              Priority: String(t.Priority || 'Medium'),
              Status: String(t.Status || 'In Progress'),
              Progress_Percent: Number(String(t.Progress_Percent || 0).replace(/[^0-9.-]/g, '')),
              Estimated_Hours: Number(String(t.Estimated_Hours || 40).replace(/[^0-9.-]/g, '')),
              Actual_Hours: Number(String(t.Actual_Hours || 35).replace(/[^0-9.-]/g, '')),
              Allocated_Budget_USD: Number(String(t.Allocated_Budget_USD || 25000).replace(/[^0-9.-]/g, '')),
              Actual_Spend_USD: Number(String(t.Actual_Spend_USD || 22000).replace(/[^0-9.-]/g, '')),
              Start_Date: String(t.Start_Date || '2026-09-01'),
              Due_Date: String(t.Due_Date || '2026-10-15'),
              Risk_Level: String(t.Risk_Level || 'Low'),
              Blocker_Details: String(t.Blocker_Details || 'None'),
            }));
            break;
          }
        }
      } catch (err: any) {
        console.warn(`Model ${modelId} generation error:`, err?.message || err);
      }
    }

    if (!generatedTasks || generatedTasks.length === 0) {
      generatedTasks = generateProceduralMockData();
    }

    return NextResponse.json(
      {
        success: true,
        data: generatedTasks,
        count: generatedTasks.length,
        source: 'Gemini AI Generator',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Connection': 'close',
        },
      }
    );
  } catch (error: any) {
    console.error('API /api/generate-data error:', error);
    // Always provide the fallback mock data so the user never gets an error
    const fallback = generateProceduralMockData();
    return NextResponse.json(
      {
        success: true,
        data: fallback,
        count: fallback.length,
        source: 'Fallback Realistic Generator',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Connection': 'close',
        },
      }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

