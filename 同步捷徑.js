/**
 * 高科校園 (NKUSTCampus) - iOS 捷徑 JavaScript 腳本
 * 
 * 適用對象：高科大學生
 * 執行環境：iPhone Safari 上的「捷徑 (Shortcuts)」動作「在網頁上執行 JavaScript」
 * 支援平台：
 *   1. https://elearning.nkust.edu.tw/moocs/#/home (抓取課程、作業截止、測驗、未讀公告)
 *   2. https://webap.nkust.edu.tw/nkust/ (抓取本學期課表)
 */

(async function() {
  const APP_URL = "https://ijioxc.github.io/nkust-campus-preview/";
  const host = location.hostname;
  let payload = { format: "campus-data", version: 1, exportedAt: new Date().toISOString() };

  // 1. E-Learning 抓取作業與測驗
  if (host.includes("elearning")) {
    try {
      const res = await fetch("/moocs/sys/api/course/user-course-list");
      const d = await res.json();
      const courses = d.data || d.courses || [];
      const events = [];

      for (const c of courses) {
        const cid = c.course_id || c.id;
        const hwRes = await fetch(`/moocs/sys/api/homework/list?course_id=${cid}`).then(r => r.json()).catch(() => ({}));
        (hwRes.data || hwRes.list || []).forEach(hw => {
          if (hw.end_time) {
            events.push({
              id: `hw-${hw.id || hw.homework_id}`,
              course: String(cid),
              courseTitle: c.course_name || c.title,
              kind: "assignment",
              title: hw.title || hw.name,
              date: hw.end_time.slice(0, 10),
              time: hw.end_time.slice(11, 16),
              done: Boolean(hw.is_submitted)
            });
          }
        });

        const examRes = await fetch(`/moocs/sys/api/exam/list?course_id=${cid}`).then(r => r.json()).catch(() => ({}));
        (examRes.data || examRes.list || []).forEach(ex => {
          if (ex.end_time) {
            events.push({
              id: `exam-${ex.id || ex.exam_id}`,
              course: String(cid),
              courseTitle: c.course_name || c.title,
              kind: "exam",
              title: ex.title || ex.name,
              date: ex.end_time.slice(0, 10),
              time: ex.end_time.slice(11, 16),
              done: false
            });
          }
        });
      }

      payload.source = "elearning";
      payload.courses = courses.map(c => ({
        id: String(c.course_id || c.id),
        title: c.course_name || c.title,
        elearning: { materials: c.material_count || 0 }
      }));
      payload.events = events;

      completion(`${APP_URL}#import=${encodeURIComponent(JSON.stringify(payload))}`);
    } catch(e) {
      completion("error: E-Learning 抓取失敗，請確認是否已在 Safari 登入！");
    }
  } 
  // 2. WebAP 抓取課表
  else if (host.includes("webap")) {
    try {
      const doc = window.frames['main'] ? window.frames['main'].document : document;
      const table = doc.querySelector('table[border="1"]') || doc.querySelector('.table') || doc.querySelector('table');
      if (!table) return completion("error: 找不到課表，請先切換至「選課結果查詢／課表」頁面！");

      const coursesMap = {};
      const rows = Array.from(table.querySelectorAll('tr'));
      rows.forEach((tr, rIdx) => {
        Array.from(tr.querySelectorAll('td')).forEach((td, cIdx) => {
          const text = td.innerText.trim();
          if (cIdx >= 1 && cIdx <= 7 && text.length > 3) {
            const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
            const title = lines[0];
            const teacher = lines[1] || "";
            const room = lines[2] || "";

            if (!coursesMap[title]) {
              coursesMap[title] = {
                id: `c-${Object.keys(coursesMap).length + 1}`,
                title: title,
                short: title.slice(0, 2),
                instructors: teacher ? [teacher] : [],
                category: "必修",
                meetings: []
              };
            }
            let m = coursesMap[title].meetings.find(x => x.weekday === cIdx && x.room === room);
            if (!m) {
              m = { weekday: cIdx, periods: [], room: room };
              coursesMap[title].meetings.push(m);
            }
            m.periods.push(String(rIdx));
          }
        });
      });

      payload.source = "webap";
      payload.courses = Object.values(coursesMap);

      completion(`${APP_URL}#import=${encodeURIComponent(JSON.stringify(payload))}`);
    } catch(e) {
      completion("error: WebAP 課表解析失敗！");
    }
  } 
  else {
    completion("error: 請在高科 E-Learning 或 WebAP 網頁中執行此捷徑！");
  }
})();
