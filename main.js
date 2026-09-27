/* =========================================================
   BATTLE ARENA 3D
   Fortnite風 3Dアクション/建築/バトルロイヤルライトゲーム
   Three.js r128 使用
   ========================================================= */

// ---------- グローバル状態 ----------
const WORLD_SIZE = 260;
let scene, camera, renderer, clock;
let obstacles = [];      // {mesh, box3} 衝突対象(木・岩・箱・建築物)
let bots = [];
let bullets = [];        // トレーサー表示用
let pickups = [];        // 資材/弾薬ピックアップ
let placedBlocks = [];

let gameRunning = false;
let paused = false;

const keys = {};
let yaw = 0, pitch = 0;
const player = {
  pos: new THREE.Vector3(0, 2, 30),
  vel: new THREE.Vector3(0, 0, 0),
  onGround: false,
  hp: 100,
  shield: 50,
  mats: 100,
  ammo: 30,
  reserveAmmo: 90,
  magSize: 30,
  reloading: false,
  fireCooldown: 0,
  alive: true,
  kills: 0,
  buildMode: 'wall', // wall, floor, stair
};

let stormRadius = 130;
const stormShrinkRate = 0.045; // per second
const stormCenter = new THREE.Vector3(0, 0, 0);
let stormDamageTick = 0;

let aliveCount = 10; // player + 9 bots

// ---------- UI要素 ----------
const $ = id => document.getElementById(id);
const hpFill = $('hpFill'), shieldFill = $('shieldFill');
const ammoEl = $('ammo'), matCountEl = $('matCount');
const aliveCountEl = $('aliveCount'), killCountEl = $('killCount');
const killfeedEl = $('killfeed'), stormWarnEl = $('stormWarn');
const centerMsgEl = $('centerMsg');

// ==========================================================
// 初期化
// ==========================================================
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0f0);
  scene.fog = new THREE.Fog(0x8fd0f0, 80, 230);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  // ライト
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444422, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(80, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  scene.add(sun);

  // 地面
  const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2, 40, 40);
  groundGeo.rotateX(-Math.PI / 2);
  // 軽い起伏
  const posAttr = groundGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), z = posAttr.getZ(i);
    const h = Math.sin(x * 0.03) * Math.cos(z * 0.03) * 1.5;
    posAttr.setY(i, h);
  }
  groundGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, flatShading: true });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // ストームの壁(見た目用の半透明シリンダー)
  const stormGeo = new THREE.CylinderGeometry(stormRadius, stormRadius, 60, 48, 1, true);
  const stormMat = new THREE.MeshBasicMaterial({ color: 0x7c3dff, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  window.stormMesh = new THREE.Mesh(stormGeo, stormMat);
  window.stormMesh.position.y = 25;
  scene.add(window.stormMesh);

  scatterEnvironment();
  spawnBots(9);
  spawnPickups(18);

  window.addEventListener('resize', onResize);
  setupControls();

  animate();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==========================================================
// 環境オブジェクト生成
// ==========================================================
function addObstacle(mesh) {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  obstacles.push({ mesh, box });
  scene.add(mesh);
  return mesh;
}

function scatterEnvironment() {
  const treeMatTrunk = new THREE.MeshStandardMaterial({ color: 0x6b4423 });
  const treeMatLeaf = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true });

  for (let i = 0; i < 70; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.7;
    if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;

    if (Math.random() < 0.65) {
      // 木
      const group = new THREE.Group();
      const trunkH = 3 + Math.random() * 2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, trunkH, 6), treeMatTrunk);
      trunk.position.y = trunkH / 2;
      trunk.castShadow = true;
      group.add(trunk);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 7), treeMatLeaf);
      leaf.position.y = trunkH + 1.8;
      leaf.castShadow = true;
      group.add(leaf);
      group.position.set(x, 0, z);
      addObstacle(group);
    } else {
      // 岩
      const size = 1.2 + Math.random() * 1.5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMat);
      rock.position.set(x, size * 0.5, z);
      rock.castShadow = true;
      addObstacle(rock);
    }
  }

  // 中央付近に建物っぽいプラットフォーム(木箱の山)を配置
  for (let i = 0; i < 6; i++) {
    const x = (Math.random() - 0.5) * 60;
    const z = (Math.random() - 0.5) * 60;
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb5893c });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), crateMat);
    crate.position.set(x, 1, z);
    crate.castShadow = true;
    addObstacle(crate);
  }

  // 境界の見えない壁
  const boundaryMat = new THREE.MeshBasicMaterial({ visible: false });
  const bGeo = new THREE.BoxGeometry(1, 50, WORLD_SIZE * 2);
  [[-WORLD_SIZE, 0], [WORLD_SIZE, 0]].forEach(([x]) => {
    const wall = new THREE.Mesh(bGeo, boundaryMat);
    wall.position.set(x, 25, 0);
    addObstacle(wall);
  });
  const bGeo2 = new THREE.BoxGeometry(WORLD_SIZE * 2, 50, 1);
  [[0, -WORLD_SIZE], [0, WORLD_SIZE]].forEach(([, z]) => {
    const wall = new THREE.Mesh(bGeo2, boundaryMat);
    wall.position.set(0, 25, z);
    addObstacle(wall);
  });
}

function spawnPickups(n) {
  for (let i = 0; i < n; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 1.4;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 1.4;
    const isAmmo = Math.random() < 0.5;
    const geo = isAmmo ? new THREE.BoxGeometry(0.6, 0.6, 0.6) : new THREE.OctahedronGeometry(0.6);
    const mat = new THREE.MeshStandardMaterial({ color: isAmmo ? 0xffd23d : 0x3daaff, emissive: isAmmo ? 0x554400 : 0x002a55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.2, z);
    mesh.castShadow = true;
    scene.add(mesh);
    pickups.push({ mesh, type: isAmmo ? 'ammo' : 'mats' });
  }
}

// ==========================================================
// ボット(CPU敵)
// ==========================================================
function makeBotMesh(color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.2, 4, 8), bodyMat);
  body.position.y = 1.1;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), bodyMat);
  head.position.y = 2.0;
  head.castShadow = true;
  group.add(head);
  return group;
}

function spawnBots(n) {
  const colors = [0xff5050, 0xffa500, 0x50a0ff, 0xaa50ff, 0x50ffaa, 0xff50c8, 0xffff50, 0x50ffff, 0xff8080];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = 60 + Math.random() * 40;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const mesh = makeBotMesh(colors[i % colors.length]);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    bots.push({
      mesh,
      hp: 100,
      alive: true,
      state: 'wander',
      target: new THREE.Vector3(x + (Math.random() - 0.5) * 20, 0, z + (Math.random() - 0.5) * 20),
      fireCooldown: Math.random() * 2,
      wanderCooldown: Math.random() * 3,
      name: 'Bot' + (i + 1),
    });
  }
}

function updateBots(dt) {
  bots.forEach(bot => {
    if (!bot.alive) return;
    const bpos = bot.mesh.position;
    const distToPlayer = bpos.distanceTo(player.pos);

    // ストーム外なら中心へ寄る
    const distFromCenter = Math.hypot(bpos.x - stormCenter.x, bpos.z - stormCenter.z);
    if (distFromCenter > stormRadius - 5) {
      bot.state = 'toCenter';
    } else if (distToPlayer < 45 && player.alive) {
      bot.state = 'chase';
    } else if (bot.state !== 'toCenter') {
      bot.state = 'wander';
    }

    let moveTarget = null;
    if (bot.state === 'chase') {
      moveTarget = player.pos;
    } else if (bot.state === 'toCenter') {
      moveTarget = stormCenter;
    } else {
      bot.wanderCooldown -= dt;
      if (bot.wanderCooldown <= 0) {
        bot.target.set(bpos.x + (Math.random() - 0.5) * 30, 0, bpos.z + (Math.random() - 0.5) * 30);
        bot.wanderCooldown = 3 + Math.random() * 3;
      }
      moveTarget = bot.target;
    }

    if (moveTarget) {
      const dir = new THREE.Vector3(moveTarget.x - bpos.x, 0, moveTarget.z - bpos.z);
      const dist = dir.length();
      if (dist > 1) {
        dir.normalize();
        const speed = bot.state === 'chase' ? 6 : 3.2;
        const nx = bpos.x + dir.x * speed * dt;
        const nz = bpos.z + dir.z * speed * dt;
        if (!collidesXZ(nx, nz, 0.6)) {
          bpos.x = nx; bpos.z = nz;
        }
        bot.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }
    bpos.y = getGroundHeight(bpos.x, bpos.z);

    // 攻撃
    bot.fireCooldown -= dt;
    if (bot.state === 'chase' && distToPlayer < 40 && bot.fireCooldown <= 0 && player.alive) {
      bot.fireCooldown = 1.1 + Math.random() * 0.9;
      const aimPos = bpos.clone(); aimPos.y = 1.6;
      const toPlayer = new THREE.Vector3().subVectors(new THREE.Vector3(player.pos.x, 1.6, player.pos.z), aimPos);
      spawnTracer(aimPos, aimPos.clone().add(toPlayer), 0xff4040);
      // 命中判定(簡易): 距離に応じて命中率低下、建築物で遮蔽ならミス
      const blocked = raycastBlocked(aimPos, new THREE.Vector3(player.pos.x, 1.6, player.pos.z));
      const hitChance = blocked ? 0 : Math.max(0.15, 0.75 - distToPlayer / 60);
      if (Math.random() < hitChance) {
        damagePlayer(6 + Math.random() * 6);
      }
    }
  });
}

function raycastBlocked(from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const dist = dir.length();
  dir.normalize();
  const ray = new THREE.Raycaster(from, dir, 0.1, dist);
  const meshes = placedBlocks.map(b => b.mesh);
  const hits = ray.intersectObjects(meshes, true);
  return hits.length > 0;
}

function killBot(bot) {
  if (!bot.alive) return;
  bot.alive = false;
  scene.remove(bot.mesh);
  aliveCount--;
  updateHUD();
}

// ==========================================================
// 建築システム
// ==========================================================
function getBlockGeometry(type) {
  if (type === 'wall') return new THREE.BoxGeometry(4, 4, 0.3);
  if (type === 'floor') return new THREE.BoxGeometry(4, 0.3, 4);
  if (type === 'stair') return new THREE.BoxGeometry(4, 4, 4);
  return new THREE.BoxGeometry(4, 4, 0.3);
}

function placeBlock() {
  if (player.mats < 20) {
    flashCenterMsg('資材が足りません!');
    return;
  }
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const placePos = player.pos.clone().add(dir.multiplyScalar(4));
  placePos.x = Math.round(placePos.x / 4) * 4;
  placePos.z = Math.round(placePos.z / 4) * 4;
  placePos.y = getGroundHeight(placePos.x, placePos.z);

  const type = player.buildMode;
  const geo = getBlockGeometry(type);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfa25a, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;

  if (type === 'wall') {
    mesh.position.set(placePos.x, placePos.y + 2, placePos.z);
    mesh.rotation.y = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  } else if (type === 'floor') {
    mesh.position.set(placePos.x, placePos.y + 3.85, placePos.z);
  } else {
    mesh.position.set(placePos.x, placePos.y + 2, placePos.z);
    mesh.rotation.y = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
    mesh.rotation.x = -0.5;
  }

  scene.add(mesh);
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  obstacles.push({ mesh, box });
  placedBlocks.push({ mesh, box });
  player.mats -= 20;
  updateHUD();
}

// ==========================================================
// 衝突判定 (簡易 円柱プレイヤー vs AABB)
// ==========================================================
function collidesXZ(x, z, radius) {
  for (const o of obstacles) {
    const box = o.box;
    const closestX = Math.max(box.min.x, Math.min(x, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(z, box.max.z));
    const dx = x - closestX, dz = z - closestZ;
    if (dx * dx + dz * dz < radius * radius) {
      // 高さも大まかに考慮(建物などは全高衝突とみなす簡略化)
      return true;
    }
  }
  return false;
}

function getGroundHeight(x, z) {
  // 地形の起伏を近似計算(scatterEnvironmentの式と合わせる)
  return Math.sin(x * 0.03) * Math.cos(z * 0.03) * 1.5;
}

// ==========================================================
// 入力・操作
// ==========================================================
function setupControls() {
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Digit1') setBuildMode('wall');
    if (e.code === 'Digit2') setBuildMode('floor');
    if (e.code === 'Digit3') setBuildMode('stair');
    if (e.code === 'KeyR') reload();
  });
  document.addEventListener('keyup', e => keys[e.code] = false);

  renderer.domElement.addEventListener('click', () => {
    if (gameRunning) renderer.domElement.requestPointerLock();
  });

  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0022;
    pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
  });

  document.addEventListener('mousedown', e => {
    if (document.pointerLockElement !== renderer.domElement) return;
    if (e.button === 0) fireWeapon();
    if (e.button === 2) placeBlock();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('pointerlockchange', () => {
    paused = document.pointerLockElement !== renderer.domElement && gameRunning;
  });
}

function setBuildMode(mode) {
  player.buildMode = mode;
  document.querySelectorAll('.buildIcon').forEach(el => {
    el.classList.toggle('active', el.dataset.b === mode);
  });
}

// ==========================================================
// 武器
// ==========================================================
function fireWeapon() {
  if (!player.alive || player.reloading) return;
  if (player.fireCooldown > 0) return;
  if (player.ammo <= 0) { reload(); return; }

  player.fireCooldown = 0.14;
  player.ammo--;
  updateHUD();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = camera.position.clone();
  const to = from.clone().add(dir.clone().multiplyScalar(120));

  spawnTracer(from, to, 0xffe066);

  const ray = new THREE.Raycaster(from, dir, 0.1, 120);
  const targets = [];
  bots.forEach(b => { if (b.alive) targets.push(b.mesh); });
  const placedMeshes = placedBlocks.map(b => b.mesh);
  const obstacleMeshes = obstacles.filter(o => !placedBlocks.some(p => p.mesh === o.mesh)).map(o => o.mesh);

  const hits = ray.intersectObjects([...targets, ...placedMeshes, ...obstacleMeshes], true);
  if (hits.length > 0) {
    const hit = hits[0];
    let hitObj = hit.object;
    while (hitObj.parent && !bots.some(b => b.mesh === hitObj)) hitObj = hitObj.parent;
    const bot = bots.find(b => b.mesh === hitObj);
    if (bot && bot.alive) {
      bot.hp -= 34;
      if (bot.hp <= 0) {
        killBot(bot);
        player.kills++;
        player.mats = Math.min(500, player.mats + 15);
        addKillFeed(`あなた が ${bot.name} を倒した`);
        updateHUD();
      }
    }
  }
}

function reload() {
  if (player.reloading || player.ammo === player.magSize || player.reserveAmmo <= 0) return;
  player.reloading = true;
  flashCenterMsg('リロード中...');
  setTimeout(() => {
    const need = player.magSize - player.ammo;
    const take = Math.min(need, player.reserveAmmo);
    player.ammo += take;
    player.reserveAmmo -= take;
    player.reloading = false;
    clearCenterMsg();
    updateHUD();
  }, 1400);
}

// ==========================================================
// トレーサー(弾道)
// ==========================================================
function spawnTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  bullets.push({ line, life: 0.08 });
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    b.line.material.opacity = Math.max(0, b.life / 0.08);
    if (b.life <= 0) {
      scene.remove(b.line);
      bullets.splice(i, 1);
    }
  }
}

// ==========================================================
// プレイヤー更新
// ==========================================================
function updatePlayer(dt) {
  if (!player.alive) return;

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  if (!paused) {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2));
    const moveDir = new THREE.Vector3();
    if (keys['KeyW']) moveDir.add(forward);
    if (keys['KeyS']) moveDir.sub(forward);
    if (keys['KeyD']) moveDir.add(right);
    if (keys['KeyA']) moveDir.sub(right);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    const speed = keys['ShiftLeft'] ? 9.5 : 6;
    const nx = player.pos.x + moveDir.x * speed * dt;
    const nz = player.pos.z + moveDir.z * speed * dt;
    if (!collidesXZ(nx, player.pos.z, 0.5)) player.pos.x = nx;
    if (!collidesXZ(player.pos.x, nz, 0.5)) player.pos.z = nz;

    // ジャンプ・重力
    if (keys['Space'] && player.onGround) {
      player.vel.y = 7.2;
      player.onGround = false;
    }
  }

  player.vel.y -= 18 * dt;
  player.pos.y += player.vel.y * dt;
  const groundY = getGroundHeight(player.pos.x, player.pos.z);
  if (player.pos.y <= groundY + 1.6) {
    player.pos.y = groundY + 1.6;
    player.vel.y = 0;
    player.onGround = true;
  }

  camera.position.copy(player.pos);

  if (player.fireCooldown > 0) player.fireCooldown -= dt;

  // ピックアップ取得
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (p.mesh.position.distanceTo(player.pos) < 2.2) {
      if (p.type === 'ammo') { player.reserveAmmo += 30; flashCenterMsg('+30 弾薬'); }
      else { player.mats = Math.min(500, player.mats + 40); flashCenterMsg('+40 資材'); }
      scene.remove(p.mesh);
      pickups.splice(i, 1);
      updateHUD();
    } else {
      p.mesh.rotation.y += dt * 1.5;
    }
  }

  // ストームダメージ
  const distFromCenter = Math.hypot(player.pos.x - stormCenter.x, player.pos.z - stormCenter.z);
  if (distFromCenter > stormRadius) {
    stormDamageTick += dt;
    stormWarnEl.textContent = '⚠ ストームの外にいます! ダメージを受けています';
    if (stormDamageTick > 1) {
      stormDamageTick = 0;
      damagePlayer(4);
    }
  } else {
    stormWarnEl.textContent = '';
  }
}

function damagePlayer(amount) {
  if (!player.alive) return;
  if (player.shield > 0) {
    const fromShield = Math.min(player.shield, amount);
    player.shield -= fromShield;
    amount -= fromShield;
  }
  player.hp -= amount;
  updateHUD();
  if (player.hp <= 0) {
    player.hp = 0;
    playerDie();
  }
}

function playerDie() {
  player.alive = false;
  aliveCount--;
  document.exitPointerLock();
  gameRunning = false;
  $('deathTitle').textContent = '戦闘不能...';
  $('deathStats').textContent = `キル数: ${player.kills} / 最終順位: ${aliveCount + 1}位`;
  $('deathScreen').style.display = 'flex';
}

function playerWin() {
  player.alive = true;
  gameRunning = false;
  document.exitPointerLock();
  $('deathTitle').textContent = '🏆 ビクトリーロイヤル!';
  $('deathTitle').style.color = '#ffd23d';
  $('deathStats').textContent = `キル数: ${player.kills} / 生存勝利!`;
  $('deathScreen').style.display = 'flex';
}

// ==========================================================
// ストーム更新
// ==========================================================
function updateStorm(dt) {
  if (stormRadius > 20) {
    stormRadius -= stormShrinkRate * dt * 4;
    if (stormRadius < 20) stormRadius = 20;
    window.stormMesh.scale.set(stormRadius / 130, 1, stormRadius / 130);
  }
}

// ==========================================================
// HUD更新
// ==========================================================
function updateHUD() {
  hpFill.style.width = Math.max(0, player.hp) + '%';
  shieldFill.style.width = Math.max(0, player.shield * 2) + '%';
  ammoEl.textContent = `${player.ammo} / ${player.reserveAmmo}`;
  matCountEl.textContent = player.mats;
  aliveCountEl.textContent = aliveCount;
  killCountEl.textContent = player.kills;

  if (aliveCount <= 1 && player.alive && gameRunning) {
    playerWin();
  }
}

function addKillFeed(text) {
  const div = document.createElement('div');
  div.className = 'killmsg';
  div.textContent = text;
  killfeedEl.prepend(div);
  setTimeout(() => div.remove(), 4500);
}

let centerMsgTimeout;
function flashCenterMsg(text) {
  centerMsgEl.textContent = text;
  centerMsgEl.style.display = 'block';
  clearTimeout(centerMsgTimeout);
  centerMsgTimeout = setTimeout(clearCenterMsg, 1300);
}
function clearCenterMsg() {
  centerMsgEl.style.display = 'none';
}

// ==========================================================
// ボット同士の自然減少(簡易バトルロイヤル演出)
// ==========================================================
let naturalDeathTimer = 8;
function updateNaturalDeaths(dt) {
  naturalDeathTimer -= dt;
  if (naturalDeathTimer <= 0) {
    naturalDeathTimer = 9 + Math.random() * 10;
    const living = bots.filter(b => b.alive);
    if (living.length > 1 && aliveCount > 2) {
      const victim = living[Math.floor(Math.random() * living.length)];
      killBot(victim);
      addKillFeed(`${victim.name} が脱落した`);
    }
  }
}

// ==========================================================
// メインループ
// ==========================================================
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  document.querySelectorAll('.buildIcon').forEach(el => el.style.display = gameRunning ? 'flex' : 'flex');

  if (gameRunning) {
    updatePlayer(dt);
    updateBots(dt);
    updateBullets(dt);
    updateStorm(dt);
    updateNaturalDeaths(dt);
  }

  renderer.render(scene, camera);
}

// ==========================================================
// ゲーム開始/リスタート
// ==========================================================
function startGame() {
  $('startScreen').style.display = 'none';
  $('deathScreen').style.display = 'none';
  gameRunning = true;
  renderer.domElement.requestPointerLock();
  updateHUD();
}

$('startBtn').addEventListener('click', startGame);
$('restartBtn').addEventListener('click', () => window.location.reload());

document.querySelectorAll('.buildIcon').forEach(el => {
  el.addEventListener('click', () => setBuildMode(el.dataset.b));
});

document.addEventListener('keydown', e => {
  if (e.code === 'Escape' && document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
});

// ==========================================================
// 起動
// ==========================================================
window.addEventListener('load', () => {
  init();
  $('loading').style.display = 'none';
  $('startScreen').style.display = 'flex';
});
