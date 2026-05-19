import { useState, useEffect } from "react";

function uid() { return Math.random().toString(36).slice(2, 9); }

function getKSTToday() {
  const kst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth()+1).padStart(2,"0")}-${String(kst.getUTCDate()).padStart(2,"0")}`;
}

function getStripDates(center) {
  return Array.from({length:14},(_,i)=>{
    const d = new Date(center+"T00:00:00+09:00");
    d.setDate(d.getDate()+i-3);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });
}

function formatDateFull(ds) {
  const d = new Date(ds+"T00:00:00+09:00");
  const days=["일","월","화","수","목","금","토"];
  const months=["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  return `${d.getFullYear()}년 ${months[d.getMonth()]} ${d.getDate()}일 ${days[d.getDay()]}요일`;
}

function formatDateShort(ds) {
  const d = new Date(ds+"T00:00:00+09:00");
  const days=["일","월","화","수","목","금","토"];
  const m = d.getMonth()+1;
  return `${m}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function parseDateInfo(ds) {
  const d = new Date(ds+"T00:00:00+09:00");
  const days=["일","월","화","수","목","금","토"];
  return { day:days[d.getDay()], num:d.getDate(), dow:d.getDay() };
}

function formatDue(ds, selDate) {
  if (!ds) return null;
  const today = getKSTToday();
  if (ds < today) return { label: "기한 지남", urgent: true };
  if (ds === today) return { label: "오늘까지", urgent: true };
  const diff = Math.round((new Date(ds+"T00:00:00+09:00") - new Date(today+"T00:00:00+09:00")) / 86400000);
  if (diff === 1) return { label: "내일까지", urgent: false };
  return { label: `${diff}일 후`, urgent: false };
}

function formatRepeat(repeat) {
  if (!repeat || repeat === "none") return null;
  const map = { daily:"매일", weekdays:"평일마다", weekly:"매주", biweekly:"격주", monthly:"매월" };
  return map[repeat] || null;
}

// 반복 태스크가 특정 날짜에 표시되어야 하는지 판단
function shouldShowRepeat(task, date) {
  if (!task.repeat || task.repeat === "none") return false;
  if (!task.startDate) return false;
  if (date < task.startDate) return false;
  if (task.repeatEndDate && date > task.repeatEndDate) return false;

  const start = new Date(task.startDate+"T00:00:00+09:00");
  const cur   = new Date(date+"T00:00:00+09:00");
  const dow   = cur.getDay(); // 0=일
  const diffDays = Math.round((cur - start) / 86400000);

  switch(task.repeat) {
    case "daily":    return true;
    case "weekdays": return dow >= 1 && dow <= 5;
    case "weekly":   return diffDays % 7 === 0;
    case "biweekly": return diffDays % 14 === 0;
    case "monthly":  return start.getDate() === cur.getDate();
    default:         return false;
  }
}

const QUADRANTS = [
  { id:"do",       label:"지금 바로",  sub:"중요 & 긴급",                color:"#E07B7B", bg:"#FFF5F5" },
  { id:"schedule", label:"일정 잡기",  sub:"중요 & 긴급하지 않음",        color:"#5BA4CF", bg:"#F0F7FF" },
  { id:"delegate", label:"위임하기",   sub:"긴급 & 중요하지 않음",        color:"#FFB347", bg:"#FFF8EE" },
  { id:"delete",   label:"제거하기",   sub:"중요하지도 긴급하지도 않음",   color:"#6BC5A0", bg:"#F2FAF5" },
];

const REPEAT_OPTIONS = [
  { value:"none",     label:"반복 없음" },
  { value:"daily",    label:"매일" },
  { value:"weekdays", label:"평일마다" },
  { value:"weekly",   label:"매주" },
  { value:"biweekly", label:"격주" },
  { value:"monthly",  label:"매월" },
];

export default function App() {
  const [tasks,    setTasks]    = useState([]);
  const [view,     setView]     = useState("matrix");
  const [selDate,  setSelDate]  = useState(getKSTToday());
  const [modal,    setModal]    = useState(null);
  const [detail,   setDetail]   = useState(null);
  const [filter,   setFilter]   = useState("all");
  const [dateOpen, setDateOpen] = useState(false);
  const [loaded,   setLoaded]   = useState(false);

  const todayKST = getKSTToday();
  const strip    = getStripDates(todayKST);
  const isToday  = selDate === todayKST;
  const isPast   = selDate < todayKST;

  useEffect(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9*60*60*1000);
    const midnight = new Date(kst);
    midnight.setUTCHours(15,0,0,0);
    if (midnight <= now) midnight.setUTCDate(midnight.getUTCDate()+1);
    const timer = setTimeout(() => setSelDate(getKSTToday()), midnight - now);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const raw=localStorage.getItem("eisenhower-v4"); const r=raw?{value:raw}:null;
        if (r?.value) { const d=JSON.parse(r.value); if(d.tasks) setTasks(d.tasks); }
      } catch(e) {}
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("eisenhower-v4", JSON.stringify({tasks}));
  }, [tasks, loaded]);

  // 날짜별로 보여줄 태스크 계산 (일반 + 반복)
  function getTasksForDate(date) {
    const normal   = tasks.filter(t => !t.repeat || t.repeat === "none").filter(t => t.date === date);
    const repeated = tasks.filter(t => t.repeat && t.repeat !== "none").filter(t => shouldShowRepeat(t, date));
    // 반복 태스크의 완료 여부는 날짜별로 별도 저장
    return [
      ...normal,
      ...repeated.map(t => ({
        ...t,
        _repeatInstance: true,
        _instanceDate: date,
        done: !!(t.doneByDate && t.doneByDate[date]),
      }))
    ];
  }

  function toggleDone(id, isRepeatInstance, instanceDate) {
    if (isRepeatInstance) {
      setTasks(p => p.map(t => {
        if (t.id !== id) return t;
        const doneByDate = { ...(t.doneByDate || {}) };
        doneByDate[instanceDate] = !doneByDate[instanceDate];
        return { ...t, doneByDate };
      }));
    } else {
      setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
    }
  }

  function deleteTask(id) {
    setTasks(p => p.filter(t => t.id !== id));
    setDetail(null);
  }

  function saveTask(task) {
    if (modal?.mode === "add") {
      setTasks(p => [...p, { ...task, id: uid(), done: false, createdAt: Date.now(), date: selDate, startDate: selDate }]);
    } else {
      setTasks(p => p.map(t => t.id === task.id ? { ...t, ...task } : t));
    }
    setModal(null);
  }

  const dayTasks    = getTasksForDate(selDate);
  const tasksByQ    = (qid) => dayTasks.filter(t => t.quadrantId === qid && (filter==="all" ? true : filter==="done" ? t.done : !t.done));
  const totalActive = dayTasks.filter(t => !t.done).length;
  const totalDone   = dayTasks.filter(t =>  t.done).length;

  function selectDate(date) { setSelDate(date); setDateOpen(false); }

  // 상세 보기할 때 최신 task 상태 가져오기
  function getDetailTask(d) {
    const base = tasks.find(x => x.id === d.id);
    if (!base) return d;
    if (d._repeatInstance) {
      return { ...base, _repeatInstance: true, _instanceDate: d._instanceDate,
        done: !!(base.doneByDate && base.doneByDate[d._instanceDate]) };
    }
    return base;
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* TOP BAR */}
        <div className="topbar">
          <button className="date-toggle-btn" onClick={()=>setDateOpen(o=>!o)}>
            <div className="date-toggle-left">
              <span className="date-toggle-label">{isToday?"오늘":isPast?"과거":"미래"}</span>
              <span className="date-toggle-value">{formatDateShort(selDate)}</span>
            </div>
            <span className={`date-caret${dateOpen?" open":""}`}>›</span>
          </button>
          <div className="topbar-right">
            {!isToday && <button className="today-chip" onClick={()=>selectDate(todayKST)}>오늘</button>}
            <button className="icon-btn accent" onClick={()=>setModal({mode:"add"})}>＋</button>
          </div>
        </div>

        {/* DATE STRIP */}
        <div className={`date-strip-wrap${dateOpen?" open":""}`}>
          <div className="date-strip">
            {strip.map(date=>{
              const {day,num,dow}=parseDateInfo(date);
              const isSel=date===selDate, isTod=date===todayKST;
              const has=getTasksForDate(date).length>0;
              return(
                <button key={date} className={`dc${isSel?" sel":""}${isTod?" tod":""}${dow===0?" sun":""}${dow===6?" sat":""}`}
                  onClick={()=>selectDate(date)}>
                  <span className="dc-day">{day}</span>
                  <span className="dc-num">{num}</span>
                  <span className={`dc-dot${has?" on":""}`}/>
                </button>
              );
            })}
          </div>
        </div>

        {/* SUBBAR */}
        <div className="subbar">
          <div className="subbar-top">
            <button className={`tab${view==="matrix"?" active":""}`} onClick={()=>setView("matrix")}>매트릭스</button>
            <button className={`tab${view==="list"?" active":""}`} onClick={()=>setView("list")}>목록</button>
            <div className="filter-row">
              {[["all","전체"],["active","진행중"],["done","완료"]].map(([f,l])=>(
                <button key={f} className={`filter-btn${filter===f?" active":""}`} onClick={()=>setFilter(f)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="counts-row">
            <span className="tc active">진행중 {totalActive}</span>
            <span className="tc-div"/>
            <span className="tc done">완료 {totalDone}</span>
          </div>
        </div>

        <div className="scroll-area">

          {/* MATRIX */}
          {view==="matrix" && (
            <div className="matrix-grid">
              {QUADRANTS.map(q=>{
                const qt=tasksByQ(q.id);
                return(
                  <div key={q.id} className="quadrant" style={{background:q.bg,borderColor:q.color+"28"}}>
                    <div className="q-header">
                      <div className="q-dot" style={{background:q.color}}/>
                      <div className="q-header-text">
                        <div className="q-label" style={{color:q.color}}>{q.label}</div>
                        <div className="q-sub">{q.sub}</div>
                      </div>
                      <button className="q-add-btn" style={{color:q.color}}
                        onClick={()=>setModal({mode:"add",quadrantId:q.id})}>＋</button>
                    </div>
                    <div className="q-tasks">
                      {qt.length===0
                        ? <div className="q-empty">없음</div>
                        : qt.map(t=>{
                          const due = formatDue(t.dueDate, selDate);
                          const rep = formatRepeat(t.repeat);
                          return(
                            <div key={t.id+(t._instanceDate||"")} className={`q-task${t.done?" done":""}`} onClick={()=>setDetail(t)}>
                              <button className={`q-check${t.done?" done":""}`}
                                style={t.done?{background:q.color,borderColor:q.color}:{borderColor:q.color+"70"}}
                                onClick={e=>{e.stopPropagation();toggleDone(t.id,t._repeatInstance,t._instanceDate);}}>
                                {t.done&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7.5L8 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </button>
                              <div className="q-task-body">
                                <span className="q-task-name">{t.title}</span>
                                <div className="q-task-tags">
                                  {due && <span className={`q-tag${due.urgent?" urgent":""}`}>{due.label}</span>}
                                  {rep && <span className="q-tag repeat">🔁 {rep}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* LIST */}
          {view==="list" && (
            <div className="list-view">
              {QUADRANTS.map(q=>{
                const qt=tasksByQ(q.id);
                if(qt.length===0) return null;
                return(
                  <div key={q.id} className="list-group">
                    <div className="list-group-header">
                      <span className="cat-dot" style={{background:q.color}}/>
                      <span className="list-group-label" style={{color:q.color}}>{q.label}</span>
                      <span className="list-group-count">{qt.length}</span>
                    </div>
                    {qt.map(t=>{
                      const due=formatDue(t.dueDate,selDate);
                      const rep=formatRepeat(t.repeat);
                      return(
                        <div key={t.id+(t._instanceDate||"")} className={`lcard${t.done?" done":""}`} onClick={()=>setDetail(t)}>
                          <button className={`lcheck${t.done?" done":""}`}
                            style={t.done?{background:q.color,borderColor:q.color}:{}}
                            onClick={e=>{e.stopPropagation();toggleDone(t.id,t._repeatInstance,t._instanceDate);}}>
                            {t.done&&<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </button>
                          <div className="lcard-info">
                            <div className="lcard-title">{t.title}</div>
                            {t.note&&<div className="lcard-note">{t.note}</div>}
                            <div className="lcard-tags">
                              {due&&<span className={`l-tag${due.urgent?" urgent":""}`}>{due.label}</span>}
                              {rep&&<span className="l-tag">🔁 {rep}</span>}
                            </div>
                          </div>
                          <div className="lpill" style={{background:q.color}}/>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {dayTasks.filter(t=>filter==="all"?true:filter==="done"?t.done:!t.done).length===0&&(
                <div className="empty-hint">이 날의 할 일이 없어요{"\n"}＋ 버튼으로 추가해보세요!</div>
              )}
            </div>
          )}
        </div>

        {/* DETAIL MODAL */}
        {detail&&(()=>{
          const t=getDetailTask(detail);
          const q=QUADRANTS.find(q=>q.id===t.quadrantId)||QUADRANTS[0];
          const due=formatDue(t.dueDate,selDate);
          const rep=formatRepeat(t.repeat);
          return(
            <div className="overlay" onClick={()=>setDetail(null)}>
              <div className="modal" onClick={e=>e.stopPropagation()}>
                <div className="modal-drag"/>
                <div className="detail-top">
                  <div className="detail-q-badge" style={{background:q.bg,color:q.color,borderColor:q.color+"50"}}>{q.label}</div>
                  <button className="close-btn" onClick={()=>setDetail(null)}>✕</button>
                </div>
                <div className="detail-title">{t.title}</div>
                {t.note&&<div className="detail-note">{t.note}</div>}
                <div className="detail-meta">
                  <div className="detail-row"><span className="detail-row-icon">📅</span><span className="detail-row-val">{formatDateFull(t._instanceDate||t.date)}</span></div>
                  {t.dueDate&&<div className="detail-row">
                    <span className="detail-row-icon">⏰</span>
                    <span className="detail-row-val">마감: {formatDateFull(t.dueDate)}</span>
                    {due&&<span className={`inline-tag${due.urgent?" urgent":""}`}>{due.label}</span>}
                  </div>}
                  {rep&&<div className="detail-row"><span className="detail-row-icon">🔁</span><span className="detail-row-val">{rep}</span>
                    {t.repeatEndDate&&<span className="detail-row-val muted"> ~ {formatDateShort(t.repeatEndDate)}</span>}
                  </div>}
                </div>
                <div className="detail-actions">
                  <button className={`detail-done-btn${t.done?" undone":""}`}
                    style={t.done?{}:{background:q.color}}
                    onClick={()=>toggleDone(t.id,t._repeatInstance,t._instanceDate)}>
                    {t.done?"완료 취소":"✓ 완료"}
                  </button>
                  <button className="detail-edit-btn" onClick={()=>{setModal({mode:"edit",task:tasks.find(x=>x.id===t.id)||t});setDetail(null);}}>수정</button>
                  <button className="detail-del-btn" onClick={()=>deleteTask(t.id)}>삭제</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ADD/EDIT MODAL */}
        {modal&&(
          <TaskModal
            mode={modal.mode}
            task={modal.task}
            defaultQ={modal.quadrantId??"do"}
            selDate={selDate}
            onSave={saveTask}
            onClose={()=>setModal(null)}
          />
        )}
      </div>
    </>
  );
}

function TaskModal({mode,task,defaultQ,selDate,onSave,onClose}) {
  const [title,         setTitle]         = useState(task?.title         ??"");
  const [note,          setNote]          = useState(task?.note          ??"");
  const [quadrantId,    setQuadrantId]    = useState(task?.quadrantId    ??defaultQ);
  const [dueDate,       setDueDate]       = useState(task?.dueDate       ??"");
  const [repeat,        setRepeat]        = useState(task?.repeat        ??"none");
  const [repeatEndDate, setRepeatEndDate] = useState(task?.repeatEndDate ??"");
  const [showRepeatEnd, setShowRepeatEnd] = useState(!!(task?.repeatEndDate));

  function save() {
    if (!title.trim()) return;
    onSave({
      ...(task||{}), title:title.trim(), note, quadrantId, dueDate,
      repeat, repeatEndDate: repeat!=="none"&&showRepeatEnd ? repeatEndDate : ""
    });
  }

  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-drag"/>
        <div className="modal-title">{mode==="add"?"할 일 추가":"할 일 수정"}</div>
        <div className="modal-date-tag">{formatDateFull(selDate)}</div>

        <div className="field-label">제목</div>
        <input className="text-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="할 일 제목" autoFocus/>

        <div className="field-label">메모</div>
        <textarea className="text-input textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="메모 (선택사항)" rows={2}/>

        <div className="field-label">마감일</div>
        <div className="date-input-row">
          <input className="text-input date-input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
          {dueDate&&<button className="clear-btn" onClick={()=>setDueDate("")}>✕</button>}
        </div>

        <div className="field-label">반복</div>
        <div className="repeat-grid">
          {REPEAT_OPTIONS.map(o=>(
            <button key={o.value}
              className={`repeat-btn${repeat===o.value?" sel":""}`}
              onClick={()=>setRepeat(o.value)}>
              {o.label}
            </button>
          ))}
        </div>

        {repeat!=="none"&&(
          <div className="repeat-end-row">
            <label className="repeat-end-toggle">
              <input type="checkbox" checked={showRepeatEnd} onChange={e=>setShowRepeatEnd(e.target.checked)}/>
              <span>반복 종료일 설정</span>
            </label>
            {showRepeatEnd&&(
              <div className="date-input-row" style={{marginTop:8}}>
                <input className="text-input date-input" type="date" value={repeatEndDate} onChange={e=>setRepeatEndDate(e.target.value)}/>
                {repeatEndDate&&<button className="clear-btn" onClick={()=>setRepeatEndDate("")}>✕</button>}
              </div>
            )}
          </div>
        )}

        <div className="field-label">분류</div>
        <div className="q-select-grid">
          {QUADRANTS.map(q=>(
            <button key={q.id}
              className={`q-select-btn${quadrantId===q.id?" sel":""}`}
              style={quadrantId===q.id
                ?{background:q.color,borderColor:q.color,color:"#fff"}
                :{borderColor:q.color+"50",color:q.color,background:q.bg}}
              onClick={()=>setQuadrantId(q.id)}>
              <span className="q-sel-label">{q.label}</span>
              <span className="q-sel-sub" style={quadrantId===q.id?{color:"rgba(255,255,255,0.8)"}:{}}>{q.sub}</span>
            </button>
          ))}
        </div>

        <button className="primary-btn" onClick={save}>저장</button>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{background:#fff;}
.app{min-height:100vh;background:#fff;font-family:'Noto Sans KR',sans-serif;max-width:430px;margin:0 auto;display:flex;flex-direction:column;}

.topbar{background:#fff;padding:52px 20px 12px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:20;border-bottom:1px solid #F2F2F7;}
.date-toggle-btn{display:flex;align-items:center;gap:10px;background:#F2F2F7;border:none;border-radius:20px;padding:8px 14px;cursor:pointer;}
.date-toggle-left{display:flex;flex-direction:column;align-items:flex-start;gap:1px;}
.date-toggle-label{font-size:10px;font-weight:600;color:#8E8E93;letter-spacing:0.5px;text-transform:uppercase;font-family:'Noto Sans KR',sans-serif;}
.date-toggle-value{font-size:14px;font-weight:600;color:#1C1C1E;font-family:'Noto Sans KR',sans-serif;}
.date-caret{font-size:18px;color:#8E8E93;transition:transform 0.25s;line-height:1;transform:rotate(90deg);}
.date-caret.open{transform:rotate(-90deg);}
.topbar-right{display:flex;align-items:center;gap:8px;}
.today-chip{padding:6px 12px;border-radius:16px;border:none;background:#E8F0FB;color:#3C8CE4;font-size:12px;font-weight:600;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.icon-btn.accent{background:#1C1C1E;color:#fff;font-size:18px;width:34px;height:34px;border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;}

.date-strip-wrap{overflow:hidden;max-height:0;transition:max-height 0.3s ease;background:#fff;border-bottom:1px solid transparent;}
.date-strip-wrap.open{max-height:100px;border-bottom-color:#F2F2F7;}
.date-strip{display:flex;gap:4px;padding:10px 20px 12px;overflow-x:auto;scrollbar-width:none;}
.date-strip::-webkit-scrollbar{display:none;}
.dc{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 9px;border-radius:14px;cursor:pointer;min-width:42px;border:none;background:transparent;flex-shrink:0;font-family:'Noto Sans KR',sans-serif;transition:all 0.15s;}
.dc.sel{background:#1C1C1E;} .dc.tod:not(.sel){background:#F2F2F7;}
.dc-day{font-size:10px;font-weight:500;color:#8E8E93;}
.dc.sun .dc-day{color:#E07B7B;} .dc.sat .dc-day{color:#5BA4CF;} .dc.sel .dc-day{color:#fff!important;}
.dc-num{font-size:17px;font-weight:300;color:#1C1C1E;} .dc.sel .dc-num{color:#fff;}
.dc-dot{width:4px;height:4px;border-radius:50%;background:transparent;} .dc-dot.on{background:#3C8CE4;} .dc.sel .dc-dot.on{background:#fff;}

.subbar{background:#fff;border-bottom:1px solid #F2F2F7;padding:8px 20px;}
.subbar-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;}
.tab{padding:6px 14px;border-radius:20px;border:none;font-family:'Noto Sans KR',sans-serif;font-size:12px;font-weight:500;cursor:pointer;background:#F2F2F7;color:#6B6B70;transition:all 0.15s;}
.tab.active{background:#1C1C1E;color:#fff;}
.filter-row{display:flex;gap:2px;margin-left:auto;}
.filter-btn{padding:5px 9px;border-radius:14px;border:none;font-family:'Noto Sans KR',sans-serif;font-size:11px;cursor:pointer;background:transparent;color:#8E8E93;}
.filter-btn.active{background:#F2F2F7;color:#1C1C1E;font-weight:500;}
.counts-row{display:flex;align-items:center;gap:8px;}
.tc{font-size:12px;font-weight:500;} .tc.active{color:#E07B7B;} .tc.done{color:#8E8E93;}
.tc-div{width:1px;height:11px;background:#E5E5EA;}

.scroll-area{flex:1;overflow-y:auto;padding-bottom:90px;}

.matrix-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;}
.quadrant{border-radius:18px;padding:13px;border:1.5px solid transparent;display:flex;flex-direction:column;gap:8px;}
.q-header{display:flex;align-items:flex-start;gap:7px;}
.q-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0;}
.q-header-text{flex:1;min-width:0;}
.q-label{font-size:13px;font-weight:600;line-height:1.2;}
.q-sub{font-size:10px;color:#8E8E93;margin-top:2px;line-height:1.3;}
.q-add-btn{margin-left:auto;border:none;background:transparent;font-size:18px;cursor:pointer;line-height:1;flex-shrink:0;padding:0;}
.q-tasks{display:flex;flex-direction:column;gap:5px;}
.q-empty{font-size:11px;color:#C7C7CC;text-align:center;padding:8px 0;}
.q-task{display:flex;align-items:flex-start;gap:7px;padding:7px 8px;background:rgba(255,255,255,0.75);border-radius:10px;cursor:pointer;}
.q-task.done .q-task-name{text-decoration:line-through;color:#8E8E93;}
.q-check{width:18px;height:18px;border-radius:50%;border:1.5px solid;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all 0.2s;margin-top:2px;}
.q-task-body{flex:1;min-width:0;}
.q-task-name{font-size:12px;color:#1C1C1E;line-height:1.4;word-break:break-all;display:block;}
.q-task-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;}
.q-tag{font-size:9px;padding:2px 5px;border-radius:5px;background:rgba(0,0,0,0.06);color:#8E8E93;}
.q-tag.urgent{background:#FFF0F0;color:#E07B7B;}
.q-tag.repeat{background:#F0F7FF;color:#5BA4CF;}

.list-view{padding:14px 20px;}
.list-group{margin-bottom:16px;}
.list-group-header{display:flex;align-items:center;gap:6px;margin-bottom:8px;}
.cat-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.list-group-label{font-size:12px;font-weight:600;}
.list-group-count{margin-left:auto;font-size:11px;color:#8E8E93;background:#F2F2F7;padding:2px 7px;border-radius:10px;}
.lcard{background:#fff;border-radius:14px;padding:13px 14px;display:flex;align-items:center;gap:12px;border:1.5px solid #F2F2F7;margin-bottom:7px;cursor:pointer;}
.lcard.done{opacity:0.55;}
.lcheck{width:24px;height:24px;border-radius:50%;border:1.8px solid #D1D1D6;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;}
.lcard-info{flex:1;min-width:0;}
.lcard-title{font-size:14px;font-weight:500;color:#1C1C1E;}
.lcard.done .lcard-title{text-decoration:line-through;color:#8E8E93;}
.lcard-note{font-size:12px;color:#8E8E93;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lcard-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;}
.l-tag{font-size:10px;padding:2px 7px;border-radius:6px;background:#F2F2F7;color:#8E8E93;}
.l-tag.urgent{background:#FFF0F0;color:#E07B7B;}
.lpill{width:6px;height:22px;border-radius:3px;flex-shrink:0;}

.empty-hint{text-align:center;padding:40px 20px;color:#8E8E93;font-size:14px;line-height:2;white-space:pre-line;}


.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:50;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:#fff;border-radius:24px 24px 0 0;padding:12px 20px 36px;width:100%;max-width:430px;max-height:92vh;overflow-y:auto;}
.modal-drag{width:40px;height:4px;background:#E5E5EA;border-radius:2px;margin:0 auto 16px;}
.modal-title{font-size:18px;font-weight:600;color:#1C1C1E;margin-bottom:4px;}
.modal-date-tag{font-size:12px;color:#8E8E93;margin-bottom:16px;}

.detail-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.detail-q-badge{font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:1.5px solid;}
.close-btn{border:none;background:#F2F2F7;border-radius:50%;width:32px;height:32px;font-size:14px;cursor:pointer;color:#666;}
.detail-title{font-size:20px;font-weight:600;color:#1C1C1E;line-height:1.4;margin-bottom:10px;}
.detail-note{font-size:14px;color:#6B6B70;line-height:1.6;margin-bottom:12px;background:#F9F9F9;padding:12px;border-radius:12px;}
.detail-meta{display:flex;flex-direction:column;gap:6px;margin-bottom:4px;}
.detail-row{display:flex;align-items:center;gap:8px;}
.detail-row-icon{font-size:15px;flex-shrink:0;}
.detail-row-val{font-size:13px;color:#6B6B70;}
.detail-row-val.muted{color:#AEAEB2;}
.inline-tag{font-size:11px;padding:2px 7px;border-radius:6px;background:#F2F2F7;color:#8E8E93;margin-left:4px;}
.inline-tag.urgent{background:#FFF0F0;color:#E07B7B;}
.detail-actions{display:flex;gap:8px;margin-top:20px;}
.detail-done-btn{flex:2;padding:13px;border:none;border-radius:14px;color:#fff;font-family:'Noto Sans KR',sans-serif;font-size:15px;font-weight:600;cursor:pointer;}
.detail-done-btn.undone{background:#F2F2F7;color:#1C1C1E;}
.detail-edit-btn{flex:1;padding:13px;background:#F2F2F7;border:none;border-radius:14px;font-family:'Noto Sans KR',sans-serif;font-size:14px;color:#1C1C1E;cursor:pointer;}
.detail-del-btn{flex:1;padding:13px;background:transparent;border:1.5px solid #FFCDD2;border-radius:14px;font-family:'Noto Sans KR',sans-serif;font-size:14px;color:#E07B7B;cursor:pointer;}

.field-label{font-size:11px;font-weight:600;color:#8E8E93;letter-spacing:0.5px;margin:14px 0 8px;text-transform:uppercase;}
.text-input{width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid #E5E5EA;font-family:'Noto Sans KR',sans-serif;font-size:15px;color:#1C1C1E;background:#fff;outline:none;resize:none;}
.text-input:focus{border-color:#3C8CE4;}
.textarea{line-height:1.6;}
.date-input-row{position:relative;display:flex;align-items:center;}
.date-input{padding-right:36px;}
.clear-btn{position:absolute;right:12px;border:none;background:transparent;color:#C7C7CC;font-size:14px;cursor:pointer;padding:4px;}

.repeat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;}
.repeat-btn{padding:9px 6px;border-radius:12px;border:1.5px solid #E5E5EA;background:#fff;font-family:'Noto Sans KR',sans-serif;font-size:12px;color:#6B6B70;cursor:pointer;transition:all 0.15s;text-align:center;}
.repeat-btn.sel{background:#1C1C1E;border-color:#1C1C1E;color:#fff;font-weight:600;}

.repeat-end-row{margin-top:10px;background:#F9F9F9;border-radius:12px;padding:12px;}
.repeat-end-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#1C1C1E;font-family:'Noto Sans KR',sans-serif;}
.repeat-end-toggle input{width:16px;height:16px;accent-color:#1C1C1E;cursor:pointer;}

.q-select-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.q-select-btn{padding:10px 12px;border-radius:14px;border:1.5px solid;font-family:'Noto Sans KR',sans-serif;cursor:pointer;text-align:left;transition:all 0.15s;display:flex;flex-direction:column;gap:2px;}
.q-sel-label{font-size:13px;font-weight:600;}
.q-sel-sub{font-size:10px;color:#8E8E93;line-height:1.3;}
.primary-btn{width:100%;margin-top:20px;padding:14px;background:#1C1C1E;color:#fff;border:none;border-radius:14px;font-family:'Noto Sans KR',sans-serif;font-size:16px;font-weight:600;cursor:pointer;}
`;