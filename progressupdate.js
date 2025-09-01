// progressupdate.js
// 進捗(100%未満)の本を「編集できるバー+スライダー」で表示し、PATCHで更新
(() => {
  'use strict';

  // ===== 設定 =====
  const API_HOME = "http://localhost:4000"; // json-server
  const MY_USER_ID_HOME = 6;                // ログインユーザー（窓辺あかり）
  const DEBUG_PROGRESS = false;

  // ===== Utils =====
  const pad = n => String(n).padStart(2,"0");
  const $  = sel => document.querySelector(sel);
  const html = (s,...v)=> s.map((x,i)=>x+(v[i]??"")).join("");
  const debounce = (fn,ms=400)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

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

  // ランキング iframe へ再集計依頼
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
  document.addEventListener("DOMContentLoaded", async ()=>{
    const ym = await decideYMForSidebar(null);
    renderInProgressArea(ym);
  });

  // ===== 数値IDで PATCH するだけの安全版 =====
  async function patchProgressById(rawId, progress){
    const idNum = Number(rawId);
    if (!Number.isFinite(idNum)) throw new Error("invalid id");
    const res = await fetch(`${API_HOME}/readings/${idNum}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress })   // ← ボディに id を含めない
    });
    if (!res.ok) throw new Error(`PATCH failed (${res.status})`);
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
        const idNum=Number(row.id);     // ← 数値化して保持
        return html`
          <div class="inprog-row" data-id="${idNum}">
            <img class="inprog-cover" src="${img}" alt="">
            <div class="inprog-main">
              <div class="inprog-title" title="${title}">${title}</div>
              <div class="inprog-editor">
                <div class="progress-track" aria-hidden="true">
                  <div class="progress-fill" style="transform:scaleX(${prog/100});"></div>
                </div>
                <input class="progress-input" type="range" min="0" max="100" step="1" value="${prog}">
                <span class="progress-num">${prog}%</span>
                <button class="btn-ghost js-done">100%にする</button>
                <button class="btn-ghost js-save" disabled>保存</button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      // 生成DOMに行データをアタッチ
      const nodes = area.querySelectorAll(".inprog-row");
      nodes.forEach((node,i)=>{ node.__row = list[i]; node.__idNum = Number(list[i].id); });

      bindRowEvents(area);

    }catch(err){
      console.error(err);
      area.innerHTML = `<div style="color:#c00;">進捗データの取得に失敗しました</div>`;
    }
  }

  // ===== 行イベント（スライダー→保存） =====
  function bindRowEvents(area){
    area.querySelectorAll(".inprog-row").forEach(row=>{
      const slider = row.querySelector(".progress-input");
      const num    = row.querySelector(".progress-num");
      const fill   = row.querySelector(".progress-fill");
      const btnSave= row.querySelector(".js-save");
      const btnDone= row.querySelector(".js-done");

      let lastSaved = Number(slider.value);
      const enableSave = ()=> btnSave.disabled = (Number(slider.value) === lastSaved);

      const onSlide = ()=>{
        const v = Number(slider.value);
        num.textContent = `${v}%`;
        fill.style.transform = `scaleX(${v/100})`;
        enableSave();
        debouncedAutoSave();
      };

      slider.addEventListener("input", onSlide);

      btnDone.addEventListener("click", ()=>{
        slider.value = "100";
        onSlide();
        btnSave.click();
      });

      btnSave.addEventListener("click", async ()=>{
        const v = Number(slider.value);
        try{
          btnSave.disabled = true;

          // ★ PATCH のみ／数値ID固定
          await patchProgressById(row.__idNum, v);

          lastSaved = v;

          if (v >= 100){
            row.classList.add("row-fade");
            setTimeout(()=>{
              row.remove();
              if (!area.querySelector(".inprog-row")) {
                area.innerHTML = `<div class="muted">（進行中の本はありません）</div>`;
              }
            }, 250);
          } else {
            row.classList.add("row-done");
            setTimeout(()=>row.classList.remove("row-done"), 250);
          }

          requestMonthlyCountFromRanking();

        }catch(e){
          console.error(e);
          alert("保存に失敗しました");
          btnSave.disabled = false;
        }
      });

      const debouncedAutoSave = debounce(()=>{
        if (!btnSave.disabled) btnSave.click();
      }, 800);
    });
  }

  // 他スクリプトから呼べるように公開
  window.renderInProgressArea = renderInProgressArea;
  window.getCurrentYMForSidebar = () => currentYMFromRanking;
})();
