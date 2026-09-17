import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_NAME } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =====================================================================
   utilitários
===================================================================== */
const $ = (s, root = document) => root.querySelector(s);
const app = $('#app');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS_LABEL = {
  pending: 'aguardando',
  approved: 'aprovado',
  changes_requested: 'ajuste pedido',
};

const badge = (s) => `<span class="badge ${s}">${STATUS_LABEL[s] || s}</span>`;

const fmtDate = (iso) => new Date(iso).toLocaleString('pt-BR',
  { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const fmtSize = (b) => !b ? '' :
  b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';

let toastTimer;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 6000 : 3000);
}

function fail(error, context) {
  console.error(context, error);
  toast(`${context}: ${error?.message || error}`, true);
}

/** Sanitiza o nome do arquivo para um caminho seguro no Storage. */
const safeName = (name) => name
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_')
  .slice(-80);

const kindOf = (file) => file.type.startsWith('video') ? 'video' : 'image';

/**
 * Arquivos da marca: tenta o .svg, cai para o .png de `data-alt` e, se nenhum
 * dos dois existir, remove a imagem. O logotipo é arquivo fechado — na falta
 * dele a interface fica sem marca em vez de recriá-la em tipografia.
 */
function wireBrandImages(root = document) {
  root.querySelectorAll('img[data-alt]').forEach((img) => {
    const fallback = () => {
      if (img.dataset.tried) { img.remove(); return; }
      img.dataset.tried = '1';
      img.src = img.dataset.alt;
    };
    img.addEventListener('error', fallback);
    // o erro pode ter acontecido antes deste script rodar
    if (img.complete && img.naturalWidth === 0) fallback();
  });
}
wireBrandImages();

/* =====================================================================
   estado
===================================================================== */
const state = { user: null, profile: null };
const isAgency = () => state.profile?.role === 'agency';

/* =====================================================================
   boot
===================================================================== */
let booting = null;

if (SUPABASE_URL.includes('SEU-PROJETO')) {
  app.innerHTML = `<div class="card">
    <p class="eyebrow">Configuração</p>
    <h1>Falta ligar o Supabase</h1>
    <p class="lede">Abra <code>js/config.js</code> e cole a URL e a anon key do seu
    projeto. O passo a passo está no <code>README.md</code>.</p></div>`;
} else {
  sb.auth.onAuthStateChange((_evt, session) => { boot(session); });
  boot((await sb.auth.getSession()).data.session);
}

async function boot(session) {
  if (!session) {
    state.user = null; state.profile = null; booting = null;
    $('#topbar').hidden = true;
    return renderAuth();
  }
  if (booting === session.user.id) return;
  booting = session.user.id;

  state.user = session.user;
  state.profile = await loadProfile(session.user);
  $('#topbar').hidden = false;
  $('#whoami').textContent =
    `${state.profile.full_name || state.profile.email} · ${isAgency() ? 'agência' : 'cliente'}`;
  refreshNotifications();
  route();
}

async function loadProfile(user) {
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (data) return data;
  // fallback caso o trigger de cadastro não tenha rodado
  const { data: created, error } = await sb.from('profiles').insert({
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.email.split('@')[0],
  }).select().single();
  if (error) fail(error, 'Não consegui carregar seu perfil');
  return created || { id: user.id, email: user.email, role: 'client' };
}

/* =====================================================================
   login / cadastro
===================================================================== */
function renderAuth() {
  app.innerHTML = `
  <div class="auth">
    <img class="seal-lg on-paper" src="assets/selo.svg" data-alt="assets/selo.png" alt="dopamine">
    <img class="seal-lg on-ink" src="assets/selo-claro.svg" data-alt="assets/selo-claro.png"
         alt="" aria-hidden="true">
    <img class="wordmark on-paper" src="assets/wordmark.svg" data-alt="assets/wordmark.png"
         alt="dopamine">
    <img class="wordmark on-ink" src="assets/wordmark-claro.svg" data-alt="assets/wordmark-claro.png"
         alt="" aria-hidden="true">
    <h1 class="center" style="font-size:22px; letter-spacing:.2em">APROVA</h1>
    <p class="muted center">Aprovação de artes e vídeos</p>
    <p class="quote center tagline">Ativamos o desejo de ponta a ponta.</p>
    <div class="card" style="margin-top:24px">
      <div class="tabs">
        <button class="on" data-tab="in">Entrar</button>
        <button data-tab="up">Criar conta</button>
      </div>
      <form id="auth-form">
        <div id="name-field" hidden>
          <label for="f-name">Seu nome</label>
          <input id="f-name" autocomplete="name">
        </div>
        <label for="f-email">E-mail</label>
        <input id="f-email" type="email" required autocomplete="email">
        <label for="f-pass">Senha</label>
        <input id="f-pass" type="password" required minlength="6" autocomplete="current-password">
        <button id="auth-submit" style="width:100%; margin-top:18px">Entrar</button>
      </form>
      <p class="muted center" style="margin:16px 0 0">
        Contas novas entram como <b>cliente</b>.</p>
    </div>
  </div>`;

  wireBrandImages(app);

  let mode = 'in';
  app.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
    mode = b.dataset.tab;
    app.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    $('#name-field').hidden = mode === 'in';
    $('#auth-submit').textContent = mode === 'in' ? 'Entrar' : 'Criar conta';
    $('#f-pass').autocomplete = mode === 'in' ? 'current-password' : 'new-password';
  });

  $('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#auth-submit');
    btn.disabled = true;
    const email = $('#f-email').value.trim();
    const password = $('#f-pass').value;

    if (mode === 'in') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { fail(error, 'Não entrou'); btn.disabled = false; }
    } else {
      const full_name = $('#f-name').value.trim();
      const { data, error } = await sb.auth.signUp({
        email, password, options: { data: { full_name } },
      });
      btn.disabled = false;
      if (error) return fail(error, 'Não cadastrou');
      if (!data.session) toast('Conta criada. Confirme o e-mail para entrar.');
    }
  };
}

$('#logout').onclick = async () => {
  await sb.auth.signOut();
  booting = null;
  location.hash = '';
};

/* =====================================================================
   rotas   #/  ·  #/p/<projectId>  ·  #/a/<assetId>
===================================================================== */
addEventListener('hashchange', route);
document.body.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) location.hash = nav.dataset.nav === 'home' ? '#/' : nav.dataset.nav;
});

function route() {
  if (!state.user) return;
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'p' && parts[1]) return renderProject(parts[1]);
  if (parts[0] === 'a' && parts[1]) return renderAsset(parts[1]);
  return renderHome();
}

/* =====================================================================
   home — lista de projetos
===================================================================== */
async function renderHome() {
  app.innerHTML = `<p class="muted">Carregando projetos…</p>`;

  const { data: projects, error } = await sb
    .from('projects')
    .select('*, client:client_id(full_name,email), assets(status)')
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (error) return fail(error, 'Não carregou os projetos');

  const cards = (projects || []).map((p) => {
    const pend = (p.assets || []).filter((a) => a.status === 'pending').length;
    const total = (p.assets || []).length;
    return `<button class="item" data-nav="#/p/${p.id}">
      <div style="flex:1">
        <strong>${esc(p.name)}</strong>
        <div class="muted">${esc(p.client?.full_name || p.client?.email || 'sem cliente')}
          · ${total} peça${total === 1 ? '' : 's'}</div>
      </div>
      ${pend ? `<span class="badge pending">${pend} aguardando</span>` : ''}
    </button>`;
  }).join('');

  app.innerHTML = `
    <p class="eyebrow">${isAgency() ? 'Painel da agência' : 'Suas aprovações'}</p>
    <h1>${isAgency() ? 'Seus projetos' : 'Projetos para aprovar'}</h1>
    <p class="lede">${isAgency()
      ? 'Um projeto por cliente ou por campanha.'
      : 'Abra um projeto para ver as peças.'}</p>
    <div class="list" style="margin-top:26px">
      ${cards || '<p class="muted">Nenhum projeto por aqui ainda.</p>'}
    </div>
    ${isAgency() ? `
      <h2>Novo projeto</h2>
      <form class="card" id="new-project">
        <label for="np-name">Nome do projeto</label>
        <input id="np-name" required placeholder="Campanha de setembro">
        <label for="np-desc">Descrição (opcional)</label>
        <input id="np-desc">
        <label for="np-client">Cliente</label>
        <select id="np-client"><option value="">Carregando…</option></select>
        <p class="muted">O cliente precisa ter criado a conta dele no app para aparecer aqui.</p>
        <button style="margin-top:14px">Criar projeto</button>
      </form>` : ''}`;

  if (isAgency()) setupNewProject();
}

async function setupNewProject() {
  const sel = $('#np-client');
  const { data: clients, error } = await sb
    .from('profiles').select('id,full_name,email')
    .eq('role', 'client').order('full_name');
  if (error) return fail(error, 'Não carregou os clientes');

  sel.innerHTML = `<option value="">— selecione —</option>` + (clients || [])
    .map((c) => `<option value="${c.id}">${esc(c.full_name || c.email)} (${esc(c.email)})</option>`)
    .join('');

  $('#new-project').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { data, error } = await sb.from('projects').insert({
      name: $('#np-name').value.trim(),
      description: $('#np-desc').value.trim() || null,
      owner_id: state.user.id,
      client_id: sel.value || null,
    }).select().single();
    btn.disabled = false;
    if (error) return fail(error, 'Não criou o projeto');
    toast('Projeto criado');
    location.hash = `#/p/${data.id}`;
  };
}

/* =====================================================================
   projeto — grade de peças
===================================================================== */
async function renderProject(projectId) {
  app.innerHTML = `<p class="muted">Carregando projeto…</p>`;

  const { data: project, error } = await sb
    .from('projects').select('*, client:client_id(full_name,email)')
    .eq('id', projectId).single();
  if (error) return fail(error, 'Projeto não encontrado');

  const { data: assets, error: aErr } = await sb
    .from('assets')
    .select('*, asset_versions(version,storage_path,mime_type)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (aErr) return fail(aErr, 'Não carregou as peças');

  // uma URL assinada por peça, usando a versão mais recente
  const latest = (assets || []).map((a) => ({
    a,
    v: (a.asset_versions || []).sort((x, y) => y.version - x.version)[0],
  }));
  const urls = await signedUrls(latest.map((x) => x.v?.storage_path).filter(Boolean));

  const tiles = latest.map(({ a, v }) => {
    const url = v && urls[v.storage_path];
    const media = !url
      ? `<div class="thumb"></div>`
      : a.kind === 'video'
        ? `<video class="thumb" src="${url}#t=0.1" preload="metadata" muted playsinline></video>`
        : `<img class="thumb" src="${url}" alt="" loading="lazy">`;
    return `<button class="tile" data-nav="#/a/${a.id}">
      ${media}
      <div class="meta">
        <strong>${esc(a.title)}</strong>
        <div class="row" style="margin-top:6px">
          ${badge(a.status)}<span class="muted">v${a.current_version}</span>
        </div>
      </div>
    </button>`;
  }).join('');

  app.innerHTML = `
    <button class="link" data-nav="home">← Todos os projetos</button>
    <h1 style="margin-top:14px">${esc(project.name)}</h1>
    <p class="lede">${esc(project.description || '')}</p>
    <p class="muted">Cliente: ${esc(project.client?.full_name || project.client?.email || '—')}</p>

    <div class="grid" style="margin-top:26px">
      ${tiles || '<p class="muted">Nenhuma peça enviada ainda.</p>'}
    </div>

    ${isAgency() ? `
      <h2>Enviar nova peça</h2>
      <form class="card" id="new-asset">
        <label for="na-title">Título</label>
        <input id="na-title" required placeholder="Reels 01 — abertura">
        <label for="na-file">Arquivo (imagem ou vídeo)</label>
        <input id="na-file" type="file" accept="image/*,video/*" required>
        <label for="na-note">Recado pro cliente (opcional)</label>
        <input id="na-note" placeholder="Primeira versão, foco no ritmo do corte">
        <button style="margin-top:14px">Enviar peça</button>
        <p class="muted" id="na-status"></p>
      </form>` : ''}`;

  if (isAgency()) setupNewAsset(projectId);
}

function setupNewAsset(projectId) {
  $('#new-asset').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const file = $('#na-file').files[0];
    if (!file) return;
    btn.disabled = true;
    $('#na-status').textContent = 'Enviando…';

    const { data: asset, error } = await sb.from('assets').insert({
      project_id: projectId,
      title: $('#na-title').value.trim(),
      kind: kindOf(file),
    }).select().single();

    if (error) { btn.disabled = false; $('#na-status').textContent = ''; return fail(error, 'Não criou a peça'); }

    const ok = await uploadVersion(projectId, asset.id, 1, file, $('#na-note').value.trim());
    btn.disabled = false;
    $('#na-status').textContent = '';
    if (!ok) { await sb.from('assets').delete().eq('id', asset.id); return; }
    toast('Peça enviada — o cliente foi notificado');
    location.hash = `#/a/${asset.id}`;
  };
}

/** Sobe o arquivo no Storage e registra a versão. Retorna true se deu certo. */
async function uploadVersion(projectId, assetId, version, file, note) {
  const path = `${projectId}/${assetId}/v${version}-${safeName(file.name)}`;
  const { error: upErr } = await sb.storage.from('media')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (upErr) { fail(upErr, 'Não subiu o arquivo'); return false; }

  const { error } = await sb.from('asset_versions').insert({
    asset_id: assetId,
    version,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    note: note || null,
    uploaded_by: state.user.id,
  });
  if (error) {
    await sb.storage.from('media').remove([path]);
    fail(error, 'Não registrou a versão');
    return false;
  }
  return true;
}

/** Gera URLs temporárias (1h) para uma lista de caminhos do Storage. */
async function signedUrls(paths) {
  const map = {};
  if (!paths.length) return map;
  const { data, error } = await sb.storage.from('media').createSignedUrls(paths, 3600);
  if (error) { fail(error, 'Não gerou o link do arquivo'); return map; }
  data.forEach((d) => { if (d.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}

/* =====================================================================
   peça — player, versões, comentários, aprovação
===================================================================== */
async function renderAsset(assetId) {
  app.innerHTML = `<p class="muted">Carregando peça…</p>`;

  const { data: asset, error } = await sb
    .from('assets')
    .select('*, project:project_id(id,name,client_id,owner_id)')
    .eq('id', assetId).single();
  if (error) return fail(error, 'Peça não encontrada');

  const { data: versions } = await sb.from('asset_versions')
    .select('*').eq('asset_id', assetId).order('version', { ascending: false });

  const { data: comments } = await sb.from('comments')
    .select('*, author:author_id(full_name,email,role)')
    .eq('asset_id', assetId).order('created_at', { ascending: true });

  const urls = await signedUrls((versions || []).map((v) => v.storage_path));
  const isClient = state.user.id === asset.project.client_id;

  app.innerHTML = `
    <button class="link" data-nav="#/p/${asset.project.id}">← ${esc(asset.project.name)}</button>

    <div class="row" style="margin:14px 0 4px">
      <h1 style="margin:0">${esc(asset.title)}</h1>${badge(asset.status)}
    </div>
    <p class="muted">${(versions || []).length} versão(ões) enviada(s)</p>

    <div id="viewer" class="viewer" style="margin-top:14px"></div>

    <div class="row" style="margin-top:12px">
      <label for="v-select" style="margin:0">Versão</label>
      <select id="v-select" style="width:auto; min-width:220px">
        ${(versions || []).map((v, i) => `<option value="${v.id}" ${i === 0 ? 'selected' : ''}>
            v${v.version} — ${fmtDate(v.created_at)} ${fmtSize(v.size_bytes)}
          </option>`).join('')}
      </select>
      <a id="v-download" class="muted" download>baixar arquivo</a>
    </div>
    <p class="muted" id="v-note"></p>

    ${isClient ? `
      <h2>Sua resposta</h2>
      <div class="card">
        <label for="c-body">Comentário</label>
        <textarea id="c-body" placeholder="O que você achou? Se for pedir ajuste, descreva aqui."></textarea>
        <div class="row" style="margin-top:12px">
          <button id="btn-approve">Aprovar</button>
          <button class="ghost" id="btn-changes">Pedir ajuste</button>
          <button class="link" id="btn-comment" style="margin-left:6px">Só comentar</button>
        </div>
      </div>` : `
      <h2>Responder ao cliente</h2>
      <div class="card">
        <label for="c-body">Comentário</label>
        <textarea id="c-body" placeholder="Responda uma observação do cliente"></textarea>
        <button class="ghost" id="btn-comment" style="margin-top:12px">Comentar</button>
      </div>`}

    ${isAgency() ? `
      <h2>Enviar nova versão</h2>
      <form class="card" id="new-version">
        <label for="nv-file">Arquivo</label>
        <input id="nv-file" type="file" accept="image/*,video/*" required>
        <label for="nv-note">O que mudou (opcional)</label>
        <input id="nv-note" placeholder="Ajustei o corte do minuto 0:12">
        <button style="margin-top:14px">Enviar v${(asset.current_version || 0) + 1}</button>
      </form>` : ''}

    <h2>Histórico</h2>
    <div class="list" id="comments">
      ${renderComments(comments, versions)}
    </div>`;

  /* --- troca de versão --- */
  const vSel = $('#v-select');
  const showVersion = () => {
    const v = (versions || []).find((x) => x.id === vSel.value);
    const viewer = $('#viewer');
    const url = v && urls[v.storage_path];
    if (!url) { viewer.innerHTML = `<p class="muted">Sem arquivo</p>`; return; }
    viewer.innerHTML = asset.kind === 'video'
      ? `<video src="${url}" controls playsinline preload="metadata"></video>`
      : `<img src="${url}" alt="${esc(asset.title)}">`;
    $('#v-download').href = url;
    $('#v-note').textContent = v.note ? `Nota da agência: ${v.note}` : '';
  };
  if (vSel) { vSel.onchange = showVersion; showVersion(); }

  /* --- comentar / aprovar --- */
  const currentVersionId = versions?.[0]?.id || null;
  const send = async (kind) => {
    const body = $('#c-body').value.trim();
    if (kind === 'comment' && !body) return toast('Escreva alguma coisa antes.', true);
    if (kind === 'change_request' && !body)
      return toast('Descreva o ajuste para a agência saber o que fazer.', true);

    const { error } = await sb.from('comments').insert({
      asset_id: assetId,
      version_id: vSel?.value || currentVersionId,
      author_id: state.user.id,
      body: body || null,
      kind,
    });
    if (error) return fail(error, 'Não enviou');
    toast(kind === 'approval' ? 'Aprovado!' :
          kind === 'change_request' ? 'Ajuste solicitado' : 'Comentário enviado');
    renderAsset(assetId);
    refreshNotifications();
  };

  $('#btn-comment').onclick = () => send('comment');
  if ($('#btn-approve')) $('#btn-approve').onclick = () => send('approval');
  if ($('#btn-changes')) $('#btn-changes').onclick = () => send('change_request');

  /* --- nova versão --- */
  if (isAgency()) {
    $('#new-version').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      const file = $('#nv-file').files[0];
      if (!file) return;
      btn.disabled = true;
      const ok = await uploadVersion(
        asset.project.id, assetId, (asset.current_version || 0) + 1,
        file, $('#nv-note').value.trim());
      btn.disabled = false;
      if (!ok) return;
      toast('Nova versão enviada');
      renderAsset(assetId);
    };
  }
}

function renderComments(comments, versions) {
  const vNum = {};
  (versions || []).forEach((v) => { vNum[v.id] = v.version; });

  const events = [
    ...(versions || []).map((v) => ({
      at: v.created_at,
      html: `<div class="comment">
        <header><b>Agência</b><span class="muted">${fmtDate(v.created_at)}</span></header>
        <div>Enviou a <b>v${v.version}</b>${v.note ? ` — ${esc(v.note)}` : ''}</div>
      </div>`,
    })),
    ...(comments || []).map((c) => {
      const tag = c.kind === 'approval' ? 'Aprovou'
        : c.kind === 'change_request' ? 'Pediu ajuste' : '';
      return {
        at: c.created_at,
        html: `<div class="comment ${c.kind}">
          <header>
            <b>${esc(c.author?.full_name || c.author?.email || 'Alguém')}</b>
            <span class="muted">${fmtDate(c.created_at)}${
              vNum[c.version_id] ? ` · v${vNum[c.version_id]}` : ''}</span>
          </header>
          ${tag ? `<div><b>${tag}</b></div>` : ''}
          ${c.body ? `<div>${esc(c.body).replace(/\n/g, '<br>')}</div>` : ''}
        </div>`,
      };
    }),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  return events.map((e) => e.html).join('') || '<p class="muted">Nada ainda.</p>';
}

/* =====================================================================
   notificações
===================================================================== */
async function refreshNotifications() {
  const { data, error } = await sb.from('notifications')
    .select('*').order('created_at', { ascending: false }).limit(25);
  if (error) return;

  const unread = data.filter((n) => !n.read).length;
  const count = $('#bell-count');
  count.textContent = unread;
  count.hidden = unread === 0;

  $('#notif-panel').innerHTML = data.length
    ? data.map((n) => `<div class="notif ${n.read ? '' : 'unread'}"
        ${n.asset_id ? `data-nav="#/a/${n.asset_id}"` : ''} style="cursor:pointer">
        <b>${esc(n.title)}</b>
        <span class="muted">${esc(n.body || '')}</span>
        <div class="muted">${fmtDate(n.created_at)}</div>
      </div>`).join('')
    : '<p class="muted center" style="padding:12px">Sem novidades.</p>';
}

$('#bell').onclick = async () => {
  const panel = $('#notif-panel');
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  await refreshNotifications();
  await sb.from('notifications').update({ read: true })
    .eq('user_id', state.user.id).eq('read', false);
  setTimeout(() => {
    $('#bell-count').hidden = true;
    panel.querySelectorAll('.notif').forEach((n) => n.classList.remove('unread'));
  }, 400);
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.bell-wrap')) $('#notif-panel').hidden = true;
});

// recarrega o contador de tempos em tempos
setInterval(() => { if (state.user) refreshNotifications(); }, 60000);
