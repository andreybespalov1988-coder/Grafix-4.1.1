'use strict';
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
function must(rx,msg){if(!rx.test(html))throw new Error(msg);}
must(/@page\{size:A4 landscape;margin:0\}/,'A4 landscape @page rule missing');
must(/function buildA4ReportHtml\(lessons,type,value\)/,'A4 report builder missing');
must(/function buildA4DayPage\(lessons,day\)/,'A4 day layout missing');
must(/function buildA4WeekPage\(lessons,type,value\)/,'A4 week layout missing');
must(/function downloadSelectedReportA4PDF\(\)/,'A4 PDF action missing');
must(/onclick="printSelectedReportA4\(\)"/,'A4 print action not wired');
must(/onclick="downloadSelectedReportA4PDF\(\)"/,'A4 PDF action not wired');
must(/a4-report-grid/,'A4 grid CSS missing');
must(/day-layout\$\{density\}/,'Day A4 layout builder missing');
must(/week-layout\$\{density\}/,'Week/teacher A4 layout builder missing');
must(/printToPDF\(\{title:'Сохранить A4 в PDF'/,'A4 PDF uses native Electron export');
// Verify both supplied reference-like structures are represented: time column + resource/day headers.
must(/class="a4-time"/,'A4 time column missing');
must(/class="a4-room-head"/,'A4 resource header missing');
must(/class="a4-week-head"/,'A4 weekday header missing');
console.log('A4 print static checks passed.');
