import { useState, useEffect } from "react";

const DAYS_KR = ["일","월","화","수","목","금","토"];
const MONTHS_KR = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function toKey(date) {
  if (date instanceof Date)
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  return date;
}
function today() { return toKey(new Date()); }
function daysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function firstDow(y, m) { return new Date(y, m, 1).getDay(); }
function uid() { return Math.random().toString(36).slice(2,9); }

const PALETTE = ["#5BA4CF","#E07B7B","#A8D5BA","#F9C5C5","#B39DDB","#FFD54F","#FF8A65","#80DEEA","#CE93D8","#EF9A9A"];
const ICONS = ["📚","✏️","🏃","💧","🧘","💪","🍎","😴","🎸","🖊️","🌿","🔥","⭐","🎯","🧹","📝"];

const DEFAULT_CATS = [
  { id: "study", name: "공부/독서", color: "#5BA4CF" },
  { id: "health", name: "건강", color: "#A8D5BA" },
];
const DEFAULT_HABITS = [
  { id: "h1", name: "독서", icon: "📚", color: "#5BA4CF", catId: "study" },
  { id: "h2", name: "공부/학습", icon: "✏️", color: "#E07B7B", catId: "study" },
];

export default function App() {
  const [view, setView]         = useState("daily");
  const [habits, setHabits]     = useState(DEFAULT_HABITS);
  const [cats, setCats]         = useState(DEFAULT_CATS);
  const [records, setRecords]   = useState({});
  const [selDate, setSelDate]   = useState(today());
  const [moOffset, setMoOffset] = useState(0);
  const [loaded, setLoaded]     = useState(false);
  const [habitModal, setHabitModal] = useState(null);
  const [catModal, setCatModal]     = useState(false);
  const [detailHabit, setDetailHabit] = useState(null);
  const [detailMoOff, setDetailMoOff] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const raw=localStorage.getItem("ht-data-v4"); const r=raw?{value:raw}:null;
        if (r?.value) {
          const d = JSON.parse(r.value);
          if (d.habits)  setHabits(d.habits);
          if (d.cats)    setCats(d.cats);
          if (d.records) setRecords(d.records);
        }
      } catch(e) {}
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("ht-data-v4", JSON.stringify({ habits, cats, records }));
  }, [habits, cats, records, loaded]);

  const toggle  = (date, hid) => setRecords(p => ({ ...p, [`${date}__${hid}`]: !p[`${date}__${hid}`] }));
  const isDone  = (date, hid) => !!records[`${date}__${hid}`];
  const doneCount = (date) => habits.filter(h => isDone(date, h.id)).length;
  const streak = (hid) => {
    let s = 0, d = new Date();
    while (true) { const k = toKey(d); if (!isDone(k, hid)) break; s++; d.setDate(d.getDate()-1); }
    return s;
  };

  const now    = new Date();
  const moYear = new Date(now.getFullYear(), now.getMonth()+moOffset, 1);
  const selD   = new Date(selDate+"T00:00:00");
  const strip  = Array.from({length:14},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i-3); return toKey(d); });

  const habitsByCat = cats.map(c => ({
    ...c, habits: habits.filter(h => h.catId === c.id)
  })).concat([{
    id:"__none__", name:"미분류", color:"#999",
    habits: habits.filter(h => !cats.find(c=>c.id===h.catId))
  }]).filter(g => g.habits.length > 0);

  const detailNow   = new Date(now.getFullYear(), now.getMonth()+detailMoOff, 1);
  const detailYear  = detailNow.getFullYear();
  const detailMonth = detailNow.getMonth();
  const detailDays  = daysInMonth(detailYear, detailMonth);
  const detailFirst = firstDow(detailYear, detailMonth);
  const detailDates = Array.from({length:detailDays},(_,i)=>toKey(new Date(detailYear,detailMonth,i+1)));
  const detailStreak = detailHabit ? streak(detailHabit.id) : 0;
  const detailTotal  = detailHabit ? detailDates.filter(d=>isDone(d,detailHabit.id)).length : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* TOP BAR */}
        <div className="topbar">
          <div className="topbar-title">
            습관 트래커
            {view==="monthly" && <span className="topbar-sub"> {moYear.getFullYear()}년 {MONTHS_KR[moYear.getMonth()]}</span>}
          </div>
          <div className="topbar-actions">
            {view==="monthly" && <>
              <button className="icon-btn" onClick={()=>setMoOffset(m=>m-1)}>‹</button>
              <button className="icon-btn small" onClick={()=>setMoOffset(0)}>오늘</button>
              <button className="icon-btn" onClick={()=>setMoOffset(m=>m+1)}>›</button>
            </>}
            <button className="icon-btn accent" onClick={()=>setHabitModal({mode:"add"})}>＋</button>
          </div>
        </div>

        {/* TABS */}
        <div className="tabbar">
          <button className={`tab${view==="daily"?" active":""}`}   onClick={()=>setView("daily")}>일간</button>
          <button className={`tab${view==="monthly"?" active":""}`} onClick={()=>setView("monthly")}>월간</button>
          <button className="tab cat-tab" onClick={()=>setCatModal(true)}>카테고리 ✏️</button>
        </div>

        <div className="scroll-area">

          {/* ── DAILY ── */}
          {view==="daily" && <>
            <div className="date-strip">
              {strip.map(date=>{
                const d=new Date(date+"T00:00:00");
                const isSel=date===selDate, isTod=date===today();
                const any=habits.some(h=>isDone(date,h.id));
                return(
                  <button key={date} className={`dc${isSel?" sel":""}${isTod?" tod":""}`} onClick={()=>setSelDate(date)}>
                    <span className="dc-day">{DAYS_KR[d.getDay()]}</span>
                    <span className="dc-num">{d.getDate()}</span>
                    <span className={`dc-dot${any?" on":""}`}/>
                  </button>
                );
              })}
            </div>

            <div className="divider"/>

            <div className="daily-header">
              <div className="daily-date-row">
                <span className="daily-big">{selD.getDate()}</span>
                <span className="daily-sub">{selD.getFullYear()}년 {MONTHS_KR[selD.getMonth()]} {DAYS_KR[selD.getDay()]}요일</span>
              </div>
              <div className="prog-row">
                <div className="prog-bar">
                  <div className="prog-fill" style={{width:`${habits.length?doneCount(selDate)/habits.length*100:0}%`}}/>
                </div>
                <span className="prog-label">{doneCount(selDate)}/{habits.length} 완료</span>
              </div>
            </div>

            {habits.length===0
              ? <div className="empty-hint">＋ 버튼으로 첫 습관을 추가해보세요!</div>
              : habitsByCat.map(grp=>(
                <div key={grp.id} className="cat-group">
                  <div className="cat-label">
                    <span className="cat-dot" style={{background:grp.color}}/>
                    {grp.name}
                  </div>
                  {grp.habits.map(h=>{
                    const done=isDone(selDate,h.id);
                    return(
                      <div key={h.id} className={`hcard${done?" done":""}`}>
                        <div className="hcard-left" onClick={()=>toggle(selDate,h.id)}>
                          <div className="hpill" style={{background:h.color}}/>
                          <div className="hemoji">{h.icon}</div>
                          <div className="hinfo">
                            <div className="hname">{h.name}</div>
                            <div className={`hstatus${done?" done":""}`}>{done?"✓ 완료":"미완료"}</div>
                          </div>
                          <div className={`hcheck${done?" done":""}`}>
                            {done&&<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>
                        <div className="hcard-actions">
                          <button className="hact-btn" onClick={()=>{setDetailHabit(h);setDetailMoOff(0);}}>📊</button>
                          <button className="hact-btn" onClick={()=>setHabitModal({mode:"edit",habit:h})}>⋯</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            }
          </>}

          {/* ── MONTHLY ── */}
          {view==="monthly" && <>
            <div className="mday-headers">
              {DAYS_KR.map(d=><div key={d} className="mday-h">{d}</div>)}
            </div>
            <div className="mgrid">
              {Array.from({length:firstDow(moYear.getFullYear(),moYear.getMonth())},(_,i)=><div key={`e${i}`} className="empty-c"/>)}
              {Array.from({length:daysInMonth(moYear.getFullYear(),moYear.getMonth())},(_,i)=>{
                const date=toKey(new Date(moYear.getFullYear(),moYear.getMonth(),i+1));
                const d=new Date(date+"T00:00:00");
                const dow=d.getDay(), isTod=date===today(), isSel=date===selDate;
                return(
                  <button key={date} className={`mcell${isTod?" tod":""}${isSel?" sel":""}${dow===0?" sun":""}${dow===6?" sat":""}`}
                    onClick={()=>{setSelDate(date);setView("daily");}}>
                    <span className="mcell-n">{d.getDate()}</span>
                    <div className="mcell-dots">
                      {habits.map(h=>(
                        <div key={h.id} className={`mcdot${isDone(date,h.id)?" on":""}`} style={{background:isSel?"#fff":h.color}}/>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="day-detail">
              <div className="dd-header">
                <div className="dd-title">{selD.getMonth()+1}월 {selD.getDate()}일 {DAYS_KR[selD.getDay()]}요일</div>
                <div className="dd-count">{doneCount(selDate)}/{habits.length}</div>
              </div>
              <div className="dd-habits">
                {habits.length===0
                  ? <div className="empty-hint small">아직 습관이 없어요</div>
                  : habits.map(h=>{
                    const done=isDone(selDate,h.id);
                    return(
                      <button key={h.id} className={`dd-row${done?" done":""}`} onClick={()=>toggle(selDate,h.id)}>
                        <div className="dd-pill" style={{background:h.color}}/>
                        <span className="dd-name">{h.icon} {h.name}</span>
                        <div className={`dd-check${done?" done":""}`}>
                          {done&&<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4.5 8L9 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </>}
        </div>


        {/* DETAIL GRID MODAL */}
        {detailHabit && (
          <div className="overlay" onClick={()=>setDetailHabit(null)}>
            <div className="modal detail-modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-drag"/>
              <div className="detail-top">
                <div>
                  <div className="detail-emoji">{detailHabit.icon}</div>
                  <div className="detail-hname">{detailHabit.name}</div>
                </div>
                <button className="close-btn" onClick={()=>setDetailHabit(null)}>✕</button>
              </div>
              <div className="detail-stats">
                <div className="dstat">
                  <div className="dstat-val">🔥 {detailStreak}</div>
                  <div className="dstat-lbl">연속 달성</div>
                </div>
                <div className="dstat">
                  <div className="dstat-val">{detailTotal}</div>
                  <div className="dstat-lbl">이번 달 완료</div>
                </div>
                <div className="dstat">
                  <div className="dstat-val">{detailDays>0?Math.round(detailTotal/detailDays*100):0}%</div>
                  <div className="dstat-lbl">달성률</div>
                </div>
              </div>
              <div className="detail-month-nav">
                <button className="icon-btn" onClick={()=>setDetailMoOff(o=>o-1)}>‹</button>
                <span className="detail-month-label">{detailYear}년 {MONTHS_KR[detailMonth]}</span>
                <button className="icon-btn" onClick={()=>setDetailMoOff(o=>o+1)}>›</button>
              </div>
              <div className="detail-day-headers">
                {DAYS_KR.map(d=><div key={d} className="mday-h">{d}</div>)}
              </div>
              <div className="detail-grid">
                {Array.from({length:detailFirst},(_,i)=><div key={`e${i}`} className="dg-empty"/>)}
                {detailDates.map(date=>{
                  const d=new Date(date+"T00:00:00");
                  const done=isDone(date,detailHabit.id);
                  const isTod=date===today();
                  return(
                    <button key={date}
                      className={`dg-cell${done?" done":""}${isTod?" tod":""}`}
                      style={done?{background:detailHabit.color}:{}}
                      onClick={()=>toggle(date,detailHabit.id)}>
                      <span className="dg-num" style={done?{color:"#fff"}:{}}>{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* HABIT MODAL */}
        {habitModal && (
          <HabitModal
            mode={habitModal.mode}
            habit={habitModal.habit}
            cats={cats}
            onSave={(h)=>{ if(habitModal.mode==="add") setHabits(p=>[...p,{...h,id:uid()}]); else setHabits(p=>p.map(x=>x.id===h.id?h:x)); setHabitModal(null); }}
            onDelete={(hid)=>{ setHabits(p=>p.filter(x=>x.id!==hid)); setHabitModal(null); }}
            onClose={()=>setHabitModal(null)}
          />
        )}

        {/* CATEGORY MODAL */}
        {catModal && (
          <CatModal cats={cats} onSave={setCats} onClose={()=>setCatModal(false)}/>
        )}
      </div>
    </>
  );
}

function HabitModal({ mode, habit, cats, onSave, onDelete, onClose }) {
  const [name,    setName]    = useState(habit?.name  ?? "");
  const [icon,    setIcon]    = useState(habit?.icon  ?? "📚");
  const [color,   setColor]   = useState(habit?.color ?? PALETTE[0]);
  const [catId,   setCatId]   = useState(habit?.catId ?? (cats[0]?.id ?? ""));
  const [confirm, setConfirm] = useState(false);

  function save() { if (!name.trim()) return; onSave({ ...(habit||{}), name:name.trim(), icon, color, catId }); }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal bottom-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-drag"/>
        <div className="modal-title">{mode==="add"?"새 습관 추가":"습관 수정"}</div>
        <div className="field-label">아이콘</div>
        <div className="icon-grid">
          {ICONS.map(ic=><button key={ic} className={`icon-pick${icon===ic?" sel":""}`} onClick={()=>setIcon(ic)}>{ic}</button>)}
        </div>
        <div className="field-label">이름</div>
        <input className="text-input" value={name} onChange={e=>setName(e.target.value)} placeholder="습관 이름"/>
        <div className="field-label">색상</div>
        <div className="color-row">
          {PALETTE.map(c=><button key={c} className={`color-chip${color===c?" sel":""}`} style={{background:c}} onClick={()=>setColor(c)}/>)}
        </div>
        <div className="field-label">카테고리</div>
        <div className="cat-row">
          {cats.map(c=><button key={c.id} className={`cat-chip${catId===c.id?" sel":""}`} style={catId===c.id?{background:c.color,color:"#fff",borderColor:c.color}:{}} onClick={()=>setCatId(c.id)}>{c.name}</button>)}
          <button className={`cat-chip${catId===""?" sel":""}`} onClick={()=>setCatId("")}>미분류</button>
        </div>
        <button className="primary-btn" onClick={save}>저장</button>
        {mode==="edit" && !confirm && <button className="delete-btn" onClick={()=>setConfirm(true)}>삭제</button>}
        {confirm && (
          <div className="confirm-row">
            <span className="confirm-text">정말 삭제할까요?</span>
            <button className="del-yes" onClick={()=>onDelete(habit.id)}>삭제</button>
            <button className="del-no"  onClick={()=>setConfirm(false)}>취소</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CatModal({ cats, onSave, onClose }) {
  const [list,     setList]     = useState(cats.map(c=>({...c})));
  const [newName,  setNewName]  = useState("");
  const [newColor, setNewColor] = useState(PALETTE[4]);

  function addCat() { if (!newName.trim()) return; setList(p=>[...p,{id:uid(),name:newName.trim(),color:newColor}]); setNewName(""); }
  function save()   { onSave(list); onClose(); }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal bottom-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-drag"/>
        <div className="modal-title">카테고리 관리</div>
        {list.map(c=>(
          <div key={c.id} className="cat-edit-row">
            <span className="cat-dot big" style={{background:c.color}}/>
            <span className="cat-edit-name">{c.name}</span>
            <button className="cat-del-btn" onClick={()=>setList(p=>p.filter(x=>x.id!==c.id))}>✕</button>
          </div>
        ))}
        <div className="field-label" style={{marginTop:16}}>새 카테고리</div>
        <input className="text-input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="카테고리 이름"/>
        <div className="color-row" style={{marginTop:10}}>
          {PALETTE.map(c=><button key={c} className={`color-chip${newColor===c?" sel":""}`} style={{background:c}} onClick={()=>setNewColor(c)}/>)}
        </div>
        <button className="secondary-btn" onClick={addCat}>추가</button>
        <button className="primary-btn" style={{marginTop:8}} onClick={save}>저장</button>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{background:#ffffff;}

.app{min-height:100vh;background:#ffffff;font-family:'Noto Sans KR',sans-serif;max-width:430px;margin:0 auto;display:flex;flex-direction:column;}

/* TOP BAR */
.topbar{background:#ffffff;padding:52px 20px 10px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;border-bottom:1px solid #F2F2F7;}
.topbar-title{font-size:20px;font-weight:600;color:#1C1C1E;display:flex;align-items:center;gap:6px;}
.topbar-sub{font-size:14px;font-weight:400;color:#8E8E93;}
.topbar-actions{display:flex;align-items:center;gap:4px;}
.icon-btn{height:32px;padding:0 10px;border-radius:16px;border:none;background:transparent;color:#3C8CE4;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:'Noto Sans KR',sans-serif;}
.icon-btn.small{font-size:12px;}
.icon-btn.accent{background:#1C1C1E;color:#fff;font-size:18px;width:32px;height:32px;padding:0;border-radius:50%;}

/* TABS */
.tabbar{display:flex;padding:10px 20px;gap:6px;background:#ffffff;}
.tab{padding:6px 14px;border-radius:20px;border:none;font-family:'Noto Sans KR',sans-serif;font-size:12px;font-weight:500;cursor:pointer;background:#F2F2F7;color:#6B6B70;transition:all 0.15s;}
.tab.active{background:#1C1C1E;color:#fff;}
.cat-tab{margin-left:auto;background:transparent;color:#3C8CE4;font-size:12px;}

.divider{height:1px;background:#F2F2F7;margin:0 20px;}
.scroll-area{flex:1;overflow-y:auto;padding-bottom:90px;background:#ffffff;}

/* DATE STRIP */
.date-strip{display:flex;gap:4px;padding:14px 20px;overflow-x:auto;scrollbar-width:none;background:#ffffff;}
.date-strip::-webkit-scrollbar{display:none;}
.dc{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 10px;border-radius:14px;cursor:pointer;min-width:44px;border:none;background:transparent;flex-shrink:0;font-family:'Noto Sans KR',sans-serif;transition:all 0.15s;}
.dc.sel{background:#1C1C1E;}
.dc.tod:not(.sel){background:#F2F2F7;}
.dc-day{font-size:10px;font-weight:500;color:#8E8E93;}
.dc.sel .dc-day{color:#fff;}
.dc-num{font-size:18px;font-weight:300;color:#1C1C1E;}
.dc.sel .dc-num{color:#fff;}
.dc-dot{width:5px;height:5px;border-radius:50%;background:transparent;}
.dc-dot.on{background:#3C8CE4;}
.dc.sel .dc-dot.on{background:#fff;}

/* DAILY HEADER */
.daily-header{padding:16px 20px 0;background:#ffffff;}
.daily-date-row{display:flex;align-items:baseline;gap:8px;margin-bottom:4px;}
.daily-big{font-size:30px;font-weight:300;color:#1C1C1E;line-height:1;}
.daily-sub{font-size:13px;color:#8E8E93;}
.prog-row{display:flex;align-items:center;gap:10px;margin-top:10px;}
.prog-bar{flex:1;height:4px;background:#F2F2F7;border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;border-radius:2px;background:#3C8CE4;transition:width 0.4s ease;}
.prog-label{font-size:11px;color:#8E8E93;min-width:50px;text-align:right;}

/* CATEGORY GROUP */
.cat-group{padding:14px 20px 0;}
.cat-label{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#8E8E93;letter-spacing:0.3px;margin-bottom:8px;text-transform:uppercase;}
.cat-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.cat-dot.big{width:12px;height:12px;}

/* HABIT CARD */
.hcard{background:#ffffff;border-radius:16px;margin-bottom:8px;display:flex;align-items:stretch;border:1.5px solid #F2F2F7;overflow:hidden;transition:border-color 0.18s;}
.hcard.done{border-color:#E8E8ED;}
.hcard-left{flex:1;display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;}
.hcard-left:active{opacity:0.7;}
.hcard-actions{display:flex;flex-direction:column;border-left:1px solid #F2F2F7;}
.hact-btn{flex:1;padding:0 13px;border:none;background:transparent;font-size:15px;cursor:pointer;color:#8E8E93;transition:background 0.15s;}
.hact-btn:hover{background:#F9F9F9;}
.hpill{width:7px;height:38px;border-radius:4px;flex-shrink:0;transition:opacity 0.2s;}
.hcard:not(.done) .hpill{opacity:0.3;}
.hemoji{font-size:24px;flex-shrink:0;}
.hinfo{flex:1;}
.hname{font-size:15px;font-weight:500;color:#1C1C1E;}
.hstatus{font-size:11px;color:#C7C7CC;margin-top:2px;}
.hstatus.done{color:#3C8CE4;}
.hcheck{width:24px;height:24px;border-radius:50%;border:1.8px solid #D1D1D6;background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;}
.hcheck.done{background:#3C8CE4;border-color:#3C8CE4;}

/* EMPTY */
.empty-hint{text-align:center;padding:40px 20px;color:#8E8E93;font-size:14px;}
.empty-hint.small{padding:12px;font-size:13px;}

/* MONTHLY */
.mday-headers{display:grid;grid-template-columns:repeat(7,1fr);padding:12px 16px 4px;}
.mday-h{text-align:center;font-size:11px;color:#8E8E93;font-weight:500;padding:2px 0;}
.mgrid{display:grid;grid-template-columns:repeat(7,1fr);padding:0 16px;gap:2px;}
.empty-c{aspect-ratio:1;}
.mcell{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;border-radius:12px;border:none;background:transparent;font-family:'Noto Sans KR',sans-serif;transition:background 0.15s;}
.mcell:hover{background:#F2F2F7;}
.mcell.sel{background:#1C1C1E!important;}
.mcell.tod:not(.sel){background:#F2F2F7;}
.mcell-n{font-size:13px;font-weight:400;color:#1C1C1E;line-height:1;}
.mcell.sel .mcell-n{color:#fff!important;}
.mcell.sun .mcell-n{color:#FF3B30;}
.mcell.sat .mcell-n{color:#3C8CE4;}
.mcell-dots{display:flex;gap:2px;}
.mcdot{width:4px;height:4px;border-radius:50%;opacity:0.2;}
.mcdot.on{opacity:1;}
.mcell.sel .mcdot.on{background:#fff!important;}

/* DAY DETAIL */
.day-detail{margin:12px 20px 0;background:#ffffff;border-radius:18px;padding:16px 18px;border:1.5px solid #F2F2F7;}
.dd-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.dd-title{font-size:15px;font-weight:600;color:#1C1C1E;}
.dd-count{font-size:12px;color:#8E8E93;}
.dd-habits{display:flex;flex-direction:column;gap:8px;}
.dd-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#F9F9F9;cursor:pointer;border:none;width:100%;font-family:'Noto Sans KR',sans-serif;text-align:left;transition:all 0.15s;}
.dd-row:active{transform:scale(0.98);}
.dd-pill{width:6px;height:26px;border-radius:3px;flex-shrink:0;}
.dd-row:not(.done) .dd-pill{opacity:0.3;}
.dd-name{flex:1;font-size:14px;color:#1C1C1E;}
.dd-check{width:22px;height:22px;border-radius:50%;border:1.5px solid #D1D1D6;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;}
.dd-check.done{background:#3C8CE4;border-color:#3C8CE4;}


/* OVERLAY */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:50;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:#ffffff;border-radius:24px 24px 0 0;padding:12px 20px 36px;width:100%;max-width:430px;max-height:90vh;overflow-y:auto;}
.modal-drag{width:40px;height:4px;background:#E5E5EA;border-radius:2px;margin:0 auto 16px;}
.modal-title{font-size:18px;font-weight:600;color:#1C1C1E;margin-bottom:20px;}

/* DETAIL MODAL */
.detail-modal{padding:12px 20px 40px;}
.detail-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;}
.detail-emoji{font-size:36px;line-height:1;}
.detail-hname{font-size:20px;font-weight:600;color:#1C1C1E;margin-top:4px;}
.close-btn{border:none;background:#F2F2F7;border-radius:50%;width:32px;height:32px;font-size:14px;cursor:pointer;color:#666;flex-shrink:0;}
.detail-stats{display:flex;gap:10px;margin-bottom:20px;}
.dstat{flex:1;background:#F9F9F9;border-radius:14px;padding:12px;text-align:center;border:1px solid #F2F2F7;}
.dstat-val{font-size:18px;font-weight:600;color:#1C1C1E;}
.dstat-lbl{font-size:10px;color:#8E8E93;margin-top:2px;}
.detail-month-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.detail-month-label{font-size:15px;font-weight:600;color:#1C1C1E;}
.detail-day-headers{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px;}
.detail-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.dg-empty{aspect-ratio:1;}
.dg-cell{aspect-ratio:1;border-radius:10px;border:none;background:#F2F2F7;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;font-family:'Noto Sans KR',sans-serif;}
.dg-cell.done{box-shadow:0 2px 6px rgba(0,0,0,0.12);}
.dg-cell.tod{box-shadow:0 0 0 2px #3C8CE4;}
.dg-num{font-size:11px;color:#8E8E93;font-weight:400;}

/* FORM */
.field-label{font-size:11px;font-weight:600;color:#8E8E93;letter-spacing:0.5px;margin:14px 0 8px;text-transform:uppercase;}
.icon-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-bottom:4px;}
.icon-pick{font-size:22px;aspect-ratio:1;border-radius:10px;border:2px solid transparent;background:#F2F2F7;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;}
.icon-pick.sel{border-color:#1C1C1E;background:#E8E8ED;}
.text-input{width:100%;padding:12px 14px;border-radius:12px;border:1.5px solid #E5E5EA;font-family:'Noto Sans KR',sans-serif;font-size:15px;color:#1C1C1E;background:#ffffff;outline:none;}
.text-input:focus{border-color:#3C8CE4;}
.color-row{display:flex;gap:8px;flex-wrap:wrap;}
.color-chip{width:30px;height:30px;border-radius:50%;border:3px solid transparent;cursor:pointer;transition:all 0.15s;}
.color-chip.sel{border-color:#1C1C1E;transform:scale(1.15);}
.cat-row{display:flex;gap:8px;flex-wrap:wrap;}
.cat-chip{padding:7px 14px;border-radius:20px;border:1.5px solid #E5E5EA;background:#ffffff;font-family:'Noto Sans KR',sans-serif;font-size:13px;color:#1C1C1E;cursor:pointer;transition:all 0.15s;}
.cat-chip.sel{background:#1C1C1E;color:#fff;border-color:#1C1C1E;}
.primary-btn{width:100%;margin-top:20px;padding:14px;background:#1C1C1E;color:#fff;border:none;border-radius:14px;font-family:'Noto Sans KR',sans-serif;font-size:16px;font-weight:600;cursor:pointer;}
.secondary-btn{width:100%;margin-top:10px;padding:12px;background:#F2F2F7;color:#1C1C1E;border:none;border-radius:14px;font-family:'Noto Sans KR',sans-serif;font-size:15px;font-weight:500;cursor:pointer;}
.delete-btn{width:100%;margin-top:8px;padding:13px;background:transparent;color:#FF3B30;border:1.5px solid #FFCDD2;border-radius:14px;font-family:'Noto Sans KR',sans-serif;font-size:15px;cursor:pointer;}
.confirm-row{display:flex;align-items:center;gap:8px;margin-top:8px;}
.confirm-text{flex:1;font-size:13px;color:#FF3B30;}
.del-yes{padding:8px 16px;background:#FF3B30;color:#fff;border:none;border-radius:10px;font-family:'Noto Sans KR',sans-serif;cursor:pointer;}
.del-no{padding:8px 16px;background:#F2F2F7;color:#1C1C1E;border:none;border-radius:10px;font-family:'Noto Sans KR',sans-serif;cursor:pointer;}
.cat-edit-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F2F2F7;}
.cat-edit-name{flex:1;font-size:14px;color:#1C1C1E;}
.cat-del-btn{border:none;background:#F2F2F7;border-radius:50%;width:26px;height:26px;font-size:12px;cursor:pointer;color:#666;}
`;