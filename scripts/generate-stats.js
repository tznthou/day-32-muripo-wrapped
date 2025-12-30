#!/usr/bin/env node
/**
 * Muripo Wrapped 統計數據生成腳本
 * 使用 cloc 統計所有專案的程式碼行數
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MURIPO_ROOT = join(__dirname, '..', '..');
const PROJECTS_JSON = join(MURIPO_ROOT, 'hq', 'projects.json');
const OUTPUT_FILE = join(__dirname, '..', 'data', 'stats.json');

// 視覺化相關關鍵詞（用於評分）
const VISUALIZATION_TAGS = ['d3', 'd3.js', 'plotly', 'leaflet', 'three-js', 'three.js', 'canvas', 'webgl', 'svg', 'chart'];
const GENERATIVE_ART_TAGS = ['generative-art', 'generative', 'fibonacci', 'procedural'];
const DATA_VIZ_TAGS = ['data-visualization', 'data-viz', 'visualization'];

// 基礎建設項目（固定）
const INFRASTRUCTURE = [
  { name: 'Muripo HQ', desc: '專案月曆網站' },
  { name: 'Scheduled Release', desc: '定時自動發布' },
  { name: 'Auto Blog Builder', desc: '自動化部落格系統' },
  { name: 'Gallery Indexer', desc: '相簿自動索引系統' },
  { name: 'Stargazer Galaxy', desc: '星光銀河圖自動更新' }
];

/**
 * H06: 檢查 cloc 是否安裝
 */
function checkClocInstalled() {
  try {
    execSync('cloc --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * M06: 驗證 projects.json 格式
 */
function validateProjects(projects) {
  if (!Array.isArray(projects)) {
    throw new Error('projects.json 必須是陣列');
  }

  for (const project of projects) {
    if (!project.dayIndex || typeof project.dayIndex !== 'number') {
      throw new Error(`無效專案: 缺少 dayIndex - ${JSON.stringify(project)}`);
    }
    if (!project.name) {
      throw new Error(`無效專案: Day ${project.dayIndex} 缺少 name`);
    }
    if (!project.status) {
      throw new Error(`無效專案: ${project.name} 缺少 status`);
    }
  }
}

/**
 * 執行 cloc 統計單個專案
 */
function clocProject(projectPath) {
  if (!existsSync(projectPath)) {
    return null;
  }

  try {
    const result = execSync(
      `cloc "${projectPath}" --json --exclude-dir=node_modules,dist,build,.git,coverage,__pycache__,.venv,venv`,
      { encoding: 'utf-8', timeout: 30000 }
    );
    return JSON.parse(result);
  } catch (error) {
    console.warn(`  ⚠️  cloc failed for ${projectPath}`);
    return null;
  }
}

/**
 * 計算專案亮點分數
 */
function calculateHighlightScore(project, clocData) {
  let score = 0;
  const tags = project.tags || [];

  // 標籤數量基礎分
  score += tags.length * 2;

  // 視覺化標籤加分
  const hasVisualization = tags.some(t => VISUALIZATION_TAGS.includes(t.toLowerCase()));
  if (hasVisualization) score += 3;

  // 生成藝術標籤加分
  const hasGenerativeArt = tags.some(t => GENERATIVE_ART_TAGS.includes(t.toLowerCase()));
  if (hasGenerativeArt) score += 2;

  // 數據視覺化標籤加分
  const hasDataViz = tags.some(t => DATA_VIZ_TAGS.includes(t.toLowerCase()));
  if (hasDataViz) score += 2;

  // Action 類型加分（通常更複雜）
  if (project.type === 'action') score += 1;

  // 程式碼行數加分（相對於平均值）
  if (clocData && clocData.SUM) {
    const lines = clocData.SUM.code || 0;
    if (lines > 500) score += 2;
    if (lines > 1000) score += 2;
  }

  return score;
}

/**
 * 獲取專案資料夾名稱
 */
function getProjectFolderName(dayIndex) {
  const dirs = readdirSync(MURIPO_ROOT);
  const pattern = new RegExp(`^day-${String(dayIndex).padStart(2, '0')}-`);
  return dirs.find(d => pattern.test(d));
}

/**
 * 主函數
 */
async function main() {
  console.log('🎄 Muripo Wrapped 統計數據生成');
  console.log('='.repeat(50));

  // H06: 檢查 cloc 是否安裝
  if (!checkClocInstalled()) {
    console.error('\n❌ 錯誤: cloc 未安裝\n');
    console.error('請先安裝 cloc:');
    console.error('  macOS:   brew install cloc');
    console.error('  Ubuntu:  sudo apt install cloc');
    console.error('  Windows: choco install cloc\n');
    process.exit(1);
  }

  // M06: 讀取並驗證 projects.json
  let projects;
  try {
    projects = JSON.parse(readFileSync(PROJECTS_JSON, 'utf-8'));
    validateProjects(projects);
  } catch (error) {
    console.error('\n❌ 錯誤: projects.json 格式錯誤');
    console.error(error.message);
    process.exit(1);
  }

  // 過濾已完成的專案（排除 Day 32 本身）
  const completedProjects = projects.filter(p =>
    p.status === 'done' && p.dayIndex !== 32
  );

  console.log(`\n📊 找到 ${completedProjects.length} 個已完成專案\n`);

  // 統計變數
  let totalLines = 0;
  const projectStats = [];
  const typeDistribution = {};
  const tagCounts = {};
  const languageDistribution = {};
  const weeklyProjects = [0, 0, 0, 0, 0]; // Week 1-5

  // 遍歷每個專案
  for (const project of completedProjects) {
    const folderName = getProjectFolderName(project.dayIndex);
    if (!folderName) {
      console.log(`  ⚠️  Day ${project.dayIndex}: 找不到資料夾`);
      continue;
    }

    const projectPath = join(MURIPO_ROOT, folderName);
    console.log(`  📁 Day ${project.dayIndex}: ${folderName}`);

    // 執行 cloc
    const clocData = clocProject(projectPath);
    const lines = clocData?.SUM?.code || 0;
    totalLines += lines;

    // 記錄專案統計
    projectStats.push({
      dayIndex: project.dayIndex,
      name: project.name,
      folderName,
      lines,
      clocData,
      highlightScore: calculateHighlightScore(project, clocData)
    });

    // 統計專案類型
    const type = project.type || 'other';
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;

    // 統計標籤
    for (const tag of (project.tags || [])) {
      const normalizedTag = tag.toLowerCase();
      tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
    }

    // 統計語言分布
    if (clocData) {
      for (const [lang, data] of Object.entries(clocData)) {
        if (lang !== 'header' && lang !== 'SUM' && data.code) {
          languageDistribution[lang] = (languageDistribution[lang] || 0) + data.code;
        }
      }
    }

    // 週次統計（Day 1-7 = Week 1, Day 8-14 = Week 2, ...）
    const weekIndex = Math.min(Math.floor((project.dayIndex - 1) / 7), 4);
    weeklyProjects[weekIndex]++;
  }

  // 計算統計數據
  const avgLinesPerDay = Math.round(totalLines / completedProjects.length);

  // 找出行數最多的專案
  const maxLinesProject = projectStats.reduce((max, p) =>
    p.lines > (max?.lines || 0) ? p : max, null
  );

  // 排序標籤，取 Top 10
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // 排序語言分布
  const sortedLanguages = Object.entries(languageDistribution)
    .sort((a, b) => b[1] - a[1])
    .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});

  // 選出亮點專案（Top 4）
  const highlights = projectStats
    .sort((a, b) => b.highlightScore - a.highlightScore)
    .slice(0, 4)
    .map(p => ({
      dayIndex: p.dayIndex,
      name: p.name,
      lines: p.lines,
      score: p.highlightScore
    }));

  // 組裝最終統計數據
  const stats = {
    generatedAt: new Date().toISOString(),
    totalProjects: completedProjects.length,
    totalLines,
    avgLinesPerDay,
    maxLinesDay: maxLinesProject ? {
      day: maxLinesProject.dayIndex,
      name: maxLinesProject.name,
      lines: maxLinesProject.lines
    } : null,
    typeDistribution,
    topTags,
    languageDistribution: sortedLanguages,
    highlights,
    infrastructure: INFRASTRUCTURE,
    weeklyProgress: weeklyProjects.map((count, i) => ({
      week: i + 1,
      projects: count,
      label: ['工具類', '互動類', '視覺化', '資料科學', '回顧收尾'][i]
    })),
    projectDetails: projectStats.map(p => ({
      dayIndex: p.dayIndex,
      name: p.name,
      lines: p.lines
    }))
  };

  // 輸出結果
  writeFileSync(OUTPUT_FILE, JSON.stringify(stats, null, 2));

  // 顯示摘要
  console.log('\n' + '='.repeat(50));
  console.log('📊 統計摘要');
  console.log('='.repeat(50));
  console.log(`  總專案數: ${stats.totalProjects}`);
  console.log(`  總程式碼行數: ${stats.totalLines.toLocaleString()}`);
  console.log(`  平均每日行數: ${stats.avgLinesPerDay.toLocaleString()}`);
  console.log(`  最多行數專案: Day ${stats.maxLinesDay?.day} ${stats.maxLinesDay?.name} (${stats.maxLinesDay?.lines?.toLocaleString()} 行)`);
  console.log(`\n  專案類型分布:`);
  for (const [type, count] of Object.entries(stats.typeDistribution)) {
    console.log(`    ${type}: ${count}`);
  }
  console.log(`\n  Top 5 技術標籤:`);
  stats.topTags.slice(0, 5).forEach((t, i) => {
    console.log(`    ${i + 1}. ${t.tag} (${t.count} 次)`);
  });
  console.log(`\n  亮點專案:`);
  stats.highlights.forEach(h => {
    console.log(`    Day ${h.dayIndex}: ${h.name} (score: ${h.score})`);
  });
  console.log('\n' + '='.repeat(50));
  console.log(`✅ 統計數據已輸出至: ${OUTPUT_FILE}`);
}

main().catch(console.error);
