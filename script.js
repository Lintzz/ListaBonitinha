// --- IMPORTANDO O FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  remove,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- COLE SUA CONFIGURAÇÃO AQUI (Do Console do Firebase) ---
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

// Referências do Banco de Dados
const listaEuRef = ref(db, "listas/eu");
const listaElaRef = ref(db, "listas/ela");
const sliderRef = ref(db, "config/slider");

// Variáveis Locais
let listMe = []; // Guardará objetos {id, text}
let listFriend = [];
let items = [];
let colors = [];
let currentSliderValue = 50;

// Configuração do Canvas
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
let currentAngle = 0;
let isSpinning = false;

// --- FUNÇÕES DE SINCRONIZAÇÃO (OUVIR O BANCO) ---

// Ouve mudanças na MINHA lista
onValue(listaEuRef, (snapshot) => {
  listMe = [];
  const data = snapshot.val();
  if (data) {
    // Converte o objeto do Firebase em array
    Object.keys(data).forEach((key) => {
      listMe.push({ id: key, text: data[key] });
    });
  }
  renderLists();
  updateWheel();
});

// Ouve mudanças na lista DELA
onValue(listaElaRef, (snapshot) => {
  listFriend = [];
  const data = snapshot.val();
  if (data) {
    Object.keys(data).forEach((key) => {
      listFriend.push({ id: key, text: data[key] });
    });
  }
  renderLists();
  updateWheel();
});

// Ouve mudanças no SLIDER (Sincronia Realtime!)
onValue(sliderRef, (snapshot) => {
  const val = snapshot.val();
  if (val !== null) {
    currentSliderValue = val;
    document.getElementById("slider").value = val;
    updatePercentageLabels(val);
  }
});

// --- FUNÇÕES DE INTERAÇÃO (ENVIAR PRO BANCO) ---

window.addItem = function (user) {
  const inputId = user === "me" ? "input-me" : "input-friend";
  const inputElement = document.getElementById(inputId);
  const text = inputElement.value.trim();

  if (text !== "") {
    // Em vez de adicionar no array local, mandamos pro Firebase
    const refToUse = user === "me" ? listaEuRef : listaElaRef;
    push(refToUse, text); // O Firebase gera um ID único
    inputElement.value = "";
  }
};

window.removeItem = function (user, id) {
  if (isSpinning) return;
  // Remove direto no Firebase usando o ID
  const path = user === "me" ? `listas/eu/${id}` : `listas/ela/${id}`;
  remove(ref(db, path));
};

window.updatePercentage = function () {
  const val = document.getElementById("slider").value;
  // Salva no banco para atualizar a tela dela também
  set(sliderRef, parseInt(val));
};

function updatePercentageLabels(val) {
  document.getElementById("perc-me").innerText = val + "% Eu";
  document.getElementById("perc-friend").innerText = 100 - val + "% Ela";
}

// Permitir Enter
document.getElementById("input-me").addEventListener("keypress", (e) => {
  if (e.key === "Enter") window.addItem("me");
});
document.getElementById("input-friend").addEventListener("keypress", (e) => {
  if (e.key === "Enter") window.addItem("friend");
});

// --- RENDERIZAÇÃO VISUAL ---

function renderLists() {
  const ulMe = document.getElementById("list-me");
  const ulFriend = document.getElementById("list-friend");

  // Note que agora passamos o ID para a função removeItem
  ulMe.innerHTML = listMe
    .map(
      (item) =>
        `<li>${item.text} <button onclick="removeItem('me', '${item.id}')">&times;</button></li>`
    )
    .join("");

  ulFriend.innerHTML = listFriend
    .map(
      (item) =>
        `<li>${item.text} <button onclick="removeItem('friend', '${item.id}')">&times;</button></li>`
    )
    .join("");
}

// --- LÓGICA DA ROLETA (Igual, mas adaptada para objetos) ---

function updateWheel() {
  items = [];
  colors = [];

  const maxLength = Math.max(listMe.length, listFriend.length);

  for (let i = 0; i < maxLength; i++) {
    if (i < listMe.length) {
      items.push(listMe[i].text); // Pegamos só o texto
      colors.push("#4CAF50");
    }
    if (i < listFriend.length) {
      items.push(listFriend[i].text);
      colors.push("#ff518b");
    }
  }

  if (items.length === 0) {
    // CORREÇÃO: Calcula o centro baseado no tamanho real do Canvas (500)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = centerX - 10; // Deixa uma borda pequena

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();

    // Desenha usando o centro calculado (250, 250) e não fixo (200, 200)
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);

    ctx.fillStyle = "#333";
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = "#aaa";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle"; // Garante que o texto fique bem no meio verticalmente
    ctx.fillText("Adicione filmes!", centerX, centerY);
    return;
  }

  drawWheel(currentAngle);
}

function drawWheel(angleOffset) {
  // Ajustado para canvas 400x400 (raio um pouco menor)
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = centerX - 10; // Deixa borda

  const numSegments = items.length;
  const arcSize = (2 * Math.PI) / numSegments;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < numSegments; i++) {
    const angle = angleOffset + i * arcSize;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.fillStyle = colors[i];
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial"; // Fonte um pouco menor

    let text = items[i];
    if (text.length > 15) text = text.substring(0, 14) + "...";

    ctx.fillText(text, radius - 20, 5);
    ctx.restore();
  }
}

window.spinWheel = function () {
  if (isSpinning || items.length === 0) {
    if (items.length === 0) alert("Adicione filmes primeiro!");
    return;
  }

  // Decide o vencedor matematicamente
  const winnerData = decideWinner();
  const winnerName = winnerData.name;
  const winnerSource = winnerData.source;

  // Acha index (cuidado com nomes repetidos, pega o primeiro)
  const winnerIndex = items.indexOf(winnerName);

  isSpinning = true;
  document.getElementById("btn-spin").disabled = true;

  const numSegments = items.length;
  const arcSize = (2 * Math.PI) / numSegments;
  const currentItemAngle = winnerIndex * arcSize;

  // Matemática do giro
  const spins = 10;
  const targetRotation =
    spins * 2 * Math.PI + 1.5 * Math.PI - (currentItemAngle + arcSize / 2);

  let start = null;
  const duration = 5000;

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
      showResult(winnerName, winnerSource);
    }
  }
  requestAnimationFrame(animate);
};

function decideWinner() {
  // Usa o valor do slider que veio do Firebase
  const sliderVal = currentSliderValue;
  const randomChance = Math.floor(Math.random() * 101);

  let pool = [];
  let source = "";

  if (randomChance <= sliderVal) {
    if (listMe.length > 0) {
      pool = listMe.map((i) => i.text); // Pega só texto
      source = "Sua Lista";
    } else {
      pool = listFriend.map((i) => i.text);
      source = "Lista Dela (Sua vazia)";
    }
  } else {
    if (listFriend.length > 0) {
      pool = listFriend.map((i) => i.text);
      source = "Lista Dela";
    } else {
      pool = listMe.map((i) => i.text);
      source = "Sua Lista (Dela vazia)";
    }
  }

  const chosenItem = pool[Math.floor(Math.random() * pool.length)];
  return { name: chosenItem, source: source };
}

// Modal
function showResult(name, source) {
  const modal = document.getElementById("result-modal");
  document.getElementById("winner-text").innerText = name;
  document.getElementById("winner-source").innerText = source;
  modal.classList.add("open");
}

window.closeModal = function () {
  document.getElementById("result-modal").classList.remove("open");
};
