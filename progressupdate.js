// progressupdate.js
// タイトルは小さめで2行まで改行可、バーは1行、次の行に「%＋読んだ！」横並び
// スライダー停止後に自動保存、100%で行を消す & ランキング冊数を更新

(() => {
  'use strict';

  const API_HOME = "http://localhost:4000";
  const MY_USER_ID_HOME = 6;
  const DEBUG_PROGRESS = false;

  const pad = n => String(n).padStart(2,"0");
  const $ = sel => document.querySelector(sel);
  const html = (s,...v)=> s.map((x,i)=>x+(v[i]??"")).join("");

  const ymOf = s => { const d=new Date(s); return isNaN(d)?null:`${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
  const monthToRangeHome = ym => {
    const d = ym ? new Date(`${ym}-01`) : new Date();
    const y=d.getFullYear(), m=d.getMonth();
    const s=new Date(y,m,1), e=new Date(y,m+1,0);
    return {
      start:`${s.getFullYear()}-${pad(s.getMonth()+1)}-${pad(s.getDate())}`,
      end  :`${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}`
    };
  };
  const betweenHome = (dateStr,s,e)=>{
    if(!s && !e) return true;
    const dt=new Date(dateStr);
    return (!s || dt >= new Date(s)) && (!e || dt <= new Date(e+"T23:59:59.999"));
  };

  const requestMonthlyCountFromRanking = ()=>{
    const f=document.getElementById("rankingFrame");
    try { f?.contentWindow?.postMessage({ type:"request-monthly-count" },"*"); } catch(_){}
  };

  /* ===== ランキング iframe からの月追従 ===== */
  let currentYMFromRanking = null;
  window.addEventListener("message",(e)=>{
    const data=e?.data;
    if(!data || typeof data!=="object") return;
    if(data.type==="monthly-count" || data.type==="month-change"){
      currentYMFromRanking = data.ym || null;
      if (DEBUG_PROGRESS) console.log("[progress] recv", data);
      renderInProgressArea(currentYMFromRanking);
    }
  });

  document.addEventListener("DOMContentLoaded", async ()=>{
    const ym = await decideYMForSidebar(null);
    renderInProgressArea(ym);
  });

  async function decideYMForSidebar(fallbackYM=null){
    if(currentYMFromRanking) return currentYMFromRanking;
    if(fallbackYM) return fallbackYM;
    try{
      const readings = await fetch(`${API_HOME}/readings`).then(r=>r.json());
      const mine = readings
        .filter(r=> String(r.userId)===String(MY_USER_ID_HOME) && Number(r.progress??0)<100)
        .sort((a,b)=> new Date(b.date)-new Date(a.date));
      if(mine[0]){ const ym=ymOf(mine[0].date); if(ym) return ym; }
    }catch(_){}
    const t=new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}`;
  }

  /* ===== PATCH（404フォールバック: ?id= 検索） ===== */
  async function patchProgressById(rawId, progress){
    const body = JSON.stringify({ progress: Number(progress) });

    const asNum = Number(rawId);
    if (Number.isFinite(asNum)) {
      const res = await fetch(`${API_HOME}/readings/${asNum}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (res.ok) return;
      if (res.status !== 404) throw new Error(`PATCH failed (${res.status})`);
    }

    const found = await fetch(`${API_HOME}/readings?id=${encodeURIComponent(String(rawId))}`).then(r=>r.json());
    if (Array.isArray(found) && found[0] && found[0].id != null) {
      const realId = found[0].id;
      const res2 = await fetch(`${API_HOME}/readings/${encodeURIComponent(String(realId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (res2.ok) return;
    }
    throw new Error("PATCH failed (not found)");
  }

  /* ===== 描画 ===== */
  async function renderInProgressArea(ym){
    const area = $("#inProgressArea");
    if(!area) return;

    const useYM = ym || await decideYMForSidebar(null);
    const { start, end } = monthToRangeHome(useYM);

    try{
      const [readings, books] = await Promise.all([
        fetch(`${API_HOME}/readings`).then(r=>r.json()),
        fetch(`${API_HOME}/books`).then(r=>r.json()).catch(()=>[])
      ]);

      const list = readings
        .filter(r => String(r.userId)===String(MY_USER_ID_HOME)
                  && betweenHome(r.date, start, end)
                  && Number(r.progress??0) < 100)
        .map(r => ({ ...r, book: books.find(b => String(b.id)===String(r.bookId)) || {} }))
        .sort((a,b)=> (a.book?.title||"").localeCompare(b.book?.title||"","ja"));

      if (!list.length){
        area.innerHTML = `<div class="muted">（進行中の本はありません）</div>`;
        return;
      }

      area.innerHTML = list.map(row=>{
        const img   = row.book?.image || "images/noimage.png";
        const title = row.book?.title || "（タイトル不明）";
        const prog  = Number(row.progress ?? 0);
        return html`
          <div class="inprog-card" data-id="${row.id}">
            <img class="inprog-cover" src="${img}" alt="">
            <div class="inprog-right">
              <div class="inprog-title" title="${title}">${title}</div>

              <!-- 1行目：バーのみ -->
              <div class="inprog-barrow">
                <input class="progress-input" type="range" min="0" max="100" step="1" value="${prog}">
              </div>

              <!-- 2行目：% と 読んだ！ -->
              <div class="inprog-actions">
                <span class="progress-num">${prog}%</span>
                <button class="btn-ghost js-done">読んだ！</button>
              </div>

              <span class="save-status" role="status" aria-live="polite"></span>
            </div>
          </div>
        `;
      }).join("");

      // 行データ保持
      area.querySelectorAll(".inprog-card").forEach((node,i)=>{ node.__row = list[i]; node.__idRaw = list[i].id; });

      bindRowEvents(area);

    }catch(err){
      console.error(err);
      area.innerHTML = `<div style="color:#c00;">進捗データの取得に失敗しました</div>`;
    }
  }

  /* ===== 行イベント ===== */
  function bindRowEvents(area){
    area.querySelectorAll(".inprog-card").forEach(row=>{
      const slider = row.querySelector(".progress-input");
      const num    = row.querySelector(".progress-num");
      const btn    = row.querySelector(".js-done");
      const status = row.querySelector(".save-status");

      let lastSaved = Number(slider.value);
      let saving = false;

      const setStatus = t => { if (status) status.textContent = t || ""; };

      let timer;
      const queueSave = (v)=>{
        clearTimeout(timer);
        timer = setTimeout(async ()=>{ await doSave(v); }, 700);
      };

      const doSave = async (v)=>{
        try{
          saving = true;
          slider.disabled = true;
          setStatus("保存中…");
          await patchProgressById(row.__idRaw, v);
          lastSaved = v;
          setStatus("保存済み ✔");

          if (v >= 100){
            row.classList.add("row-fade");
            setTimeout(()=>{
              row.remove();
              if (!area.querySelector(".inprog-card")){
                area.innerHTML = `<div class="muted">（進行中の本はありません）</div>`;
              }
            }, 220);
          }
          requestMonthlyCountFromRanking();
        }catch(e){
          console.error(e);
          setStatus("保存失敗。再試行してください");
          slider.value = String(lastSaved);
          num.textContent = `${lastSaved}%`;
        }finally{
          saving = false;
          slider.disabled = false;
        }
      };

      // スライダー
      slider.addEventListener("input", ()=>{
        const v = Number(slider.value);
        num.textContent = `${v}%`;
        setStatus(v === lastSaved ? "" : "未保存の変更…");
        queueSave(v);
      });

      // 「読んだ！」 = 100% にして保存
      btn.addEventListener("click", ()=>{
        if (saving) return;
        slider.value = "100";
        num.textContent = "100%";
        setStatus("未保存の変更…");
        queueSave(100);
      });
    });
  }

  // 公開
  window.renderInProgressArea = renderInProgressArea;
  window.getCurrentYMForSidebar = () => currentYMFromRanking;
})();
