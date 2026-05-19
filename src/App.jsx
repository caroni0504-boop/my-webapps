import { useState } from "react";
import HabitTracker from "./HabitTracker";
import EisenhowerMatrix from "./EisenhowerMatrix";

export default function App() {
  const [tab, setTab] = useState("habit");

  return (
    <div style={{maxWidth:430,margin:"0 auto",height:"100vh",display:"flex",flexDirection:"column",background:"#fff",overflow:"hidden"}}>
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden"}}>
        <div style={{display:tab==="habit"?"block":"none"}}><HabitTracker/></div>
        <div style={{display:tab==="matrix"?"block":"none"}}><EisenhowerMatrix/></div>
      </div>
      <div style={{height:60,flexShrink:0,display:"flex",borderTop:"1px solid #F2F2F7",background:"#fff"}}>
        {[["habit","📋","습관"],["matrix","⊞","매트릭스"]].map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{flex:1,border:"none",background:"transparent",padding:"6px 0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:22,filter:tab===id?"none":"grayscale(1) opacity(0.35)"}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:500,color:tab===id?"#1C1C1E":"#8E8E93"}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}