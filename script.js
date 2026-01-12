// --- IMPORTANDO O FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  remove,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURAÇÃO (Sua conta antiga) ---
const firebaseConfig = {
  apiKey: "AIzaSyCfXdPSEcTAs64P34-3ZwniCqQbtFuMnYg",
  authDomain: "roletacasal.firebaseapp.com",
  databaseURL: "https://roletacasal-default-rtdb.firebaseio.com",
  projectId: "roletacasal",
  storageBucket: "roletacasal.firebasestorage.app",
  messagingSenderId: "229023482154",
  appId: "1:229023482154:web:4001d099a816f3664cde53",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Referências do Banco
const watchingRef = ref(db, "lists/watching");
const toWatchRef = ref(db, "lists/towatch");

// Variáveis temporárias para deletar
let itemToDeleteId = null;
let listToDeleteFrom = null;
// --- ESTADO GLOBAL ---
// Guardamos os dados brutos do Firebase aqui
let rawData = {
  watching: [],
  towatch: [],
};

// Filtros atuais (padrão 'all')
let activeFilters = {
  watching: "all",
  towatch: "all",
};

let currentListToAdd = ""; // 'watching' ou 'towatch'
let isSpinning = false;

// --- SINCRONIZAÇÃO EM TEMPO REAL ---

// Ouvir Lista: Assistindo
onValue(watchingRef, (snapshot) => {
  rawData.watching = [];
  const data = snapshot.val();
  if (data) {
    Object.keys(data).forEach((key) => {
      rawData.watching.push({ id: key, ...data[key] });
    });
  }
  renderList("watching"); // Atualiza só essa lista na tela
});

// Ouvir Lista: Quero Assistir
onValue(toWatchRef, (snapshot) => {
  rawData.towatch = [];
  const data = snapshot.val();
  if (data) {
    Object.keys(data).forEach((key) => {
      rawData.towatch.push({ id: key, ...data[key] });
    });
  }
  renderList("towatch"); // Atualiza só essa lista na tela
});

// --- FUNÇÕES DE FILTRO ---

// Precisamos expor a função setFilter para o HTML poder chamar
window.setFilter = function (listType, filterValue, btnElement) {
  activeFilters[listType] = filterValue;

  // Atualiza visual dos botões
  const container = btnElement.parentElement;
  const buttons = container.querySelectorAll(".chip");
  buttons.forEach((btn) => btn.classList.remove("active"));
  btnElement.classList.add("active");

  // Renderiza a lista de novo com o novo filtro
  renderList(listType);
};

// Abre o modal e guarda os dados
window.openDeleteModal = function (listType, id) {
  itemToDeleteId = id;
  listToDeleteFrom = listType;

  document.getElementById("modal-confirm").classList.add("open");
};

// Executa a exclusão de verdade (chamado pelo botão do modal)
window.executeDelete = function () {
  if (itemToDeleteId && listToDeleteFrom) {
    const path =
      listToDeleteFrom === "watching"
        ? `lists/watching/${itemToDeleteId}`
        : `lists/towatch/${itemToDeleteId}`;

    remove(ref(db, path));
  }

  // Limpa e fecha
  itemToDeleteId = null;
  listToDeleteFrom = null;
  closeModals();
};
// --- FUNÇÕES DE MODAL ---

window.openAddModal = function (listType) {
  currentListToAdd = listType;
  const title =
    listType === "watching"
      ? "Adicionar em: Assistindo"
      : "Adicionar em: Quero Assistir";
  document.getElementById("modal-add-title").innerText = title;
  document.getElementById("new-item-name").value = "";
  document.getElementById("modal-add").classList.add("open");
  document.getElementById("new-item-name").focus();
};

window.openWheelModal = function () {
  document.getElementById("modal-wheel").classList.add("open");
  setTimeout(updateWheel, 100);
};

window.closeModals = function () {
  if (isSpinning) return;
  document
    .querySelectorAll(".modal-overlay")
    .forEach((el) => el.classList.remove("open"));
};

// --- CRUD (ADICIONAR/REMOVER) ---

window.confirmAddItem = function () {
  const nameInput = document.getElementById("new-item-name");
  const typeInput = document.getElementById("new-item-type");

  const name = nameInput.value.trim();
  const type = typeInput.value;

  if (!name) return alert("Digite um nome!");

  // Salva no Firebase (ele gera o ID sozinho)
  const refToUse = currentListToAdd === "watching" ? watchingRef : toWatchRef;

  push(refToUse, {
    name: name,
    type: type,
    createdAt: Date.now(),
  });

  window.closeModals();
};

window.removeItem = function (listType, id) {
  if (!confirm("Tem certeza que quer apagar?")) return;

  const path =
    listType === "watching" ? `lists/watching/${id}` : `lists/towatch/${id}`;
  remove(ref(db, path));
};

// --- RENDERIZAÇÃO ---

function renderList(listType) {
  const ulElement = document.getElementById(
    listType === "watching" ? "list-watching" : "list-towatch"
  );
  const filter = activeFilters[listType];

  // 1. Pega os dados brutos
  let items = rawData[listType];

  // 2. Aplica o filtro
  if (filter !== "all") {
    items = items.filter((item) => item.type === filter);
  }

  // 3. Desenha HTML
  if (items.length === 0) {
    ulElement.innerHTML = `<li style="justify-content:center; color:#999; border:none;">Lista vazia...</li>`;
    return;
  }

  ulElement.innerHTML = items
    .map(
      (item) => `
    <li>
      <div class="li-content">
        <span class="badge ${item.type}">${item.type}</span>
        <span>${item.name}</span>
      </div>
      <button class="btn-delete" onclick="openDeleteModal('${listType}', '${item.id}')">&times;</button>
    </li>
  `
    )
    .join("");
}

// --- ROLETA ---

const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
let wheelItems = [];
let currentAngle = 0;

window.updateWheel = function () {
  if (isSpinning) return;

  const sourceListKey = document.getElementById("spin-source").value; // watching ou towatch
  const filterType = document.getElementById("spin-filter").value;

  // Usa os dados brutos do Firebase para a roleta
  let candidates = rawData[sourceListKey] || [];

  if (filterType !== "all") {
    candidates = candidates.filter((item) => item.type === filterType);
  }

  wheelItems = candidates;
  drawWheel(currentAngle);
};

function drawWheel(angleOffset) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = centerX - 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (wheelItems.length === 0) {
    // Desenha roleta cinza vazia
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#f0f0f0";
    ctx.fill();
    ctx.strokeStyle = "#ccc";
    ctx.stroke();

    ctx.fillStyle = "#aaa";
    ctx.font = "14px Nunito";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Sem itens", centerX, centerY);
    return;
  }

  const numSegments = wheelItems.length;
  const arcSize = (2 * Math.PI) / numSegments;
  const colors = ["#ffb5c0", "#ffcad4", "#e3e5de", "#dce0d9"];

  for (let i = 0; i < numSegments; i++) {
    const angle = angleOffset + i * arcSize;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#444";
    ctx.font = "bold 13px Nunito";

    let text = wheelItems[i].name;
    if (text.length > 14) text = text.substring(0, 13) + "...";

    ctx.fillText(text, radius - 15, 4);
    ctx.restore();
  }
}

window.spinWheel = function () {
  if (isSpinning) return;
  if (wheelItems.length === 0) return alert("Nada para sortear!");

  isSpinning = true;
  document.getElementById("btn-spin").disabled = true;

  const winnerIndex = Math.floor(Math.random() * wheelItems.length);
  const winnerItem = wheelItems[winnerIndex];

  const numSegments = wheelItems.length;
  const arcSize = (2 * Math.PI) / numSegments;
  const currentItemAngle = winnerIndex * arcSize;

  const spins = 5;
  const duration = 4000;
  const targetRotation =
    spins * 2 * Math.PI + 1.5 * Math.PI - (currentItemAngle + arcSize / 2);

  let start = null;

  function animate(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;

    if (progress < duration) {
      const ease = 1 - Math.pow(1 - progress / duration, 4);
      currentAngle = ease * targetRotation;
      drawWheel(currentAngle);
      requestAnimationFrame(animate);
    } else {
      isSpinning = false;
      document.getElementById("btn-spin").disabled = false;
      document.getElementById("modal-wheel").classList.remove("open");
      showResult(winnerItem);
    }
  }
  requestAnimationFrame(animate);
};

function showResult(item) {
  const modal = document.getElementById("modal-result");
  document.getElementById("winner-name").innerText = item.name;

  const tag = document.getElementById("winner-tag");
  tag.innerText = item.type;
  tag.className = `badge ${item.type}`;

  modal.classList.add("open");
}

// --- INTEGRAÇÃO TMDB (Autocomplete) ---

const TMDB_API_KEY = "c7c876994e8a4d2e7369ab17d2046565";
const inputName = document.getElementById("new-item-name");
const suggestionsList = document.getElementById("suggestions-list");
let debounceTimer;

// Ouve o que você digita
inputName.addEventListener("input", function () {
  const query = this.value.trim();

  // Limpa timer anterior (para não chamar a API a cada letra rapidinho)
  clearTimeout(debounceTimer);

  if (query.length < 3) {
    suggestionsList.classList.remove("visible");
    return;
  }

  // Espera 500ms depois que parar de digitar para buscar
  debounceTimer = setTimeout(() => fetchMovies(query), 500);
});

async function fetchMovies(query) {
  if (!TMDB_API_KEY || TMDB_API_KEY === "SUA_API_KEY_AQUI") {
    console.warn("Sem chave de API do TMDB configurada.");
    return;
  }

  // Busca "multi" (filmes e séries juntos) em Português
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(
    query
  )}&include_adult=false`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    // Filtra apenas o que é filme ou tv (ignora atores)
    const results = data.results
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 5);

    renderSuggestions(results);
  } catch (error) {
    console.error("Erro TMDB:", error);
  }
}

function renderSuggestions(items) {
  suggestionsList.innerHTML = "";

  if (items.length === 0) {
    suggestionsList.classList.remove("visible");
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");

    // Pega o título correto (filme usa 'title', série usa 'name')
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").split("-")[0];
    const poster = item.poster_path
      ? `https://image.tmdb.org/t/p/w92${item.poster_path}`
      : "https://via.placeholder.com/30x45?text=?"; // Imagem padrão se não tiver

    li.innerHTML = `
      <img src="${poster}" alt="Poster">
      <div class="suggestion-info">
        <span class="suggestion-title">${title}</span>
        <span class="suggestion-year">${
          item.media_type === "movie" ? "Filme" : "Série"
        } • ${year}</span>
      </div>
    `;

    // Ao clicar na sugestão
    li.onclick = () => selectSuggestion(item);

    suggestionsList.appendChild(li);
  });

  suggestionsList.classList.add("visible");
}

function selectSuggestion(item) {
  // 1. Preenche o Nome
  const title = item.title || item.name;
  inputName.value = title;

  // 2. Tenta adivinhar o Tipo
  const typeSelect = document.getElementById("new-item-type");

  if (item.media_type === "movie") {
    typeSelect.value = "filme";
  } else if (item.media_type === "tv") {
    // Verifica se é Anime (Gênero ID 16 é Animação e country JP é comum)
    const isAnimation = item.genre_ids.includes(16);
    const isJapan = item.origin_country && item.origin_country.includes("JP");

    if (isAnimation && isJapan) {
      typeSelect.value = "anime";
    } else {
      typeSelect.value = "serie";
    }
  }

  // 3. Esconde a lista
  suggestionsList.classList.remove("visible");
}

// Fecha a lista se clicar fora
document.addEventListener("click", (e) => {
  if (!inputName.contains(e.target) && !suggestionsList.contains(e.target)) {
    suggestionsList.classList.remove("visible");
  }
});
