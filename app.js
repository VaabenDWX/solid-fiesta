(() => {
  "use strict";

  const state = {
    allEntries: [],
    sets: [],
    queue: [],
    total: 0,
    current: null,
    hasAnswered: false,
    score: 0,
    answered: 0,
    setLabel: "",
    quizLength: 25,
  };

  const el = {
    screenPicker: document.getElementById("screenPicker"),
    screenQuiz: document.getElementById("screenQuiz"),
    screenResults: document.getElementById("screenResults"),
    setList: document.getElementById("setList"),
    lengthToggle: document.getElementById("lengthToggle"),
    lengthDesc: document.getElementById("lengthDesc"),
    randomSetBtn: document.getElementById("randomSetBtn"),
    cardStage: document.getElementById("cardStage"),
    statScore: document.getElementById("statScore"),
    statSet: document.getElementById("statSet"),
    statProgress: document.getElementById("statProgress"),
    logposeNeedle: document.getElementById("logposeNeedle"),
    nextBtn: document.getElementById("nextBtn"),
    quitBtn: document.getElementById("quitBtn"),
    resultsScore: document.getElementById("resultsScore"),
    resultsLine: document.getElementById("resultsLine"),
    restartBtn: document.getElementById("restartBtn"),
    newSetBtn: document.getElementById("newSetBtn"),
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function showScreen(name) {
    el.screenPicker.hidden = name !== "picker";
    el.screenQuiz.hidden = name !== "quiz";
    el.screenResults.hidden = name !== "results";
  }

  // ---------- Picker screen ----------
  function setSortKey(code) {
    if (code === "General") return [0, 0];
    const m = code.match(/^([A-Z]+)(\d+)/);
    if (!m) return [9, 0, code];
    const groupOrder = { OP: 1, ST: 2, EB: 3, PRB: 4 };
    const group = groupOrder[m[1]] ?? 5;
    return [group, parseInt(m[2], 10)];
  }

  function renderPicker() {
    el.setList.innerHTML = "";
    const sortedSets = state.sets.slice().sort((a, b) => {
      const ka = setSortKey(a.code), kb = setSortKey(b.code);
      return ka[0] - kb[0] || ka[1] - kb[1];
    });
    sortedSets.forEach(s => {
      const count = state.allEntries.filter(e => e.setCode === s.code).length;
      if (count === 0) return;
      const btn = document.createElement("button");
      btn.className = "set-btn";
      btn.type = "button";
      btn.innerHTML = `<span class="set-btn-name">${escapeHtml(s.name)}</span><span class="set-btn-count">${count} rulings</span>`;
      btn.addEventListener("click", () => startQuiz(s.code, s.name));
      el.setList.appendChild(btn);
    });
  }

  el.lengthToggle.addEventListener("click", (evt) => {
    const btn = evt.target.closest(".length-btn");
    if (!btn) return;
    state.quizLength = btn.dataset.length === "all" ? Infinity : parseInt(btn.dataset.length, 10);
    Array.from(el.lengthToggle.children).forEach(b => b.classList.toggle("is-active", b === btn));
    el.lengthDesc.textContent = btn.title;
  });

  el.randomSetBtn.addEventListener("click", () => startQuiz(null, "Random Mix"));

  // ---------- Quiz flow ----------
  function startQuiz(setCode, label) {
    const pool = setCode ? state.allEntries.filter(e => e.setCode === setCode) : state.allEntries;
    state.queue = shuffle(pool).slice(0, state.quizLength);
    state.total = state.queue.length;
    state.score = 0;
    state.answered = 0;
    state.setLabel = label;
    state.currentSetCode = setCode;
    el.statSet.textContent = label;
    showScreen("quiz");
    nextCard();
  }

  function updateStats() {
    el.statScore.textContent = `${state.score} / ${state.answered}`;
    const shown = state.total - state.queue.length;
    el.statProgress.textContent = `${shown} / ${state.total}`;
    const pct = state.total ? shown / state.total : 0;
    el.logposeNeedle.style.transform = `translate(-50%,-100%) rotate(${pct * 340 - 170}deg)`;
  }

  function nextCard() {
    if (state.queue.length === 0) {
      showResults();
      return;
    }
    state.current = state.queue.pop();
    state.hasAnswered = false;
    el.nextBtn.disabled = true;
    renderCard();
    updateStats();
  }

  function renderCard() {
    const e = state.current;
    const cardIdLabel = e.cardId && e.cardId !== "General"
      ? `${e.cardId}${e.cardName ? " — " + e.cardName : ""}`
      : "General Rules";

    const card = document.createElement("div");
    card.className = "faq-card";

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const cardLinkHtml = e.cardId && e.cardId !== "General"
      ? `<a class="card-id" href="https://onepiece.limitlesstcg.com/cards/${encodeURIComponent(e.cardId)}" target="_blank" rel="noopener" title="View this card on Limitless TCG">${escapeHtml(cardIdLabel)}</a>`
      : `<span class="card-id">${escapeHtml(cardIdLabel)}</span>`;
    meta.innerHTML = `
      ${cardLinkHtml}
      <span class="card-category">${escapeHtml(e.category || "")}</span>`;
    card.appendChild(meta);

    const q = document.createElement("p");
    q.className = "card-question";
    q.textContent = e.question;
    card.appendChild(q);

    const verdict = document.createElement("div");
    verdict.className = "verdict";
    verdict.id = "verdictStamp";
    card.appendChild(verdict);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = e.type === "binary" ? "tf-options" : "mc-options";
    const shuffledAnswers = shuffle(e.answers);
    shuffledAnswers.forEach(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = e.type === "binary" ? "tf-btn" : "mc-btn";
      btn.textContent = opt.text;
      btn.addEventListener("click", () => handleAnswer(opt.correct, btn, optionsWrap));
      optionsWrap.appendChild(btn);
    });
    card.appendChild(optionsWrap);

    const explanation = document.createElement("div");
    explanation.className = "explanation";
    explanation.id = "explanationBox";
    const sourceHtml = e.source
      ? ` <a class="source-link" href="${escapeHtml(e.source)}" target="_blank" rel="noopener">source</a>`
      : "";
    explanation.innerHTML = `<strong>Ruling:</strong> ${escapeHtml(e.explanation)}${sourceHtml}`;
    card.appendChild(explanation);

    el.cardStage.innerHTML = "";
    el.cardStage.appendChild(card);
  }

  function handleAnswer(isCorrect, pickedBtn, wrap) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    Array.from(wrap.children).forEach(btn => {
      btn.disabled = true;
      if (btn === pickedBtn) {
        btn.classList.add(isCorrect ? "is-correct" : "is-wrong");
      } else if (btn.textContent === correctText(state.current)) {
        btn.classList.add("is-correct");
      } else {
        btn.classList.add("is-dim");
      }
    });

    state.answered += 1;
    state.score += isCorrect ? 1 : 0;

    const stamp = document.getElementById("verdictStamp");
    stamp.textContent = isCorrect ? "Confirmed" : "Overruled";
    stamp.classList.add("show", isCorrect ? "correct" : "wrong");

    document.getElementById("explanationBox").classList.add("show");

    el.nextBtn.disabled = false;
    updateStats();
  }

  function correctText(entry) {
    const found = entry.answers.find(a => a.correct);
    return found ? found.text : "";
  }

  el.nextBtn.addEventListener("click", () => {
    if (!state.hasAnswered) return;
    nextCard();
  });

  el.quitBtn.addEventListener("click", () => {
    showScreen("picker");
  });

  // ---------- Results screen ----------
  function showResults() {
    showScreen("results");
    el.resultsScore.textContent = `${state.score} / ${state.answered}`;
    const pct = state.answered ? Math.round((state.score / state.answered) * 100) : 0;
    let line;
    if (pct === 100) line = "Full marks — you'd make a fine judge.";
    else if (pct >= 80) line = "Sharp rulings knowledge.";
    else if (pct >= 50) line = "Solid, but a few rulings slipped by.";
    else line = "Worth another pass through this set.";
    el.resultsLine.textContent = `${pct}% correct — ${line}`;
  }

  el.restartBtn.addEventListener("click", () => {
    startQuiz(state.currentSetCode, state.setLabel);
  });

  el.newSetBtn.addEventListener("click", () => {
    showScreen("picker");
  });

  // ---------- Boot ----------
  function boot() {
    if (typeof OPTCG_DECK === "undefined") {
      el.setList.innerHTML = `<p class="empty-state">Couldn't load the deck — make sure data.js is in the same folder as index.html.</p>`;
      return;
    }
    state.allEntries = OPTCG_DECK.entries;
    state.sets = OPTCG_DECK.sets;
    renderPicker();
  }

  boot();
})();
