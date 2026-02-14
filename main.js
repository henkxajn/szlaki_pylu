// Szlaki Pyłu (Web MVP) — Phaser 3 + HTML UI
// Uruchom lokalnie przez serwer (np. VSCode Live Server), bo używamy modułu ES.

const HexType = { STACJA:0, PLANETA:1, ASTEROIDY:2, WRAK:3, ANOMALIA:4 };
const Goods = [
  { id:0, name:"Ruda", base:12 },
  { id:1, name:"Paliwo", base:20 },
  { id:2, name:"Żywność", base:10 },
  { id:3, name:"Części", base:18 },
  { id:4, name:"Medy", base:16 },
  { id:5, name:"Dane", base:22 },
];

const state = {
  credits: 120,
  oxygen: 12,
  fuel: 10,
  cargoCap: 12,
  cargo: new Map(Goods.map(g => [g.id, 0])),
  rng: mulberry32((Date.now() >>> 0) ^ 0xA5A5A5A5),
};

function cargoUsed() {
  let s = 0; for (const v of state.cargo.values()) s += v; return s;
}
function log(msg) {
  ui.logEl.textContent += msg + "\n";
  ui.logEl.scrollTop = ui.logEl.scrollHeight;
}
function refreshResources() {
  ui.resEl.textContent =
    `CR: ${state.credits}  |  Tlen: ${state.oxygen}  |  Paliwo: ${state.fuel}  |  Ładownia: ${cargoUsed()}/${state.cargoCap}`;
}
function consumeTurn() {
  state.oxygen = Math.max(0, state.oxygen - 1);
  state.fuel = Math.max(0, state.fuel - 1);
  refreshResources();
}
function isDead() { return state.oxygen <= 0 || state.fuel <= 0; }

function typeTitle(t){
  return ["Stacja","Planeta","Asteroidy","Wrak","Anomalia"][t] ?? "?";
}
function typeDesc(t){
  switch(t){
    case HexType.STACJA: return "Port pełen neonów. Handel, naprawy, kontrakty (wkrótce).";
    case HexType.PLANETA: return "Lokalny rynek ma braki i nadwyżki. Ceny falują z czasem.";
    case HexType.ASTEROIDY: return "Bogate złoża. Wydobycie daje rudę, ale zajmuje turę (już zapłaconą ruchem).";
    case HexType.WRAK: return "Cichy kadłub w próżni. Loot albo pułapka.";
    case HexType.ANOMALIA: return "Zjawisko nienaturalne. Skany warte fortunę? Albo walka.";
    default: return "";
  }
}

// --- Hex math (axial pointy-top) ---
const HEX_SIZE = 34;

function axialToPixel(q,r){
  const x = HEX_SIZE * (Math.sqrt(3)*q + Math.sqrt(3)/2*r);
  const y = HEX_SIZE * (3/2*r);
  return {x,y};
}
function neighbors(q,r){
  return [
    {q:q+1,r},{q:q-1,r},
    {q,r:r+1},{q,r:r-1},
    {q:q+1,r:r-1},{q:q-1,r:r+1},
  ];
}
function key(q,r){ return `${q},${r}`; }

// --- Economy ---
function makeMarketForType(t){
  const supply = new Map(Goods.map(g => [g.id, 0]));
  const demand = new Map(Goods.map(g => [g.id, 0]));
  const shock  = new Map(Goods.map(g => [g.id, 1.0]));

  if (t === HexType.STACJA){
    supply.set(1, 8); supply.set(3, 6);
    demand.set(0, 5); demand.set(5, 4);
  } else if (t === HexType.PLANETA){
    supply.set(2, 8); supply.set(0, 3);
    demand.set(4, 3); demand.set(3, 2);
  } else if (t === HexType.ASTEROIDY){
    supply.set(0, 10);
    demand.set(1, 3);
  } else if (t === HexType.WRAK){
    supply.set(5, 6); supply.set(3, 3);
    demand.set(4, 2);
  } else if (t === HexType.ANOMALIA){
    supply.set(5, 4); demand.set(5, 4);
  }
  return { supply, demand, shock };
}
function price(market, goodId){
  const g = Goods.find(x => x.id === goodId);
  const base = g.base;
  const s = market.supply.get(goodId) ?? 0;
  const d = market.demand.get(goodId) ?? 0;
  const sh = market.shock.get(goodId) ?? 1.0;
  const p = base * (1 + 0.12*d) * (1 - 0.07*s) * sh;
  return Math.max(1, Math.round(p));
}
function tickMarket(market){
  for (const g of Goods){
    let sh = market.shock.get(g.id) ?? 1.0;
    sh = lerp(sh, 1.0, 0.15);
    if ((randInt(1,30)) === 1){
      sh *= randFloat(0.8, 1.35);
    }
    market.shock.set(g.id, clamp(sh, 0.6, 1.8));
  }
}

// --- Helpers ---
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }
function randInt(a,b){ return Math.floor(state.rng()*(b-a+1))+a; }
function randFloat(a,b){ return state.rng()*(b-a)+a; }
function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- World generation ---
const RADIUS = 5;
const world = {
  hexes: new Map(),
  discovered: new Set(),
  player: { q:0, r:0 },
  current: null,
};

function pickHexType(){
  const roll = randInt(1,100);
  if (roll <= 10) return HexType.ANOMALIA;
  if (roll <= 25) return HexType.WRAK;
  if (roll <= 45) return HexType.ASTEROIDY;
  return HexType.PLANETA;
}

function generateWorld(){
  world.hexes.clear(); world.discovered.clear();
  for (let q=-RADIUS; q<=RADIUS; q++){
    for (let r=-RADIUS; r<=RADIUS; r++){
      if (Math.abs(q+r) > RADIUS) continue;
      const t = pickHexType();
      world.hexes.set(key(q,r), {
        q,r, type:t, market: makeMarketForType(t),
      });
    }
  }
  // start
  const start = world.hexes.get(key(0,0));
  start.type = HexType.STACJA;
  start.market = makeMarketForType(HexType.STACJA);
  world.player = {q:0,r:0};
  enterHex(0,0);
}

function enterHex(q,r){
  const h = world.hexes.get(key(q,r));
  if (!h) return;
  world.discovered.add(key(q,r));
  tickMarket(h.market);
  world.current = h;
  showEvent(h);
  refreshResources();
}

// --- UI hooks ---
const ui = {
  resEl: document.getElementById("resources"),
  logEl: document.getElementById("log"),

  eventCard: document.getElementById("eventCard"),
  eventTitle: document.getElementById("eventTitle"),
  eventDesc: document.getElementById("eventDesc"),
  btnMarket: document.getElementById("btnMarket"),
  btnAction: document.getElementById("btnAction"),
  btnFight: document.getElementById("btnFight"),
  btnClose: document.getElementById("btnClose"),

  marketCard: document.getElementById("marketCard"),
  marketTitle: document.getElementById("marketTitle"),
  marketList: document.getElementById("marketList"),
  btnMarketClose: document.getElementById("btnMarketClose"),
};

function showEvent(h){
  ui.marketCard.style.display = "none";
  ui.eventCard.style.display = "block";
  ui.eventTitle.textContent = `${typeTitle(h.type)} [${h.q},${h.r}]`;
  ui.eventDesc.textContent = typeDesc(h.type);

  const canMarket = (h.type === HexType.STACJA || h.type === HexType.PLANETA);
  const canAction = (h.type === HexType.ASTEROIDY || h.type === HexType.WRAK);
  const canFight  = (h.type === HexType.WRAK || h.type === HexType.ANOMALIA);

  ui.btnMarket.style.display = canMarket ? "inline-block" : "none";
  ui.btnAction.style.display = canAction ? "inline-block" : "none";
  ui.btnFight.style.display  = canFight  ? "inline-block" : "none";
}

function showMarket(h){
  ui.eventCard.style.display = "none";
  ui.marketCard.style.display = "block";
  ui.marketTitle.textContent = `Rynek — ${typeTitle(h.type)}`;

  ui.marketList.innerHTML = "";
  for (const g of Goods){
    const p = price(h.market, g.id);

    const name = document.createElement("div");
    const owned = state.cargo.get(g.id) ?? 0;
    name.textContent = `${g.name} | ${p} CR (masz: ${owned})`;

    const buy = document.createElement("button");
    buy.textContent = "Kup";
    buy.onclick = () => {
      if (state.credits < p) return log("Brak kredytów.");
      if (cargoUsed() >= state.cargoCap) return log("Brak miejsca w ładowni.");
      state.credits -= p;
      state.cargo.set(g.id, (state.cargo.get(g.id) ?? 0) + 1);
      refreshResources();
      log(`Kupiono ${g.name} (-${p} CR).`);
      showMarket(h);
    };

    const sell = document.createElement("button");
    sell.textContent = "Sprzedaj";
    sell.onclick = () => {
      if ((state.cargo.get(g.id) ?? 0) <= 0) return log(`Nie masz ${g.name}.`);
      state.cargo.set(g.id, (state.cargo.get(g.id) ?? 0) - 1);
      state.credits += p;
      refreshResources();
      log(`Sprzedano ${g.name} (+${p} CR).`);
      showMarket(h);
    };

    ui.marketList.appendChild(name);
    ui.marketList.appendChild(buy);
    ui.marketList.appendChild(sell);
  };
}

ui.btnMarket.onclick = () => showMarket(world.current);
ui.btnMarketClose.onclick = () => { ui.marketCard.style.display = "none"; };
ui.btnClose.onclick = () => { ui.eventCard.style.display = "none"; };

ui.btnAction.onclick = () => {
  const h = world.current;
  if (h.type === HexType.ASTEROIDY){
    const gain = randInt(1,3);
    if (cargoUsed()+gain > state.cargoCap) return log("Brak miejsca w ładowni.");
    state.cargo.set(0, (state.cargo.get(0) ?? 0)+gain); // Ruda
    refreshResources();
    log(`Wydobyto rudy: +${gain}`);
  } else if (h.type === HexType.WRAK){
    const roll = randInt(1,100);
    if (roll <= 60){
      const gain = randInt(1,2);
      if (cargoUsed()+gain > state.cargoCap) return log("Znaleziono części, ale brak miejsca.");
      state.cargo.set(3, (state.cargo.get(3) ?? 0)+gain); // Części
      refreshResources();
      log(`Znaleziono części: +${gain}`);
    } else {
      state.oxygen = Math.max(0, state.oxygen - 1);
      refreshResources();
      log("Pułapka! Tracisz 1 tlen.");
    }
  }
};

ui.btnFight.onclick = () => {
  // placeholder: walka jako ryzyko/nagroda (szybkie MVP)
  const roll = randInt(1,100);
  if (roll <= 55){
    if (cargoUsed() >= state.cargoCap) return log("Wygrana, ale brak miejsca na dane.");
    state.cargo.set(5, (state.cargo.get(5) ?? 0)+1); // Dane
    refreshResources();
    log("Wygrana! Zbierasz Dane (+1).");
  } else {
    state.credits = Math.max(0, state.credits - 20);
    state.oxygen = Math.max(0, state.oxygen - 1);
    refreshResources();
    log("Przegrana… tracisz 20 CR i 1 tlen.");
  }
};

// --- Phaser render ---
class MainScene extends Phaser.Scene {
  constructor(){ super("Main"); }
  create(){
    this.cameras.main.setBackgroundColor("#0b0d14");
    this.graphics = this.add.graphics();

    generateWorld();
    refreshResources();
    log("Start. Klikaj sąsiednie heksy, żeby się poruszać.");

    this.input.on("pointerdown", (pointer) => {
      const {x,y} = pointer.positionToCamera(this.cameras.main);
      const w = this.scale.width;
      const h = this.scale.height;

      // center map
      const px = x - w/2;
      const py = y - h/2;

      const a = pixelToAxial(px, py);
      const ar = axialRound(a.q, a.r);
      tryMove(ar.q, ar.r);
    });
  }

  update(){
    this.drawWorld();
  }

  drawWorld(){
    const g = this.graphics;
    g.clear();

    const w = this.scale.width;
    const h = this.scale.height;
    const ox = w/2, oy = h/2;

    for (const hex of world.hexes.values()){
      const p = axialToPixel(hex.q, hex.r);
      const isDisc = world.discovered.has(key(hex.q,hex.r));
      const fill = isDisc ? typeColor(hex.type) : 0x2a2a33;

      drawHex(g, ox+p.x, oy+p.y, HEX_SIZE, fill, 1.0, 0x000000, 0.35);
    }

    // player
    const pp = axialToPixel(world.player.q, world.player.r);
    g.fillStyle(0xe8eaf6, 1);
    g.fillCircle(ox+pp.x, oy+pp.y, 8);
  }
}

function typeColor(t){
  switch(t){
    case HexType.STACJA: return 0x2ad4e6;
    case HexType.PLANETA: return 0x38d26a;
    case HexType.ASTEROIDY: return 0xb7b7b7;
    case HexType.WRAK: return 0xf29b43;
    case HexType.ANOMALIA: return 0x9b4df2;
    default: return 0x666666;
  }
}

function drawHex(graphics, cx, cy, size, fillColor, fillAlpha, lineColor, lineAlpha){
  const pts = [];
  for (let i=0; i<6; i++){
    const ang = Phaser.Math.DegToRad(60*i - 30);
    pts.push({ x: cx + Math.cos(ang)*size, y: cy + Math.sin(ang)*size });
  }
  graphics.fillStyle(fillColor, fillAlpha);
  graphics.beginPath();
  graphics.moveTo(pts[0].x, pts[0].y);
  for (let i=1; i<6; i++) graphics.lineTo(pts[i].x, pts[i].y);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(2, lineColor, lineAlpha);
  graphics.beginPath();
  graphics.moveTo(pts[0].x, pts[0].y);
  for (let i=1; i<6; i++) graphics.lineTo(pts[i].x, pts[i].y);
  graphics.lineTo(pts[0].x, pts[0].y);
  graphics.strokePath();
}

function pixelToAxial(x,y){
  const q = (Math.sqrt(3)/3*x - 1/3*y) / HEX_SIZE;
  const r = (2/3*y) / HEX_SIZE;
  return {q,r};
}
function axialRound(q,r){
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
  else if (y_diff > z_diff) ry = -rx - rz;
  else rz = -rx - ry;

  return { q: rx, r: rz };
}

function tryMove(q,r){
  const target = world.hexes.get(key(q,r));
  if (!target) return;

  const cur = world.player;
  const neigh = neighbors(cur.q, cur.r);
  const ok = neigh.some(n => n.q === q && n.r === r);
  if (!ok) return log("Za daleko. Ruch tylko na sąsiedni heks.");

  consumeTurn();
  if (isDead()){
    log("Zabrakło tlenu/paliwa. Koniec wyprawy (MVP). Odśwież stronę.");
    return;
  }

  world.player = {q,r};
  enterHex(q,r);
}

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 600,
  backgroundColor: "#0b0d14",
  scene: [MainScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};

new Phaser.Game(config);
