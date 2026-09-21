/* ==========================================================
   CONFIGURAÇÃO
   Depois de publicar o Code.gs como app da Web, cole aqui a
   URL gerada (termina em /exec).
   ========================================================== */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzqEu5r1OzENBSBqnSrSaKNBm55dUAUKO9TZQq3YNclVvH1nZfAL29tZzHcQ0yF77lpuA/exec",
};

/* ==========================================================
   CRITÉRIOS DE AVALIAÇÃO (Portaria 177-R / Manual do Avaliador)
   ========================================================== */
const CRITERIA = [
  {
    id: "I",
    title: "Aspectos formais",
    maxPoints: 5,
    items: [
      { id: "i1", peso: 2.5, label: "Relato estruturado de acordo com as normas da Portaria nº 177-R e o Anexo VI" },
      { id: "i2", peso: 2.5, label: "Adequação da escrita à Norma-Padrão da Língua Portuguesa" },
    ],
  },
  {
    id: "II",
    title: "Relevância do tema e contextualização",
    maxPoints: 40,
    items: [
      { id: "ii1", peso: 5.7, label: "Objetivos bem definidos e diretamente relacionados ao relato/ação" },
      { id: "ii2", peso: 5.7, label: "Coerência entre os objetivos, o desenvolvimento e os resultados obtidos" },
      { id: "ii3", peso: 5.7, label: "Apresentação da metodologia utilizada" },
      { id: "ii4", peso: 5.7, label: "Detalhamento dos procedimentos de avaliação do processo e dos resultados" },
      { id: "ii5", peso: 5.7, label: "Prática adequada às especificidades da realidade da comunidade em que a escola está inserida" },
      { id: "ii6", peso: 5.7, label: "Proposta de acordo com os objetivos previstos no Mapa Estratégico da Sedu para o quadriênio 2023–2026" },
      { id: "ii7", peso: 5.7, label: "Apresentação do material anexo e sua relevância em relação ao tema" },
    ],
  },
  {
    id: "III",
    title: "Monitoramento e efetividade dos resultados",
    maxPoints: 30,
    items: [
      { id: "iii1", peso: 10, label: "Demonstração dos instrumentos de monitoramento de práticas e processos" },
      { id: "iii2", peso: 10, label: "Evidências dos resultados obtidos" },
      { id: "iii3", peso: 10, label: "Demonstração dos impactos positivos para a comunidade escolar" },
    ],
  },
  {
    id: "IV",
    title: "Promoção de engajamento e inovação",
    maxPoints: 25,
    items: [
      { id: "iv1", peso: 8.3, label: "Criatividade e ineditismo da proposta" },
      { id: "iv2", peso: 8.3, label: "Efetividade da utilização das metodologias inovadoras no contexto da unidade escolar" },
      { id: "iv3", peso: 8.3, label: "Evidência de engajamento e envolvimento da comunidade escolar para o sucesso da ação" },
    ],
  },
];
const ALL_ITEMS = CRITERIA.flatMap((c) => c.items);

/* ==========================================================
   ESTADO
   ========================================================== */
let state = {
  id: null, // id da avaliação em edição (null = nova)
  scores: {}, // { itemId: 1-10 }
  condicao: null, // 'deferido' | 'indeferido'
  arbitroOpen: false,
  minhasAvaliacoes: [], // carregadas do backend para o avaliador atual
  relatosCadastrados: [], // relatos cadastrados pelo avaliador atual
  selecionados: new Set(), // ids de avaliações selecionadas no resumo (para PDF em lote)
  itensAbertos: new Set(), // ids de avaliações com o detalhamento por item expandido
};

/* ==========================================================
   HELPERS DE NOTA
   ========================================================== */
const ESCALA_NOTAS = [
  { nota: 1, label: "Não atende", cls: "danger", desc: "O relato não atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 2, label: "Insuficiente", cls: "danger", desc: "O relato não atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 3, label: "Insatisfatório", cls: "danger", desc: "O relato não atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 4, label: "Ruim", cls: "danger", desc: "O relato não atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 5, label: "Regular", cls: "yellow", desc: "O relato atende parcialmente aos objetivos pertinentes às competências avaliadas." },
  { nota: 6, label: "Suficiente", cls: "cyan", desc: "O relato atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 7, label: "Satisfatório", cls: "cyan", desc: "O relato atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 8, label: "Bom", cls: "cyan", desc: "O relato atende aos objetivos pertinentes às competências avaliadas." },
  { nota: 9, label: "Muito bom", cls: "pink", desc: "O relato excede os objetivos pertinentes às competências avaliadas." },
  { nota: 10, label: "Excelente", cls: "pink", desc: "O relato excede muito os objetivos pertinentes às competências avaliadas." },
];

function tierFor(score) {
  if (score == null) return null;
  const item = ESCALA_NOTAS.find((e) => e.nota === score);
  return item ? { label: item.label, cls: item.cls } : null;
}

function subtotalForScores(criterion, scores) {
  return criterion.items.reduce((sum, item) => {
    const v = scores[item.id];
    return sum + (v != null ? (v / 10) * item.peso : 0);
  }, 0);
}
function subtotalFor(criterion) {
  return subtotalForScores(criterion, state.scores);
}

function totalNotaForScores(scores) {
  return CRITERIA.reduce((sum, c) => sum + subtotalForScores(c, scores), 0);
}
function totalNota() {
  return totalNotaForScores(state.scores);
}

/* ==========================================================
   RENDER — CRITÉRIOS
   ========================================================== */
function renderCriterios() {
  const wrap = document.getElementById("criteriosWrap");
  if (state.condicao === "indeferido") {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = CRITERIA.map((c) => {
    const answered = c.items.filter((i) => state.scores[i.id] != null).length;
    const sub = subtotalFor(c);
    const rows = c.items
      .map((item) => {
        const value = state.scores[item.id] ?? null;
        const tier = tierFor(value);
        const buttons = Array.from({ length: 10 }, (_, i) => i + 1)
          .map(
            (n) => `<button type="button" class="score-btn${value === n ? " selected" : ""}" data-item="${item.id}" data-n="${n}">${n}</button>`
          )
          .join("");
        return `
          <div class="item-row">
            <div class="item-row-top">
              <p class="item-label">${item.label}</p>
              <span class="item-peso">${item.peso}%</span>
            </div>
            <div class="score-buttons">
              ${buttons}
              <span class="tier-label">${tier ? tier.label : "sem nota"}</span>
            </div>
          </div>`;
      })
      .join("");

    return `
      <div class="criterion" data-crit="${c.id}">
        <button type="button" class="criterion-head" data-toggle="${c.id}">
          <div class="criterion-head-left">
            <span class="criterion-num">${c.id}</span>
            <div>
              <h3>${c.title}</h3>
              <p>${c.maxPoints} pontos · ${answered}/${c.items.length} itens avaliados</p>
            </div>
          </div>
          <span class="criterion-score">${sub.toFixed(1)} / ${c.maxPoints}</span>
        </button>
        <div class="criterion-body" id="critbody-${c.id}">
          ${rows}
        </div>
      </div>`;
  }).join("");

  wrap.querySelectorAll(".score-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.item;
      const n = Number(btn.dataset.n);
      state.scores[itemId] = state.scores[itemId] === n ? null : n;
      renderCriterios();
      renderScoreCard();
    });
  });
  wrap.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const body = document.getElementById(`critbody-${btn.dataset.toggle}`);
      body.classList.toggle("hidden");
    });
  });
}

/* ==========================================================
   RENDER — CARTÃO DE NOTA (barra lateral)
   ========================================================== */
function renderScoreCard() {
  const indeferido = state.condicao === "indeferido";
  document.getElementById("scoreValue").textContent = indeferido ? "—" : totalNota().toFixed(1);
  document.getElementById("scoreSub").textContent = indeferido ? "relato indeferido" : "de 100 pontos";

  const barsWrap = document.getElementById("scoreBars");
  if (indeferido) {
    barsWrap.innerHTML = "";
  } else {
    barsWrap.innerHTML = CRITERIA.map((c) => {
      const sub = subtotalFor(c);
      const pct = Math.min(100, (sub / c.maxPoints) * 100);
      return `
        <div class="bar-row">
          <div class="bar-row-labels"><span>Critério ${c.id}</span><span>${sub.toFixed(1)}/${c.maxPoints}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join("");
  }

  const answered = ALL_ITEMS.filter((i) => state.scores[i.id] != null).length;
  const progressoTexto = document.getElementById("progressoTexto");
  if (indeferido) {
    progressoTexto.textContent = "Relato indeferido — pontuação não se aplica.";
  } else if (answered === ALL_ITEMS.length) {
    progressoTexto.textContent = "Todos os itens avaliados. Pronto para salvar.";
  } else {
    progressoTexto.textContent = `Faltam ${ALL_ITEMS.length - answered} de ${ALL_ITEMS.length} itens.`;
  }
}

/* ==========================================================
   CONDIÇÃO DE PARTICIPAÇÃO
   ========================================================== */
document.getElementById("condicaoGroup").addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  state.condicao = state.condicao === btn.dataset.value ? null : btn.dataset.value;
  document.querySelectorAll("#condicaoGroup .pill").forEach((p) =>
    p.classList.toggle("selected", p.dataset.value === state.condicao)
  );
  document.getElementById("avisoIndeferido").hidden = state.condicao !== "indeferido";
  renderCriterios();
  renderScoreCard();
});

/* ==========================================================
   ÁRBITRO (colapsável)
   ========================================================== */
document.getElementById("toggleArbitro").addEventListener("click", () => {
  state.arbitroOpen = !state.arbitroOpen;
  document.getElementById("arbitroBody").hidden = !state.arbitroOpen;
  document.querySelector("#toggleArbitro .chev").classList.toggle("open", state.arbitroOpen);
});

/* ==========================================================
   TABS
   ========================================================== */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-form").hidden = tab.dataset.tab !== "form";
    document.getElementById("tab-resumo").hidden = tab.dataset.tab !== "resumo";
  });
});

/* ==========================================================
   MODAL — CONSULTA RÁPIDA DOS CRITÉRIOS
   ========================================================== */
function renderModalCriterios() {
  const body = document.getElementById("modalCriteriosBody");
  if (!body) return;

  const linhas = ESCALA_NOTAS.map(
    (e) => `
      <tr>
        <td>${e.nota}</td>
        <td><span class="escala-tag ${e.cls}">${e.label}</span></td>
        <td>${e.desc}</td>
      </tr>`
  ).join("");

  body.innerHTML = `
    <table class="escala-table">
      <thead>
        <tr><th>Nota</th><th>Classificação</th><th>Descrição</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function abrirModalCriterios() {
  try {
    renderModalCriterios();
  } catch (err) {
    console.error("Erro ao montar critérios:", err);
  }
  document.getElementById("modalCriteriosOverlay").classList.add("open");
}

function fecharModalCriterios() {
  document.getElementById("modalCriteriosOverlay").classList.remove("open");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") fecharModalCriterios();
});

/* ==========================================================
   AVALIADOR — dropdown e troca
   ========================================================== */
async function carregarAvaliadoresDropdown() {
  const select = document.getElementById("inputNomeAvaliador");
  try {
    const nomes = await chamarBackend("listarAvaliadores", {});
    (nomes || []).forEach((nome) => {
      const opt = document.createElement("option");
      opt.value = nome;
      opt.textContent = nome;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Erro ao carregar avaliadores:", err);
  }
}

async function selecionarAvaliador(nome) {
  document.getElementById("card-relatos").hidden = !nome;
  state.selecionados.clear();
  state.itensAbertos.clear();
  if (!nome) {
    state.minhasAvaliacoes = [];
    state.relatosCadastrados = [];
    renderResumo();
    renderRelatosCadastrados();
    renderSelectRelato();
    return;
  }
  await Promise.all([carregarAvaliacoes(nome), carregarRelatosCadastrados(nome)]);
}

document.getElementById("inputNomeAvaliador").addEventListener("change", () => {
  selecionarAvaliador(document.getElementById("inputNomeAvaliador").value);
});
document.getElementById("btnCarregar").addEventListener("click", () => {
  selecionarAvaliador(document.getElementById("inputNomeAvaliador").value);
});

/* ==========================================================
   RELATOS CADASTRADOS PELO AVALIADOR
   ========================================================== */
async function carregarRelatosCadastrados(nome) {
  try {
    const relatos = await chamarBackend("listarRelatosCadastrados", { avaliador: nome });
    state.relatosCadastrados = relatos || [];
    renderRelatosCadastrados();
    renderSelectRelato();
  } catch (err) {
    console.error("Erro ao carregar relatos cadastrados:", err);
  }
}

function renderRelatosCadastrados() {
  const wrap = document.getElementById("listaRelatosCadastrados");
  if (!state.relatosCadastrados.length) {
    wrap.innerHTML = `<p class="hint">Nenhum relato cadastrado ainda.</p>`;
    return;
  }
  wrap.innerHTML = state.relatosCadastrados
    .slice()
    .sort((a, b) => String(a.relato).localeCompare(String(b.relato), "pt", { numeric: true }))
    .map((r) => {
      const nota = r.avaliado ? (r.condicao === "indeferido" ? "indeferido" : Number(r.notaFinal || 0).toFixed(1)) : null;
      return `
        <span class="chip${r.avaliado ? " avaliado" : ""}">
          Relato ${escapeHtml(r.relato)}
          ${nota ? `<span class="chip-nota">${nota}</span>` : ""}
          <button type="button" class="chip-remove" data-remover-relato="${escapeHtml(r.relato)}" title="Remover cadastro">×</button>
        </span>`;
    })
    .join("");

  wrap.querySelectorAll("[data-remover-relato]").forEach((btn) =>
    btn.addEventListener("click", () => removerRelatoCadastrado(btn.dataset.removerRelato))
  );
}

function renderSelectRelato() {
  const select = document.getElementById("inputRelato");
  const atual = select.value;
  select.innerHTML =
    `<option value="">Selecione um relato cadastrado</option>` +
    state.relatosCadastrados
      .slice()
      .sort((a, b) => String(a.relato).localeCompare(String(b.relato), "pt", { numeric: true }))
      .map((r) => `<option value="${escapeHtml(r.relato)}">${escapeHtml(r.relato)}${r.avaliado ? " (já avaliado)" : ""}</option>`)
      .join("");
  if ([...select.options].some((o) => o.value === atual)) select.value = atual;
}

function garantirOpcaoRelato(relato) {
  if (!relato) return;
  const select = document.getElementById("inputRelato");
  const existe = [...select.options].some((o) => o.value === String(relato));
  if (!existe) {
    const opt = document.createElement("option");
    opt.value = relato;
    opt.textContent = `${relato} (não cadastrado)`;
    select.appendChild(opt);
  }
}

document.getElementById("btnCadastrarRelato").addEventListener("click", async () => {
  const nome = document.getElementById("inputNomeAvaliador").value;
  const relato = document.getElementById("inputNovoRelato").value.trim();
  if (!nome) return alert("Selecione seu nome de avaliador primeiro.");
  if (!relato) return;
  try {
    const relatos = await chamarBackend("cadastrarRelato", { avaliador: nome, relato });
    state.relatosCadastrados = relatos || [];
    renderRelatosCadastrados();
    renderSelectRelato();
    document.getElementById("inputNovoRelato").value = "";
  } catch (err) {
    alert("Erro ao cadastrar relato: " + err.message);
  }
});

async function removerRelatoCadastrado(relato) {
  const nome = document.getElementById("inputNomeAvaliador").value;
  if (!nome) return;
  if (!confirm(`Remover o relato ${relato} da sua lista de cadastro? (Isso não apaga uma avaliação já salva.)`)) return;
  try {
    const relatos = await chamarBackend("excluirRelatoCadastrado", { avaliador: nome, relato });
    state.relatosCadastrados = relatos || [];
    renderRelatosCadastrados();
    renderSelectRelato();
  } catch (err) {
    alert("Erro ao remover relato: " + err.message);
  }
}

document.getElementById("inputRelato").addEventListener("change", () => {
  const relato = document.getElementById("inputRelato").value;
  if (!relato) return;
  const existente = state.minhasAvaliacoes.find((av) => String(av.relato) === String(relato));
  if (existente) {
    preencherFormulario(existente);
  } else {
    limparFormulario();
    document.getElementById("inputRelato").value = relato;
  }
});

/* ==========================================================
   MONTAR / CARREGAR FORMULÁRIO A PARTIR DE UM OBJETO
   ========================================================== */
function coletarFormulario() {
  return {
    id: state.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    avaliador: document.getElementById("inputNomeAvaliador").value.trim(),
    relato: document.getElementById("inputRelato").value.trim(),
    categoria: document.getElementById("inputCategoria").value,
    sre: document.getElementById("inputSre").value.trim(),
    condicao: state.condicao || "",
    scores: { ...state.scores },
    notaFinal: state.condicao === "indeferido" ? null : Number(totalNota().toFixed(1)),
    justificativa: document.getElementById("inputJustificativa").value.trim(),
    arbitro: state.arbitroOpen,
    notasArbitragem: document.getElementById("inputArbitragem").value.trim(),
  };
}

function preencherFormulario(av) {
  state.id = av.id;
  state.scores = { ...(av.scores || {}) };
  state.condicao = av.condicao || null;
  state.arbitroOpen = !!av.arbitro;

  garantirOpcaoRelato(av.relato);
  document.getElementById("inputRelato").value = av.relato || "";
  document.getElementById("inputCategoria").value = av.categoria || "";
  document.getElementById("inputSre").value = av.sre || "";
  document.getElementById("inputJustificativa").value = av.justificativa || "";
  document.getElementById("inputArbitragem").value = av.notasArbitragem || "";
  document.getElementById("inputDeclarado").checked = true;

  document.querySelectorAll("#condicaoGroup .pill").forEach((p) =>
    p.classList.toggle("selected", p.dataset.value === state.condicao)
  );
  document.getElementById("avisoIndeferido").hidden = state.condicao !== "indeferido";
  document.getElementById("arbitroBody").hidden = !state.arbitroOpen;
  document.querySelector("#toggleArbitro .chev").classList.toggle("open", state.arbitroOpen);

  renderCriterios();
  renderScoreCard();

  document.querySelector('.tab[data-tab="form"]').click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function limparFormulario() {
  state.id = null;
  state.scores = {};
  state.condicao = null;
  state.arbitroOpen = false;

  document.getElementById("inputRelato").value = "";
  document.getElementById("inputCategoria").value = "";
  document.getElementById("inputSre").value = "";
  document.getElementById("inputJustificativa").value = "";
  document.getElementById("inputArbitragem").value = "";
  document.getElementById("inputDeclarado").checked = false;
  document.querySelectorAll("#condicaoGroup .pill").forEach((p) => p.classList.remove("selected"));
  document.getElementById("avisoIndeferido").hidden = true;
  document.getElementById("arbitroBody").hidden = true;
  document.querySelector("#toggleArbitro .chev").classList.remove("open");

  renderCriterios();
  renderScoreCard();
  setSaveStatus("", "");
}
document.getElementById("btnNovo").addEventListener("click", limparFormulario);

/* ==========================================================
   CHAMADAS AO BACKEND (Apps Script)
   ========================================================== */
async function chamarBackend(action, payload) {
  const resp = await fetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight CORS
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || "Erro desconhecido no servidor.");
  return data.result;
}

function setSaveStatus(msg, cls) {
  const el = document.getElementById("saveStatus");
  el.textContent = msg;
  el.className = `save-status ${cls}`;
}

document.getElementById("btnSalvar").addEventListener("click", async () => {
  const nome = document.getElementById("inputNomeAvaliador").value.trim();
  if (!nome) return setSaveStatus("Selecione seu nome de avaliador antes de salvar.", "err");
  if (!document.getElementById("inputRelato").value.trim())
    return setSaveStatus("Selecione o número do relato.", "err");
  if (!state.condicao) return setSaveStatus("Selecione a condição de participação.", "err");
  if (!document.getElementById("inputDeclarado").checked)
    return setSaveStatus("Marque a declaração antes de salvar.", "err");

  const dados = coletarFormulario();
  setSaveStatus("Salvando...", "");
  try {
    await chamarBackend("salvar", { avaliacao: dados });
    state.id = dados.id;
    setSaveStatus("Avaliação salva com sucesso.", "ok");
    await Promise.all([carregarAvaliacoes(nome), carregarRelatosCadastrados(nome)]);
  } catch (err) {
    setSaveStatus("Erro ao salvar: " + err.message, "err");
  }
});

async function carregarAvaliacoes(nome) {
  const lista = document.getElementById("resumoLista");
  lista.innerHTML = `<p class="empty-state">Carregando...</p>`;
  try {
    const avaliacoes = await chamarBackend("listar", { avaliador: nome });
    state.minhasAvaliacoes = avaliacoes || [];
    renderResumo();
  } catch (err) {
    lista.innerHTML = `<p class="empty-state">Erro ao carregar: ${err.message}</p>`;
  }
}

async function excluirAvaliacao(id) {
  if (!confirm("Excluir esta avaliação salva?")) return;
  try {
    await chamarBackend("excluir", { id });
    state.minhasAvaliacoes = state.minhasAvaliacoes.filter((a) => a.id !== id);
    state.selecionados.delete(id);
    state.itensAbertos.delete(id);
    renderResumo();
    const nome = document.getElementById("inputNomeAvaliador").value;
    if (nome) carregarRelatosCadastrados(nome);
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
}

/* ==========================================================
   RENDER — RESUMO
   ========================================================== */
function buildDetalhesHtml(av) {
  if (av.condicao === "indeferido") {
    return `<p class="relato-item-line"><span>Relato indeferido — não pontuado nos critérios.</span></p>`;
  }
  return CRITERIA.map((c) => {
    const sub = subtotalForScores(c, av.scores || {});
    const linhas = c.items
      .map((item) => {
        const score = (av.scores || {})[item.id];
        const tier = tierFor(score);
        return `<div class="relato-item-line"><span>${escapeHtml(item.label)}</span><span>${score != null ? score + "/10" : "—"}${tier ? " · " + tier.label : ""}</span></div>`;
      })
      .join("");
    return `<p class="relato-itens-crit">Critério ${c.id} — ${c.title} (${sub.toFixed(1)}/${c.maxPoints})</p>${linhas}`;
  }).join("");
}

function renderResumo() {
  const lista = document.getElementById("resumoLista");
  const badge = document.getElementById("badgeCount");
  const n = state.minhasAvaliacoes.length;
  badge.hidden = n === 0;
  badge.textContent = n;

  if (n === 0) {
    lista.innerHTML = `<p class="empty-state">Nenhuma avaliação encontrada para este nome ainda.</p>`;
    return;
  }

  lista.innerHTML = state.minhasAvaliacoes
    .slice()
    .sort((a, b) => String(a.relato || "").localeCompare(String(b.relato || ""), "pt", { numeric: true }))
    .map((av) => {
      const nota = av.condicao === "indeferido" ? "—" : Number(av.notaFinal || 0).toFixed(1);
      const marcado = state.selecionados.has(av.id);
      const aberto = state.itensAbertos.has(av.id);
      return `
        <div class="relato-card">
          <div class="relato-top">
            <label class="relato-select">
              <input type="checkbox" data-select="${av.id}" ${marcado ? "checked" : ""} />
              <div>
                <p class="relato-title">Relato nº ${av.relato || "—"}</p>
                <p class="relato-meta">${av.categoria || "categoria não informada"}${av.sre ? " · " + av.sre : ""}</p>
                <span class="relato-status ${av.condicao}">${av.condicao === "indeferido" ? "Indeferido" : "Deferido"}</span>
              </div>
            </label>
            <div class="relato-nota">${nota}<small>${av.condicao === "indeferido" ? "" : "/ 100"}</small></div>
          </div>
          ${av.justificativa ? `
          <div class="relato-justif-wrap">
            <div class="relato-justif-head">
              <span class="relato-justif-label">Justificativa</span>
              <button type="button" class="btn-copy-justif" data-copy-justif="${av.id}" title="Copiar justificativa">📋 Copiar</button>
            </div>
            <p class="relato-justif">${escapeHtml(av.justificativa)}</p>
          </div>` : ""}
          <div class="relato-actions">
            <button class="btn btn-ghost" data-edit="${av.id}">Editar</button>
            <button class="btn btn-ghost" data-toggle-itens="${av.id}">${aberto ? "Ocultar notas por item" : "Ver notas por item"}</button>
            <button class="btn btn-ghost" data-pdf="${av.id}">Baixar PDF</button>
            <button class="btn btn-ghost" data-del="${av.id}">Excluir</button>
          </div>
          <div class="relato-itens ${aberto ? "open" : ""}">${buildDetalhesHtml(av)}</div>
        </div>`;
    })
    .join("");

  lista.querySelectorAll("[data-edit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const av = state.minhasAvaliacoes.find((a) => a.id === btn.dataset.edit);
      if (av) preencherFormulario(av);
    })
  );
  lista.querySelectorAll("[data-del]").forEach((btn) =>
    btn.addEventListener("click", () => excluirAvaliacao(btn.dataset.del))
  );
  lista.querySelectorAll("[data-select]").forEach((chk) =>
    chk.addEventListener("change", () => {
      if (chk.checked) state.selecionados.add(chk.dataset.select);
      else state.selecionados.delete(chk.dataset.select);
    })
  );
  lista.querySelectorAll("[data-toggle-itens]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleItens;
      if (state.itensAbertos.has(id)) state.itensAbertos.delete(id);
      else state.itensAbertos.add(id);
      renderResumo();
    })
  );
  lista.querySelectorAll("[data-pdf]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const av = state.minhasAvaliacoes.find((a) => a.id === btn.dataset.pdf);
      if (av) gerarPdf([av]);
    })
  );
  lista.querySelectorAll("[data-copy-justif]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const av = state.minhasAvaliacoes.find((a) => a.id === btn.dataset.copyJustif);
      if (!av || !av.justificativa) return;
      try {
        await navigator.clipboard.writeText(av.justificativa);
        const original = btn.textContent;
        btn.textContent = "Copiado!";
        setTimeout(() => (btn.textContent = original), 1500);
      } catch (e) {
        alert("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
      }
    })
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ==========================================================
   SELEÇÃO, EXIBIÇÃO NA TELA E PDF
   ========================================================== */
document.getElementById("btnSelecionarTodos").addEventListener("click", () => {
  const todosMarcados = state.minhasAvaliacoes.length > 0 &&
    state.minhasAvaliacoes.every((av) => state.selecionados.has(av.id));
  if (todosMarcados) {
    state.selecionados.clear();
  } else {
    state.minhasAvaliacoes.forEach((av) => state.selecionados.add(av.id));
  }
  renderResumo();
});

document.getElementById("btnExibirTela").addEventListener("click", () => {
  const alvos = state.selecionados.size
    ? state.minhasAvaliacoes.filter((av) => state.selecionados.has(av.id))
    : state.minhasAvaliacoes;
  if (!alvos.length) return;
  alvos.forEach((av) => state.itensAbertos.add(av.id));
  renderResumo();
  document.getElementById("resumoLista").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("btnPdfTodos").addEventListener("click", () => {
  gerarPdf(state.minhasAvaliacoes);
});
document.getElementById("btnPdfSelecionados").addEventListener("click", () => {
  const selecionados = state.minhasAvaliacoes.filter((av) => state.selecionados.has(av.id));
  gerarPdf(selecionados);
});

async function gerarPdf(lista) {
  if (!lista.length) {
    alert("Nenhum relato selecionado.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y;

  const quebraSeNecessario = (espacoMinimo) => {
    if (y > pageHeight - espacoMinimo) {
      doc.addPage();
      y = 50;
    }
  };

  lista.forEach((av, idx) => {
    if (idx > 0) doc.addPage();
    y = 50;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Prêmio Sedu: Boas Práticas na Educação — 19ª edição", marginX, y);
    y += 22;

    doc.setFontSize(14);
    doc.text(`Relato nº ${av.relato || "—"}`, marginX, y);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Avaliador: ${av.avaliador || "—"}`, marginX, y); y += 14;
    doc.text(`Categoria: ${av.categoria || "—"}`, marginX, y); y += 14;
    if (av.sre) { doc.text(`SRE de origem: ${av.sre}`, marginX, y); y += 14; }
    doc.text(`Condição de participação: ${av.condicao === "indeferido" ? "Indeferido" : "Deferido"}`, marginX, y);
    y += 20;

    if (av.condicao === "indeferido") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Relato indeferido — não pontuado nos critérios.", marginX, y);
      y += 20;
    } else {
      CRITERIA.forEach((c) => {
        const sub = subtotalForScores(c, av.scores || {});
        quebraSeNecessario(90);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Critério ${c.id} — ${c.title} (${sub.toFixed(1)}/${c.maxPoints})`, marginX, y);
        y += 16;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        c.items.forEach((item) => {
          const score = (av.scores || {})[item.id];
          const textoItem = `${item.label} — Peso ${item.peso}%`;
          const linhas = doc.splitTextToSize(textoItem, maxWidth - 60);
          quebraSeNecessario(30 + linhas.length * 12);
          doc.text(linhas, marginX, y);
          doc.text(score != null ? `${score}/10` : "—", pageWidth - marginX - 30, y);
          y += linhas.length * 12 + 4;
        });
        y += 8;
      });

      quebraSeNecessario(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Nota final: ${Number(av.notaFinal || 0).toFixed(1)} / 100`, marginX, y);
      y += 24;
    }

    quebraSeNecessario(100);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Justificativa:", marginX, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const justLinhas = doc.splitTextToSize(av.justificativa || "—", maxWidth);
    justLinhas.forEach((linha) => {
      quebraSeNecessario(40);
      doc.text(linha, marginX, y);
      y += 13;
    });

    if (av.arbitro) {
      y += 10;
      quebraSeNecessario(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Avaliação de árbitro — notas de referência dos avaliadores anteriores:", marginX, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const arbLinhas = doc.splitTextToSize(av.notasArbitragem || "—", maxWidth);
      arbLinhas.forEach((linha) => {
        quebraSeNecessario(40);
        doc.text(linha, marginX, y);
        y += 13;
      });
    }
  });

  const nomeAvaliador = (document.getElementById("inputNomeAvaliador").value || "avaliador").replace(/\s+/g, "-");
  const nomeArquivo = lista.length === 1
    ? `avaliacao-relato-${lista[0].relato}.pdf`
    : `avaliacoes-${nomeAvaliador}.pdf`;
  doc.save(nomeArquivo);
}

/* ==========================================================
   COPIAR RESUMO COMPLETO
   ========================================================== */
document.getElementById("btnCopiarResumo").addEventListener("click", async () => {
  const nome = document.getElementById("inputNomeAvaliador").value || "—";
  const linhas = [`Resumo das avaliações — ${nome}`, ""];
  state.minhasAvaliacoes.forEach((av) => {
    const nota = av.condicao === "indeferido" ? "—" : Number(av.notaFinal || 0).toFixed(1);
    linhas.push(`Relato nº ${av.relato} (${av.categoria || "—"}) — ${av.condicao} — Nota: ${nota}`);
    linhas.push(`Justificativa: ${av.justificativa || "—"}`);
    linhas.push("");
  });
  try {
    await navigator.clipboard.writeText(linhas.join("\n"));
    const btn = document.getElementById("btnCopiarResumo");
    const original = btn.textContent;
    btn.textContent = "Copiado!";
    setTimeout(() => (btn.textContent = original), 1500);
  } catch (e) {
    alert("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
  }
});

/* ==========================================================
   INICIALIZAÇÃO
   ========================================================== */
renderCriterios();
renderScoreCard();
carregarAvaliadoresDropdown();
