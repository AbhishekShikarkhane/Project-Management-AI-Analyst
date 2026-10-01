const fs = require('fs');
const path = require('path');

const csvData = [
  'Task_ID,Project_Name,Task_Title,Sprint,Owner,Department,Priority,Status,Progress_Percent,Estimated_Hours,Actual_Hours,Allocated_Budget_USD,Actual_Spend_USD,Start_Date,Due_Date,Risk_Level,Blocker_Details',
  'PRJ-101,Nexus Cloud Core,Microservices Architecture Refactoring,Sprint 21,Sarah Connor,Backend Architecture,Critical,Completed,100,120,115,25000,24200,2026-08-01,2026-08-25,Low,None',
  'PRJ-102,Nexus Cloud Core,Distributed Caching & Redis Cluster,Sprint 22,David Kim,Backend Architecture,High,In Progress,75,90,82,18000,16500,2026-08-26,2026-09-30,Medium,Minor cache stampede during stress testing',
  'PRJ-103,Nexus Cloud Core,Zero-Downtime Database Migration,Sprint 22,Sarah Connor,Backend Architecture,Critical,Blocked,45,140,90,32000,28000,2026-09-01,2026-10-10,Critical,Awaiting read-replica sync authorization from Infosec',
  'PRJ-104,FinTech Payment Hub,PCI DSS v4.0 Compliance Audit,Sprint 20,Marcus Brody,DevSecOps,Critical,Completed,100,80,78,22000,21500,2026-08-05,2026-08-30,Low,None',
  'PRJ-105,FinTech Payment Hub,Stripe & Adyen Multi-Gateway Router,Sprint 21,Alex Rivera,Frontend Engineering,High,In Progress,60,110,85,24000,20500,2026-09-05,2026-10-15,Medium,Webhook retry mechanism edge cases under review',
  'PRJ-106,FinTech Payment Hub,Fraud Detection Threshold Tuning,Sprint 22,Priya Sharma,Data Science,Critical,In Progress,85,100,92,28000,26000,2026-08-15,2026-09-28,High,False positive rate spike on high-velocity transactions',
  'PRJ-107,AI Predictive Engine,Customer Churn Prediction Model v2,Sprint 21,Priya Sharma,Data Science,High,Completed,100,150,140,35000,33500,2026-07-20,2026-08-31,Low,None',
  'PRJ-108,AI Predictive Engine,Real-Time Inference Pipeline (FastAPI/ONNX),Sprint 22,David Kim,Data Science,Critical,In Progress,50,130,80,30000,22000,2026-09-10,2026-10-20,High,GPU node latency variance in staging environment',
  'PRJ-109,AI Predictive Engine,Automated Feature Store Ingestion,Sprint 22,Priya Sharma,Data Science,Medium,In Review,90,70,68,16000,15200,2026-09-01,2026-09-25,Low,Pending code review approval from team lead',
  'PRJ-110,CyberSec Zero-Trust,Identity Federation & SAML SSO,Sprint 21,Marcus Brody,DevSecOps,Critical,Completed,100,95,90,26000,25000,2026-08-10,2026-09-05,Low,None',
  'PRJ-111,CyberSec Zero-Trust,Automated Vulnerability Scanner CI/CD,Sprint 22,Marcus Brody,DevSecOps,High,In Progress,70,85,60,19000,14500,2026-09-05,2026-10-05,Medium,Rate limiting on third-party security vulnerability DB',
  'PRJ-112,CyberSec Zero-Trust,mTLS Service-to-Service Encryption,Sprint 23,Sarah Connor,Backend Architecture,Critical,Planned,0,110,0,27000,0,2026-10-01,2026-11-15,High,Prerequisite PRJ-103 migration must finish first',
  'PRJ-113,FinTech Payment Hub,Automated Reconciliation Reporting,Sprint 22,Alex Rivera,Quality Assurance,Medium,In Progress,80,65,55,14000,12000,2026-09-08,2026-10-02,Low,None',
  'PRJ-114,Nexus Cloud Core,Multi-Region Failover Drills,Sprint 23,David Kim,DevSecOps,Critical,Planned,10,120,15,30000,4000,2026-10-05,2026-11-20,High,Simulated network partition test cases required',
  'PRJ-115,Customer Portal Overhaul,Next.js 15 Migration & Design System,Sprint 21,Alex Rivera,Frontend Engineering,High,Completed,100,130,125,29000,28500,2026-08-01,2026-09-12,Low,None',
  'PRJ-116,Customer Portal Overhaul,Real-Time Project Health Dashboard,Sprint 22,Alex Rivera,Frontend Engineering,High,In Progress,65,95,70,21000,16800,2026-09-12,2026-10-18,Medium,WebSocket reconnection telemetry stabilization',
  'PRJ-117,Customer Portal Overhaul,Role-Based Access Control UI,Sprint 22,Sarah Connor,Frontend Engineering,Medium,In Review,95,60,58,15000,14200,2026-09-10,2026-09-29,Low,Final UX sign-off pending from Product Manager',
  'PRJ-118,AI Predictive Engine,Synthetic Data Generator for Privacy Compliance,Sprint 23,Priya Sharma,Data Science,High,Planned,0,90,0,22000,0,2026-10-10,2026-11-25,Medium,Awaiting legal guidelines on differential privacy epsilon values'
].join('\n');

const baseDir = path.resolve(__dirname, '..');

// 1. Write 'Project Management'
const filePathNormal = path.join(baseDir, 'Project Management');
fs.writeFileSync(filePathNormal, csvData, 'utf8');
console.log('Successfully wrote:', filePathNormal);

// 2. Write with trailing space via extended NT path syntax
try {
  const filePathWithSpace = '\\\\?\\' + path.join(baseDir, 'Project Management ');
  fs.writeFileSync(filePathWithSpace, csvData, 'utf8');
  console.log('Successfully wrote extended space file:', filePathWithSpace);
} catch (err) {
  console.log('Extended write notice:', err.message);
}
