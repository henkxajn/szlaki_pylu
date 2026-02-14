// Szlaki Pyłu — Web MVP v2.1
// Fix: przycisk Instalacje działa niezawodnie (guard na brak econ).
// Nowość: Skaner (inspektor) z opisem heksa + mini-grafiką planety.

const HexType = { SUN:0, SPACE:1, PLANET:2 };

const Goods = [
  { id:0, name:"Ruda", base:12 },
  { id:1, name:"Paliwo", base:20 },
  { id:2, name:"Żywność", base:10 },
  { id:3, name:"Części", base:18 },
  { id:4, name:"Medy", base:16 },
  { id:5, name:"Dane", base:22 },
  { id:6, name:"Tlen (kanister)", base:14 },
];

const Installations = [
  { id:"OXYGEN_PLANT", name:"Instalacja tlenu", cost:80,  produces:{ good:6, per_tick:2 }, desc:"Produkuje kanistry tlenu." },
  { id:"MINE",         name:"Kopalnia",         cost:90,  produces:{ good:0, per_tick:2 }, desc:"Wydobywa rudę." },
  { id:"FARM",         name:"Biofarma",         cost:70,  produces:{ good:2, per_tick:2 }, desc:"Produkuje żywność." },
  { id:"LAB",          name:"Laboratorium",     cost:110, produces:{ good:5, per_tick:1 }, desc:"Wytwarza dane/sygnały." },
];

const state = {
  credits: 140,
  oxygen: 12,
  fuel: 12,
  cargoCap: 14,
  cargo: new Map(Goods.map(g => [g.id, 0])),
  rng: mulberry32((Date.now() >>> 0) ^ 0xC0FFEE),
  ticks: 0,
};

function cargoUsed() { let s=0; for (const v of state.cargo.values()) s+=v; return s; }
function log(msg) { ui.logEl.textContent += msg + "\n"; ui.logEl.scrollTop = ui.logEl.scrollHeight; }
function refreshResources() {
  ui.resEl.textContent = `CR: ${state.credits}  |  Tlen: ${state.oxygen}  |  Paliwo: ${state.fuel}  |  Ładownia: ${cargoUsed()}/${state.cargoCap}`;
}
function consumeTurn() { state.oxygen = Math.max(0, state.oxygen - 1); state.fuel = Math.max(0, state.fuel - 1); refreshResources(); }
function isDead(){ return state.oxygen <= 0 || state.fuel <= 0; }

// --- Hex math ---
const HEX_SIZE = 34;
function axialToPixel(q,r){
  const x = HEX_SIZE * (Math.sqrt(3)*q + Math.sqrt(3)/2*r);
  const y = HEX_SIZE * (3/2*r);
  return {x,y};
}
function pixelToAxial(x,y){
  const q = (Math.sqrt(3)/3*x - 1/3*y) / HEX_SIZE;
  const r = (2/3*y) / HEX_SIZE;
  return {q,r};
}
function axialRound(q,r){
  let x=q, z=r, y=-x-z;
  let rx=Math.round(x), ry=Math.round(y), rz=Math.round(z);
  const x_diff=Math.abs(rx-x), y_diff=Math.abs(ry-y), z_diff=Math.abs(rz-z);
  if (x_diff>y_diff && x_diff>z_diff) rx=-ry-rz;
  else if (y_diff>z_diff) ry=-rx-rz;
  else rz=-rx-ry;
  return {q:rx, r:rz};
}
function neighbors(q,r){
  return [
    {q:q+1,r},{q:q-1,r},
    {q,r:r+1},{q,r:r-1},
    {q:q+1,r:r-1},{q:q-1,r:r+1},
  ];
}
function key(q,r){ return `${q},${r}`; }
function hexDistance(q1,r1,q2,r2){
  const dq = q1-q2;
  const dr = r1-r2;
  const ds = (q1+r1) - (q2+r2);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

// --- Biomes ---
const Biomes = [
  { id:"MARS",   name:"Marsopodobna",  color:"#d3543a", ring:false, tags:["ruda+", "tlen-"] },
  { id:"SATURN", name:"Gazowy gigant", color:"#d9c27a", ring:true,  tags:["paliwo+", "dane+"] },
  { id:"OCEAN",  name:"Oceaniczna",    color:"#2f7fd6", ring:false, tags:["żywność+", "medy+"] },
  { id:"ICE",    name:"Lodowa",        color:"#8fd3ff", ring:false, tags:["tlen+", "medy+"] },
  { id:"JUNGLE", name:"Dżungla",       color:"#2ecc71", ring:false, tags:["żywność+", "dane-"] },
  { id:"BARREN", name:"Jałowa",        color:"#9aa0a6", ring:false, tags:["części+", "ruda+"] },
];
function biomeForHex(q,r){
  const h = hash2(q,r);
  return Biomes[h % Biomes.length];
}

// --- Economy ---
function makePlanetEconomy(biome){
  const stock = new Map(Goods.map(g => [g.id, 0]));
  const demand = new Map(Goods.map(g => [g.id, 0]));
  const shock = new Map(Goods.map(g => [g.id, 1.0]));
  const installs = [];

  for (const g of Goods){
    stock.set(g.id, randInt(0, 6));
    demand.set(g.id, randInt(0, 3));
  }

  if (biome.id === "MARS"){
    stock.set(0, stock.get(0)+8);
    stock.set(6, Math.max(0, stock.get(6)-3));
    demand.set(6, demand.get(6)+3);
  } else if (biome.id === "ICE"){
    stock.set(6, stock.get(6)+8);
    demand.set(0, demand.get(0)+2);
  } else if (biome.id === "SATURN"){
    stock.set(1, stock.get(1)+6);
    stock.set(5, stock.get(5)+3);
    demand.set(2, demand.get(2)+2);
  } else if (biome.id === "OCEAN"){
    stock.set(2, stock.get(2)+7);
    demand.set(1, demand.get(1)+2);
  } else if (biome.id === "JUNGLE"){
    stock.set(2, stock.get(2)+6);
    demand.set(4, demand.get(4)+2);
  } else if (biome.id === "BARREN"){
    stock.set(3, stock.get(3)+6);
    stock.set(0, stock.get(0)+4);
  }
  return { stock, demand, shock, installs };
}

function ensurePlanetEconomy(planet){
  if (!planet.econ && planet.biome){
    planet.econ = makePlanetEconomy(planet.biome);
  }
  if (!planet.econ){
    // fallback (nie powinno się zdarzyć)
    planet.econ = makePlanetEconomy(Biomes[0]);
  }
}

function price(econ, goodId){
  const base = Goods.find(g=>g.id===goodId).base;
  const s = econ.stock.get(goodId) ?? 0;
  const d = econ.demand.get(goodId) ?? 0;
  const sh = econ.shock.get(goodId) ?? 1.0;
  const p = base * (1 + 0.10*d) * (1.0 - 0.04*Math.min(20, s)) * sh;
  return Math.max(1, Math.round(p));
}

function tickEconomy(econ){
  for (const inst of econ.installs){
    const def = Installations.find(x=>x.id===inst.id);
    if (!def) continue;
    const add = def.produces.per_tick * inst.level;
    const g = def.produces.good;
    econ.stock.set(g, (econ.stock.get(g) ?? 0) + add);
  }

  for (const g of Goods){
    let sh = econ.shock.get(g.id) ?? 1.0;
    sh = lerp(sh, 1.0, 0.12);
    if (randInt(1, 28) === 1) sh *= randFloat(0.82, 1.28);
    econ.shock.set(g.id, clamp(sh, 0.6, 1.8));

    if (randInt(1, 12) === 1){
      const cur = econ.demand.get(g.id) ?? 0;
      econ.demand.set(g.id, clamp(cur + randInt(-1,1), 0, 6));
    }
  }
}

// --- World ---
const RADIUS = 7;
const world = { hexes: new Map(), player: { q: 0, r: 1 }, current: null };

function generateWorld(){
  world.hexes.clear();
  for (let q=-RADIUS; q<=RADIUS; q++){
    for (let r=-RADIUS; r<=RADIUS; r++){
      if (Math.abs(q+r) > RADIUS) continue;
      world.hexes.set(key(q,r), { q,r, type: HexType.SPACE });
    }
  }
  world.hexes.set(key(0,0), { q:0, r:0, type: HexType.SUN });

  const planetCount = 18;
  let attempts = 0, placed = 0;

  while (placed < planetCount && attempts < 6000){
    attempts++;
    const q = randInt(-RADIUS, RADIUS);
    const r = randInt(-RADIUS, RADIUS);
    if (Math.abs(q+r) > RADIUS) continue;
    if (q === 0 && r === 0) continue;

    const k = key(q,r);
    const cell = world.hexes.get(k);
    if (!cell || cell.type !== HexType.SPACE) continue;

    const neigh = neighbors(q,r);
    if (neigh.some(n => (world.hexes.get(key(n.q,n.r))?.type === HexType.PLANET))) continue;

    if (hexDistance(q,r, 0,0) <= 1) continue;

    const biome = biomeForHex(q,r);
    world.hexes.set(k, { q,r, type: HexType.PLANET, biome, econ: makePlanetEconomy(biome) });
    placed++;
  }

  world.player = {q:0, r:1};
  enterHex(world.player.q, world.player.r);
  log("Mapa: Słońce w centrum, planety rozrzucone w pustce (oddzielone SPACE).");
  log("Tlen jest towarem: kup 'Tlen (kanister)' i zużyj Akcją (+6 tlenu).");
}

function enterHex(q,r){
  const h = world.hexes.get(key(q,r));
  if (!h) return;
  world.current = h;

  state.ticks++;
  for (const cell of world.hexes.values()){
    if (cell.type === HexType.PLANET){
      ensurePlanetEconomy(cell);
      tickEconomy(cell.econ);
    }
  }

  showEvent(h);
  renderInspector(h);
  refreshResources();
}

// --- UI refs ---
const ui = {
  resEl: document.getElementById("resources"),
  logEl: document.getElementById("log"),

  inspectTitle: document.getElementById("inspectTitle"),
  inspectDesc: document.getElementById("inspectDesc"),
  inspectMeta: document.getElementById("inspectMeta"),
  planetCanvas: document.getElementById("planetCanvas"),

  eventCard: document.getElementById("eventCard"),
  eventTitle: document.getElementById("eventTitle"),
  eventDesc: document.getElementById("eventDesc"),
  planetTags: document.getElementById("planetTags"),

  btnMarket: document.getElementById("btnMarket"),
  btnInstall: document.getElementById("btnInstall"),
  btnAction: document.getElementById("btnAction"),
  btnFight: document.getElementById("btnFight"),
  btnClose: document.getElementById("btnClose"),

  marketCard: document.getElementById("marketCard"),
  marketTitle: document.getElementById("marketTitle"),
  marketList: document.getElementById("marketList"),
  btnMarketClose: document.getElementById("btnMarketClose"),

  installCard: document.getElementById("installCard"),
  installTitle: document.getElementById("installTitle"),
  installDesc: document.getElementById("installDesc"),
  installList: document.getElementById("installList"),
  btnInstallClose: document.getElementById("btnInstallClose"),
};

function showEvent(h){
  ui.marketCard.style.display = "none";
  ui.installCard.style.display = "none";
  ui.eventCard.style.display = "block";

  ui.eventTitle.textContent = titleForHex(h);
  ui.eventDesc.textContent = descForHex(h);

  const canMarket = (h.type === HexType.PLANET);
  const canInstall = (h.type === HexType.PLANET);
  const canAction = (h.type === HexType.PLANET);

  ui.btnMarket.style.display = canMarket ? "inline-block" : "none";
  ui.btnInstall.style.display = canInstall ? "inline-block" : "none";
  ui.btnAction.style.display = canAction ? "inline-block" : "none";
  ui.btnFight.style.display  = "none";
  ui.planetTags.innerHTML = "";

  if (h.type === HexType.PLANET){
    ui.planetTags.innerHTML = h.biome.tags.map(t=>`<span class="pill">${t}</span>`).join(" ");
  }
}

function titleForHex(h){
  if (h.type === HexType.SUN) return "Słońce [0,0]";
  if (h.type === HexType.SPACE) return `Pustka [${h.q},${h.r}]`;
  if (h.type === HexType.PLANET) return `Planeta: ${h.biome.name} [${h.q},${h.r}]`;
  return "?";
}
function descForHex(h){
  if (h.type === HexType.SUN) return "Centrum układu. Na razie brak akcji.";
  if (h.type === HexType.SPACE) return "Pusta przestrzeń między planetami. Zużywasz tlen/paliwo na przelot.";
  if (h.type === HexType.PLANET) return "Handluj zasobami i kupuj instalacje (produkcja zasila magazyn planety).";
  return "";
}

// --- Inspector (ładny opis + grafika) ---
function renderInspector(h){
  ui.inspectTitle.textContent = "Skaner";
  ui.inspectDesc.textContent = titleForHex(h);
  let meta = [];

  if (h.type === HexType.PLANET){
    ensurePlanetEconomy(h);
    // top 3 ceny (najdroższe) jako “braki”
    const prices = Goods.map(g => ({g, p: price(h.econ, g.id), stock: h.econ.stock.get(g.id) ?? 0}))
      .sort((a,b)=>b.p-a.p);
    const scarce = prices.slice(0,3).map(x=>`${x.g.name} (${x.p} CR)`).join(", ");

    // instalacje
    const inst = (h.econ.installs.length === 0) ? "brak" :
      h.econ.installs.map(i => `${Installations.find(d=>d.id===i.id)?.name ?? i.id} lvl ${i.level}`).join(" • ");

    meta.push(`Biome: ${h.biome.name}`);
    meta.push(`Drogie tu: ${scarce}`);
    meta.push(`Instalacje: ${inst}`);
  } else if (h.type === HexType.SUN){
    meta.push("Promieniowanie ekstremalne.");
    meta.push("Z czasem: misje naukowe / megastruktury.");
  } else {
    meta.push("Brak infrastruktury.");
    meta.push("To tylko przelot.");
  }

  ui.inspectMeta.textContent = meta.join("  |  ");
  drawInspectorArt(h);
}

function drawInspectorArt(h){
  const c = ui.planetCanvas;
  const ctx = c.getContext("2d");
  const w = c.width, hh = c.height;
  ctx.clearRect(0,0,w,hh);

  // tło
  const grd = ctx.createRadialGradient(w*0.35, hh*0.25, 10, w*0.5, hh*0.5, w*0.7);
  grd.addColorStop(0, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(0,0,w,hh);
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,w,hh);

  // gwiazdki
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  for (let i=0;i<18;i++){
    const x = (i*37 % w);
    const y = (i*53 % hh);
    ctx.beginPath();
    ctx.arc(x,y, (i%3===0)?1.3:0.9, 0, Math.PI*2);
    ctx.fill();
  }

  const cx=w/2, cy=hh/2;

  if (h.type === HexType.SUN){
    // słońce
    ctx.beginPath(); ctx.fillStyle="#ffd166"; ctx.arc(cx,cy,28,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle="rgba(255,120,0,0.20)"; ctx.arc(cx,cy,40,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.fillStyle="rgba(255,255,255,0.12)"; ctx.arc(cx-10,cy-10,10,0,Math.PI*2); ctx.fill();
    return;
  }

  if (h.type === HexType.SPACE){
    // mgiełka
    ctx.beginPath(); ctx.fillStyle="rgba(120,160,255,0.08)"; ctx.arc(cx+8,cy+2,36,0,Math.PI*2); ctx.fill();
    return;
  }

  // planeta
  const color = h.biome?.color ?? "#9aa0a6";
  // cień
  ctx.beginPath(); ctx.fillStyle="rgba(0,0,0,0.35)"; ctx.arc(cx+8,cy+10,26,0,Math.PI*2); ctx.fill();
  // glob
  ctx.beginPath(); ctx.fillStyle=color; ctx.arc(cx,cy,26,0,Math.PI*2); ctx.fill();
  // highlight
  ctx.beginPath(); ctx.fillStyle="rgba(255,255,255,0.12)"; ctx.arc(cx-10,cy-12,12,0,Math.PI*2); ctx.fill();

  // ring
  if (h.biome?.ring){
    ctx.strokeStyle="rgba(255,255,255,0.22)";
    ctx.lineWidth=3;
    ctx.beginPath();
    ctx.ellipse(cx, cy+2, 40, 16, -0.4, 0, Math.PI*2);
    ctx.stroke();
  }
}

// --- Market / Installations ---
function showMarket(planet){
  ensurePlanetEconomy(planet);

  ui.eventCard.style.display = "none";
  ui.installCard.style.display = "none";
  ui.marketCard.style.display = "block";

  ui.marketTitle.textContent = `Rynek — ${planet.biome.name}`;
  ui.marketList.innerHTML = "";

  for (const g of Goods){
    const p = price(planet.econ, g.id);
    const owned = state.cargo.get(g.id) ?? 0;
    const stock = planet.econ.stock.get(g.id) ?? 0;

    const name = document.createElement("div");
    name.textContent = `${g.name} | ${p} CR (magazyn: ${stock}, masz: ${owned})`;

    const buy = document.createElement("button");
    buy.textContent = "Kup";
    buy.disabled = stock <= 0;
    buy.onclick = () => {
      if (state.credits < p) return log("Brak kredytów.");
      if (cargoUsed() >= state.cargoCap) return log("Brak miejsca w ładowni.");
      if ((planet.econ.stock.get(g.id) ?? 0) <= 0) return log("Brak towaru w magazynie planety.");

      state.credits -= p;
      state.cargo.set(g.id, owned + 1);
      planet.econ.stock.set(g.id, stock - 1);

      refreshResources();
      log(`Kupiono ${g.name} (-${p} CR).`);
      showMarket(planet);
      renderInspector(planet);
    };

    const sell = document.createElement("button");
    sell.textContent = "Sprzedaj";
    sell.disabled = owned <= 0;
    sell.onclick = () => {
      if (owned <= 0) return log(`Nie masz ${g.name}.`);
      state.cargo.set(g.id, owned - 1);
      planet.econ.stock.set(g.id, stock + 1);
      state.credits += p;

      refreshResources();
      log(`Sprzedano ${g.name} (+${p} CR).`);
      showMarket(planet);
      renderInspector(planet);
    };

    ui.marketList.appendChild(name);
    ui.marketList.appendChild(buy);
    ui.marketList.appendChild(sell);
  }
}

function showInstallations(planet){
  ensurePlanetEconomy(planet);

  ui.eventCard.style.display = "none";
  ui.marketCard.style.display = "none";
  ui.installCard.style.display = "block";

  ui.installTitle.textContent = `Instalacje — ${planet.biome.name}`;
  ui.installDesc.textContent = "Co turę produkują towary do magazynu planety (zasilają lokalny rynek).";
  ui.installList.innerHTML = "";

  for (const inst of Installations){
    const found = planet.econ.installs.find(x=>x.id===inst.id);
    const level = found ? found.level : 0;

    const row = document.createElement("div");
    row.innerHTML = `<div><b>${inst.name}</b> <span class="pill">lvl ${level}</span>
      <div class="muted" style="font-size:12px">${inst.desc} (+${inst.produces.per_tick}/tik/poziom)</div>
      <div class="muted" style="font-size:12px">Koszt: ${inst.cost} CR</div></div>`;

    const btn = document.createElement("button");
    btn.textContent = (level === 0) ? "Kup" : "Ulepsz";
    btn.disabled = state.credits < inst.cost;
    btn.onclick = () => {
      if (state.credits < inst.cost) return log("Brak kredytów.");
      state.credits -= inst.cost;

      const existing = planet.econ.installs.find(x=>x.id===inst.id);
      if (existing) existing.level += 1;
      else planet.econ.installs.push({id: inst.id, level: 1});

      refreshResources();
      log(`Instalacja: ${inst.name} → poziom ${(existing?.level) ?? 1}.`);
      showInstallations(planet);
      renderInspector(planet);
    };

    ui.installList.appendChild(row);
    ui.installList.appendChild(btn);
  }
}

function doPlanetAction(){
  const oxyId = 6;
  const have = state.cargo.get(oxyId) ?? 0;
  if (have > 0){
    state.cargo.set(oxyId, have - 1);
    state.oxygen += 6;
    refreshResources();
    log("Zużyto kanister tlenu: +6 tlenu.");
    renderInspector(world.current);
  } else {
    log("Brak kanistra tlenu w ładowni. Kup go na rynku albo postaw instalację tlenu.");
  }
}

// --- Button handlers (robust) ---
ui.btnMarket.onclick = () => { const h=world.current; if (h?.type===HexType.PLANET) showMarket(h); };
ui.btnInstall.onclick = () => { const h=world.current; if (h?.type===HexType.PLANET) showInstallations(h); else log("Instalacje dostępne tylko na planetach."); };
ui.btnAction.onclick = () => { const h=world.current; if (h?.type===HexType.PLANET) doPlanetAction(); };
ui.btnMarketClose.onclick = () => { ui.marketCard.style.display = "none"; };
ui.btnInstallClose.onclick = () => { ui.installCard.style.display = "none"; };
ui.btnClose.onclick = () => { ui.eventCard.style.display = "none"; };

// --- Phaser render ---
class MainScene extends Phaser.Scene {
  constructor(){ super("Main"); }
  create(){
    this.cameras.main.setBackgroundColor("#070914");
    this.graphics = this.add.graphics();

    generateWorld();
    refreshResources();
    log("Start. Klikaj sąsiednie heksy, by lecieć przez pustkę do planet.");

    this.input.on("pointerdown", (pointer) => {
      const {x,y} = pointer.positionToCamera(this.cameras.main);
      const w = this.scale.width;
      const h = this.scale.height;
      const px = x - w/2;
      const py = y - h/2;

      const a = pixelToAxial(px, py);
      const ar = axialRound(a.q, a.r);
      tryMove(ar.q, ar.r);
    });
  }

  update(){ this.drawWorld(); }

  drawWorld(){
    const g = this.graphics;
    g.clear();

    const w = this.scale.width;
    const h = this.scale.height;
    const ox = w/2, oy = h/2;

    // tło gwiazd
    g.fillStyle(0xffffff, 0.06);
    for (let i=0; i<80; i++){
      const sx = (i*131 % w);
      const sy = (i*271 % h);
      g.fillCircle(sx, sy, (i%3===0)?1:0.7);
    }

    for (const cell of world.hexes.values()){
      const p = axialToPixel(cell.q, cell.r);
      const cx = ox + p.x;
      const cy = oy + p.y;

      const fill = (cell.type === HexType.SPACE) ? 0x0f1320 : (cell.type === HexType.SUN ? 0x241406 : 0x101827);
      drawHex(g, cx, cy, HEX_SIZE, fill, 0.95, 0x000000, 0.35);

      if (cell.type === HexType.SUN) drawSun(g, cx, cy);
      if (cell.type === HexType.PLANET) drawPlanet(g, cx, cy, cell.biome);
    }

    const pp = axialToPixel(world.player.q, world.player.r);
    g.fillStyle(0xe8eaf6, 1);
    g.fillCircle(ox+pp.x, oy+pp.y, 8);

    if (world.current){
      const cp = axialToPixel(world.current.q, world.current.r);
      drawHexOutline(g, ox+cp.x, oy+cp.y, HEX_SIZE, 0xffffff, 0.22, 3);
    }
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

function drawHexOutline(graphics, cx, cy, size, lineColor, lineAlpha, width){
  const pts = [];
  for (let i=0; i<6; i++){
    const ang = Phaser.Math.DegToRad(60*i - 30);
    pts.push({ x: cx + Math.cos(ang)*size, y: cy + Math.sin(ang)*size });
  }
  graphics.lineStyle(width, lineColor, lineAlpha);
  graphics.beginPath();
  graphics.moveTo(pts[0].x, pts[0].y);
  for (let i=1; i<6; i++) graphics.lineTo(pts[i].x, pts[i].y);
  graphics.lineTo(pts[0].x, pts[0].y);
  graphics.strokePath();
}

function drawPlanet(g, cx, cy, biome){
  g.fillStyle(0x000000, 0.35);
  g.fillCircle(cx+5, cy+6, 14);

  const col = Phaser.Display.Color.HexStringToColor(biome.color).color;
  g.fillStyle(col, 1.0);
  g.fillCircle(cx, cy, 14);

  g.fillStyle(0xffffff, 0.10);
  g.fillCircle(cx-5, cy-6, 6);

  if (biome.ring){
    g.lineStyle(3, 0xffffff, 0.22);
    g.beginPath();
    g.ellipse(cx, cy+1, 22, 10, Phaser.Math.DegToRad(-18), 0, Math.PI*2);
    g.strokePath();
  }
}

function drawSun(g, cx, cy){
  g.fillStyle(0xffd166, 0.95);
  g.fillCircle(cx, cy, 18);
  g.fillStyle(0xff7b00, 0.22);
  g.fillCircle(cx, cy, 28);
  g.fillStyle(0xffffff, 0.10);
  g.fillCircle(cx-7, cy-7, 8);
}

function tryMove(q,r){
  const target = world.hexes.get(key(q,r));
  if (!target) return;

  const cur = world.player;
  const ok = neighbors(cur.q, cur.r).some(n => n.q===q && n.r===r);
  if (!ok) return log("Za daleko. Ruch tylko na sąsiedni heks.");

  consumeTurn();
  if (isDead()){
    log("Zabrakło tlenu/paliwa. Koniec wyprawy (MVP). Odśwież stronę.");
    return;
  }
  world.player = {q,r};
  enterHex(q,r);
}

// --- helpers ---
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
function hash2(a,b){
  let x = (a * 374761393) ^ (b * 668265263);
  x = (x ^ (x >> 13)) * 1274126177;
  return (x ^ (x >> 16)) >>> 0;
}

// --- Boot ---
const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 980,
  height: 640,
  backgroundColor: "#070914",
  scene: [MainScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
};
new Phaser.Game(config);
