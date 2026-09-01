/* 青年理论知识学习竞赛·刷题练习（纯前端，记录存 localStorage） */
(function () {
  "use strict";

  var BANK = window.QUESTION_BANK || [];
  var PARTS = [];
  BANK.forEach(function (q) {
    if (PARTS.indexOf(q.part) === -1) PARTS.push(q.part);
  });

  /* ---------- 本地存储 ---------- */
  var LS = {
    records: "hdq_records_v1",   // {id: {seen:n, right:n}}
    wrong: "hdq_wrong_v1",       // {id: streak} streak=错题重练连续答对次数
    fav: "hdq_fav_v1",           // {id: true}
    order: "hdq_order_v1"        // "seq" | "rand"
  };

  function load(key, def) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : def;
    } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  var records = load(LS.records, {});
  var wrongBook = load(LS.wrong, {});
  var favorites = load(LS.fav, {});
  var orderMode = load(LS.order, "seq");

  /* ---------- 状态 ---------- */
  var state = {
    list: [],        // 当前刷题列表（题目对象）
    index: 0,
    title: "",
    context: "part", // part | wrong | fav
    answered: false,
    selected: []     // 当前已选字母
  };

  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  var TYPE_NAME = { single: "单选题", multi: "多选题", judge: "判断题" };

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.add("hidden"); }, 2000);
  }

  /* ---------- 首页 ---------- */
  function partStats(part) {
    var qs = BANK.filter(function (q) { return q.part === part; });
    var done = 0;
    qs.forEach(function (q) { if (records[q.id] && records[q.id].seen > 0) done++; });
    return { total: qs.length, done: done };
  }

  function renderHome() {
    var doneIds = Object.keys(records).filter(function (id) { return records[id].seen > 0; });
    var totalSeen = 0, totalRight = 0;
    doneIds.forEach(function (id) { totalSeen += records[id].seen; totalRight += records[id].right; });
    $("stat-done").textContent = doneIds.length;
    $("stat-rate").textContent = totalSeen ? Math.round(totalRight / totalSeen * 100) + "%" : "0%";
    $("stat-wrong").textContent = Object.keys(wrongBook).length;
    $("stat-fav").textContent = Object.keys(favorites).length;

    var list = $("part-list");
    list.innerHTML = "";
    PARTS.forEach(function (part, idx) {
      var st = partStats(part);
      var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
      var btn = document.createElement("button");
      btn.className = "part-item";
      btn.innerHTML =
        '<div class="part-badge">' + "一二三四五六七"[idx] + "</div>" +
        '<div class="part-info">' +
          '<div class="part-name">' + part + "</div>" +
          '<div class="part-meta">共 ' + st.total + " 题 · 已练 " + st.done + " 题</div>" +
          '<div class="part-progress-track"><div class="part-progress-fill" style="width:' + pct + '%"></div></div>' +
        "</div>" +
        '<div class="part-pct">' + pct + "%</div>";
      btn.addEventListener("click", function () { startQuiz(part); });
      list.appendChild(btn);
    });

    var segBtns = document.querySelectorAll("#order-seg .seg-btn");
    segBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-order") === orderMode);
    });
  }

  /* ---------- 刷题 ---------- */
  function startQuiz(part) {
    var qs = BANK.filter(function (q) { return q.part === part; });
    state.list = orderMode === "rand" ? shuffle(qs) : qs;
    state.title = part;
    state.context = "part";
    state.index = 0;
    showQuiz();
  }

  function startSpecial(kind) {
    var ids = Object.keys(kind === "wrong" ? wrongBook : favorites);
    if (!ids.length) {
      toast(kind === "wrong" ? "错题本是空的，先去刷题吧" : "收藏夹是空的，先去刷题吧");
      return;
    }
    var set = {};
    ids.forEach(function (id) { set[id] = true; });
    var qs = BANK.filter(function (q) { return set[q.id]; });
    state.list = orderMode === "rand" ? shuffle(qs) : qs;
    state.title = kind === "wrong" ? "错题本" : "收藏夹";
    state.context = kind;
    state.index = 0;
    showQuiz();
  }

  function showQuiz() {
    $("view-home").classList.add("hidden");
    $("view-quiz").classList.remove("hidden");
    renderQuestion();
    window.scrollTo(0, 0);
  }

  function goHome() {
    $("view-quiz").classList.add("hidden");
    $("view-home").classList.remove("hidden");
    renderHome();
    window.scrollTo(0, 0);
  }

  function currentQ() { return state.list[state.index]; }

  function renderQuestion() {
    var q = currentQ();
    state.answered = false;
    state.selected = [];

    $("quiz-title").textContent = state.title;
    $("quiz-progress").textContent = (state.index + 1) + " / " + state.list.length;
    $("progress-fill").style.width = ((state.index + 1) / state.list.length * 100) + "%";
    $("q-type-tag").textContent = TYPE_NAME[q.type] + (q.type === "multi" ? "（可选多项）" : "");
    $("q-stem").textContent = q.stem;
    $("feedback").classList.add("hidden");
    $("btn-confirm").classList.toggle("hidden", q.type !== "multi");

    var favOn = !!favorites[q.id];
    $("btn-fav").textContent = favOn ? "★" : "☆";

    var box = $("q-options");
    box.innerHTML = "";
    q.options.forEach(function (text, i) {
      var letter = String.fromCharCode(65 + i);
      var b = document.createElement("button");
      b.className = "opt";
      b.setAttribute("data-letter", letter);
      b.innerHTML = '<span class="opt-letter">' + letter + '</span><span class="opt-text">' + text + "</span>";
      b.addEventListener("click", function () { onOptionTap(q, letter, b); });
      box.appendChild(b);
    });

    $("btn-prev").disabled = state.index === 0;
    $("btn-next").textContent = state.index === state.list.length - 1 ? "完成" : "下一题";
  }

  function onOptionTap(q, letter, btn) {
    if (state.answered) return;
    if (q.type === "multi") {
      var idx = state.selected.indexOf(letter);
      if (idx >= 0) {
        state.selected.splice(idx, 1);
        btn.classList.remove("selected");
      } else {
        state.selected.push(letter);
        btn.classList.add("selected");
      }
    } else {
      state.selected = [letter];
      submitAnswer(q);
    }
  }

  function submitAnswer(q) {
    if (state.answered) return;
    if (!state.selected.length) { toast("请先选择答案"); return; }
    state.answered = true;

    var picked = state.selected.slice().sort().join("");
    var right = picked === q.answer;

    // 记录
    var rec = records[q.id] || { seen: 0, right: 0 };
    rec.seen += 1;
    if (right) rec.right += 1;
    records[q.id] = rec;
    save(LS.records, records);

    // 错题本逻辑：答错进本；在本中连续答对 2 次移出
    if (!right) {
      wrongBook[q.id] = 0;
    } else if (Object.prototype.hasOwnProperty.call(wrongBook, q.id)) {
      var streak = (wrongBook[q.id] || 0) + 1;
      if (streak >= 2) delete wrongBook[q.id];
      else wrongBook[q.id] = streak;
    }
    save(LS.wrong, wrongBook);

    // 选项标色
    var opts = document.querySelectorAll("#q-options .opt");
    opts.forEach(function (b) {
      var letter = b.getAttribute("data-letter");
      b.classList.add("disabled");
      b.classList.remove("selected");
      if (q.answer.indexOf(letter) >= 0) b.classList.add("correct");
      else if (picked.indexOf(letter) >= 0) b.classList.add("wrong");
    });
    $("btn-confirm").classList.add("hidden");

    // 反馈区
    var verdict = $("fb-verdict");
    verdict.textContent = right ? "✓ 回答正确" : "✗ 回答错误";
    verdict.className = "fb-verdict " + (right ? "right" : "bad");
    var ansText = q.type === "judge"
      ? (q.answer === "A" ? "正确" : "错误")
      : q.answer.split("").join("、");
    $("fb-answer").textContent = ansText;
    $("fb-explanation").textContent = q.explanation || "（解析整理中）";
    $("fb-mnemonic").textContent = q.mnemonic || "（口诀整理中）";
    $("feedback").classList.remove("hidden");

    setTimeout(function () {
      $("feedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }

  function nextQuestion() {
    if (state.index < state.list.length - 1) {
      state.index += 1;
      renderQuestion();
      window.scrollTo(0, 0);
    } else {
      toast("本轮练习完成！");
      goHome();
    }
  }

  function prevQuestion() {
    if (state.index > 0) {
      state.index -= 1;
      renderQuestion();
      window.scrollTo(0, 0);
    }
  }

  function toggleFav() {
    var q = currentQ();
    if (favorites[q.id]) delete favorites[q.id];
    else favorites[q.id] = true;
    save(LS.fav, favorites);
    $("btn-fav").textContent = favorites[q.id] ? "★" : "☆";
    toast(favorites[q.id] ? "已收藏" : "已取消收藏");
  }

  /* ---------- 事件绑定 ---------- */
  document.querySelectorAll("#order-seg .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      orderMode = b.getAttribute("data-order");
      save(LS.order, orderMode);
      renderHome();
    });
  });
  $("entry-wrong").addEventListener("click", function () { startSpecial("wrong"); });
  $("entry-fav").addEventListener("click", function () { startSpecial("fav"); });
  $("btn-back").addEventListener("click", goHome);
  $("btn-next").addEventListener("click", nextQuestion);
  $("btn-prev").addEventListener("click", prevQuestion);
  $("btn-fav").addEventListener("click", toggleFav);
  $("btn-confirm").addEventListener("click", function () { submitAnswer(currentQ()); });

  renderHome();
})();
