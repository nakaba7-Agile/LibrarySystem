// progressupdate.js
// 進捗(100%未満)の本を表示し、スライダーで自動保存。
// 100%になった瞬間に date=今日 を付けて PATCH → ランキングへ再集計依頼。

(() => {
  'use strict';

  // ===== 設定 =====
  const API_HOME = "http://localhost:4000"; // json-server
  const MY_USER_ID_HOME = parseInt(localStorage.getItem('loginUserId')); // ← search.js と同じ取得方法
  const DEBUG_PROGRESS = false;

  // ===== Utils =====
  const pad  = n => String(n).padStart(2,"0");
  const $    = sel => document.querySelector(sel);
  const html = (s,...v)=> s.map((x,i)=>x+(v[i]??"")).join("");
  const debounce = (fn,ms=400)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once:true });
    } else {
      fn();
    }
  };

  const ymOf = s => { const d=new Date(s); return isNaN(d)?null:`${d.getFullYear()}-${pad(d.getMonth()+1)}`; };
  const monthToRangeHome = ym => {
    const d = ym ? new Date(ym+"-01") : new Date();
    const y=d.getFullYear(), m=d.getMonth();
    const s=new Date(y,m,1), e=new Date(y,m+1,0);
    return { start:`${s.getFullYear()}-${pad(s.getMonth()+1)}-${pad(s.getDate())}`,
             end:`${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}` };
  };
  const betweenHome = (dateStr,s,e)=>{
    if(!s && !e) return true;
    const dt=new Date(dateStr);
    return (!s || dt >= new Date(s)) && (!e || dt <= new Date(e+"T23:59:59.999"));
  };

  // ランキング iframe に今月冊数の再集計を依頼
  const requestMonthlyCountFromRanking = ()=> {
    const f=document.getElementById("rankingFrame");
    try { f?.contentWindow?.postMessage({ type:"request-monthly-count" },"*"); } catch(_){}
  };

  // ===== ランキング iframe からの月追従 =====
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

  // ===== 初期描画（フォールバック：直近未完了 → 当月） =====
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

  // DOMContentLoaded 済みでも必ず初期描画される
  ready(async () => {
    const ym = await decideYMForSidebar(null);
    renderInProgressArea(ym);
  });

  // ===== PATCH（404回避ロジック付き） =====
  async function patchReadingById(rawId, payload){
    const asNum = Number(rawId);
    const body = JSON.stringify(payload);

    if (Number.isFinite(asNum)) {
      const r1 = await fetch(`${API_HOME}/readings/${asNum}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (r1.ok) return;
      if (r1.status !== 404) throw new Error(`PATCH failed (${r1.status})`);
    }

    const found = await fetch(`${API_HOME}/readings?id=${encodeURIComponent(String(rawId))}`).then(r=>r.json());
    if (Array.isArray(found) && found[0] && found[0].id != null) {
      const realId = found[0].id;
      const r2 = await fetch(`${API_HOME}/readings/${encodeURIComponent(String(realId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (r2.ok) return;
    }
    throw new Error("PATCH failed (not found)");
  }

  // ===== 進捗(100未満)一覧の描画 =====
  async function renderInProgressArea(ym){
    const area = $("#inProgressArea");
    if(!area) return;

    const useYM = ym || await decideYMForSidebar(null);
    const { start, end } = monthToRangeHome(useYM);
    if (DEBUG_PROGRESS) console.log("[progress] render ym=", useYM, "range=", start, end);

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
        const img=row.book?.image || "images/noimage.png";
        const title=row.book?.title || "（タイトル不明）";
        const prog=Number(row.progress??0);
        return html`
          <div class="inprog-card" data-id="${row.id}">
            <img class="inprog-cover" src="${img}" alt="">
            <div class="inprog-right">
              <div class="inprog-title" title="${title}">${title}</div>

              <div class="inprog-barrow">
                <input class="progress-input" type="range" min="0" max="100" step="1" value="${prog}">
              </div>

              <div class="inprog-actions">
                <span class="progress-num">${prog}%</span>
                <button class="btn-ghost js-done">読んだ！</button>
              </div>

              <span class="save-status" role="status" aria-live="polite"></span>
            </div>
          </div>
        `;
      }).join("");

      area.querySelectorAll(".inprog-card").forEach((node,i)=>{ node.__row = list[i]; node.__idRaw = list[i].id; });

      bindRowEvents(area);

    }catch(err){
      console.error(err);
      area.innerHTML = `<div style="color:#c00;">進捗データの取得に失敗しました</div>`;
    }
  }

  // ===== 行イベント =====
  function bindRowEvents(area){
    area.querySelectorAll(".inprog-card").forEach(row=>{
      const slider = row.querySelector(".progress-input");
      const num    = row.querySelector(".progress-num");
      const btnDone= row.querySelector(".js-done");
      const status = row.querySelector(".save-status");

      let lastSaved = Number(slider.value);
      let saving = false;

      const setStatus = (text) => { if (status) status.textContent = text || ""; };

      const doSave = async (v) => {
        try{
          saving = true;
          slider.disabled = true;

          const today = new Date();
          const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

          const payload = (v >= 100)
            ? { progress: Number(v), date: todayStr }
            : { progress: Number(v) };

          setStatus("保存中…");

          if(v >= 100) showToast("「読んだ本」に登録しました");

          setTimeout(async () => {
            await patchReadingById(row.__idRaw, payload);
            location.reload(); // ページをリロードして最新情報を表示
          }, 1500);

          lastSaved = v;
          setStatus("保存済み ✔");

          if (v >= 100){
            row.classList.add("row-fade");
            setTimeout(()=>{
              row.remove();
              if (!area.querySelector(".inprog-card")) {
                area.innerHTML = `<div class="muted">（進行中の本はありません）</div>`;
              }
              requestMonthlyCountFromRanking();
            }, 220);
          }else{
            row.classList.add("row-done");
            setTimeout(()=>row.classList.remove("row-done"), 220);
          }

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

      const debouncedSave = (() => {
        let t;
        return (v) => {
          clearTimeout(t);
          t = setTimeout(()=>doSave(v), 700);
        };
      })();

      const onSlide = ()=>{
        const v = Number(slider.value);
        num.textContent = `${v}%`;
        setStatus(v === lastSaved ? "" : "未保存の変更…");
        debouncedSave(v);
      };

      slider.addEventListener("input", onSlide);

      btnDone.addEventListener("click", ()=>{
        if (saving) return;
        slider.value = "100";
        num.textContent = "100%";
        doSave(100);
      });
    });
  }

  // 公開
  window.renderInProgressArea = renderInProgressArea;
  window.getCurrentYMForSidebar = () => currentYMFromRanking;
})();
