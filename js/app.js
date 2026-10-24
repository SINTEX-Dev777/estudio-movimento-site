/* =========================================================
   Estúdio Movimento — app.js
   Site de catálogos (vídeos/fotos) + Loja Dry Fit
   Os dados vêm de /dados/catalogo.json (edite lá, não aqui).
   ========================================================= */
(() => {
  'use strict';

  const ABAS = ['inicio', 'catalogos', 'fotos', 'videos', 'loja'];
  const TITULOS = { inicio: '', catalogos: 'Catálogos', fotos: 'Fotos', videos: 'Vídeos', loja: 'Loja Dry Fit' };
  const CHAVE_CARRINHO = 'em.carrinho.v1';
  const CHAVE_CLIENTE = 'em.cliente.v1';
  const CHAVE_INSTALAR = 'em.instalar.adiado';
  const IMG_FALHA = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><rect width="400" height="500" fill="#2a2e37"/><text x="200" y="255" text-anchor="middle" font-family="Arial" font-size="20" fill="#a4a8b3">Imagem indisponível</text></svg>');

  const E = {
    dados: null,
    aba: null,
    carrinho: [],
    filtro: { catalogos: 'Todos', fotos: 'Todos', videos: 'Todos', loja: 'Todos' },
    busca: '',
    ordem: 'destaques',
    renderizadas: new Set(),
    modalAberto: false,
    modalPorClique: false,
    ultimoFoco: null,
    instalarEvento: null,
  };

  /* ---------- Utilidades ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const reais = (centavos) => moeda.format(centavos / 100).replace(/ /g, ' ');
  const paraCentavos = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };
  const urlSegura = (u) => {
    const s = String(u ?? '').trim();
    if (!s || /^(javascript|data|vbscript):/i.test(s)) return '';
    return s;
  };
  const corSegura = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : '#888888');
  const plural = (t) => (/s$/i.test(t) ? t : t + 's');
  const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');

  const armazenamento = {
    ler(chave, padrao) {
      try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
    },
    gravar(chave, valor) {
      try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* navegador sem armazenamento: segue sem salvar */ }
    },
  };

  function formatarFone(numero) {
    let d = soDigitos(numero);
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return numero || '';
  }

  /* ---------- YouTube ---------- */
  function idYoutube(url) {
    const s = String(url ?? '').trim();
    if (!s) return null;
    if (/^[\w-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s);
      const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
      let id = null;
      if (host === 'youtu.be') id = u.pathname.split('/')[1];
      else if (/(^|\.)youtube(-nocookie)?\.com$/.test(host)) {
        id = u.searchParams.get('v');
        if (!id) { const m = u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
      }
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    } catch { return null; }
  }
  function ehVertical(url, formato) {
    if (formato === 'vertical') return true;
    if (formato === 'horizontal') return false;
    return /\/shorts\//.test(String(url ?? ''));
  }
  const ICONE_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';

  function playerHTML(url, titulo, formato) {
    const id = idYoutube(url);
    const cls = 'player' + (ehVertical(url, formato) ? ' player--vertical' : '');
    if (!id) {
      return `<div class="${cls}"><div class="player__embreve"><img src="/imagens/video-capa.svg" alt="" loading="lazy"><strong>Vídeo em breve</strong><span>Estamos finalizando este vídeo.</span></div></div>`;
    }
    return `<div class="${cls}"><button class="player__capa" type="button" data-yt="${esc(id)}" data-titulo="${esc(titulo)}" aria-label="Assistir ao vídeo: ${esc(titulo)}">
      <img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy"><span class="player__play">${ICONE_PLAY}</span></button></div>`;
  }

  function tocarVideo(botao) {
    const id = botao.dataset.yt;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
    iframe.title = botao.dataset.titulo || 'Vídeo';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    botao.replaceWith(iframe);
  }

  /* ---------- Dados ---------- */
  async function carregarDados() {
    const resp = await fetch('/dados/catalogo.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`O arquivo não foi encontrado (erro ${resp.status}).`);
    const texto = await resp.text();
    let bruto;
    try { bruto = JSON.parse(texto); } catch (e) {
      throw new Error('O arquivo dados/catalogo.json tem um erro de digitação (vírgula, aspas ou chave faltando). Detalhe: ' + e.message);
    }
    return normalizar(bruto);
  }

  function normalizar(b) {
    const lista = (v) => (Array.isArray(v) ? v : []);
    const loja = Object.assign({ nome: 'Minha Loja', slogan: '', descricao: '', whatsapp: '', instagram: '', email: '', cidade: '', atendimento: '', demonstracao: false }, b.loja || {});
    const vistos = new Set();
    const idUnico = (id, nome, prefixo) => {
      let base = String(id || nome || prefixo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || prefixo;
      let final = base, n = 2;
      while (vistos.has(final)) final = `${base}-${n++}`;
      vistos.add(final);
      return final;
    };
    const catalogos = lista(b.catalogos).filter((c) => c && c.nome).map((c) => ({
      id: idUnico(c.id, c.nome, 'servico'),
      nome: String(c.nome), categoria: String(c.categoria || 'Outros'),
      resumo: String(c.resumo || ''), descricao: String(c.descricao || ''),
      inclui: lista(c.inclui).map(String), prazo: c.prazo ? String(c.prazo) : '',
      preco: paraCentavos(c.preco), fotos: lista(c.fotos).map(urlSegura).filter(Boolean), video: String(c.video || ''),
      videoFormato: c.videoFormato || '',
    }));
    const produtos = lista(b.produtos).filter((p) => p && p.nome).map((p, i) => {
      const cores = lista(p.cores).filter((c) => c && c.nome).map((c) => ({ nome: String(c.nome), hex: corSegura(c.hex), foto: urlSegura(c.foto) }));
      let fotos = lista(p.fotos).map(urlSegura).filter(Boolean);
      cores.forEach((c) => { if (c.foto && !fotos.includes(c.foto)) fotos.push(c.foto); });
      return {
        id: idUnico(p.id, p.nome, 'produto'), ordem: i,
        nome: String(p.nome), tipo: String(p.tipo || 'Outros'),
        preco: paraCentavos(p.preco), precoAntigo: paraCentavos(p.precoAntigo),
        resumo: String(p.resumo || ''), descricao: String(p.descricao || ''),
        destaques: lista(p.destaques).map(String), tamanhos: lista(p.tamanhos).map(String),
        cores, fotos, video: String(p.video || ''), videoFormato: p.videoFormato || '',
        disponivel: p.disponivel !== false,
      };
    });
    const fotos = lista(b.fotos).filter((f) => f && f.imagem).map((f) => ({ imagem: urlSegura(f.imagem), titulo: String(f.titulo || ''), categoria: String(f.categoria || 'Outros') })).filter((f) => f.imagem);
    const videos = lista(b.videos).filter((v) => v && v.titulo).map((v) => ({ titulo: String(v.titulo), descricao: String(v.descricao || ''), youtube: String(v.youtube || ''), categoria: String(v.categoria || 'Outros'), formato: v.formato || '' }));
    return { loja, catalogos, produtos, fotos, videos };
  }

  const acharProduto = (id) => E.dados.produtos.find((p) => p.id === id);
  const acharServico = (id) => E.dados.catalogos.find((c) => c.id === id);

  /* ---------- Pedaços de interface ---------- */
  function precoHTML(item, textoConsulta = 'Sob consulta') {
    if (!item.preco) return `<div class="preco"><span class="preco__consulta">${esc(textoConsulta)}</span></div>`;
    const antigo = item.precoAntigo && item.precoAntigo > item.preco ? `<span class="preco__antigo">${reais(item.precoAntigo)}</span>` : '';
    return `<div class="preco"><span class="preco__atual">${reais(item.preco)}</span>${antigo}</div>`;
  }
  function desconto(p) {
    return p.preco && p.precoAntigo && p.precoAntigo > p.preco ? Math.round((1 - p.preco / p.precoAntigo) * 100) : 0;
  }
  const ICONE_VIDEO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/></svg>';

  function cartaoProduto(p) {
    const d = desconto(p);
    const temVideo = !!idYoutube(p.video);
    return `<article class="cartao">
      <button class="cartao__midia" type="button" data-abrir-produto="${esc(p.id)}" aria-label="Ver fotos, vídeo e detalhes de ${esc(p.nome)}">
        <img src="${esc(p.fotos[0] || IMG_FALHA)}" alt="${esc(p.nome)}" loading="lazy" width="800" height="1000">
        ${!p.disponivel ? '<span class="selo selo--escuro">Esgotado</span>' : d ? `<span class="selo">-${d}%</span>` : ''}
        ${temVideo ? `<span class="selo selo--escuro selo--video">${ICONE_VIDEO}Vídeo</span>` : ''}
      </button>
      <div class="cartao__corpo">
        <span class="cartao__tipo">${esc(p.tipo)}</span>
        <h3>${esc(p.nome)}</h3>
        <p class="resumo-curto">${esc(p.resumo)}</p>
        ${p.cores.length ? `<div class="cores" aria-label="Cores: ${esc(p.cores.map((c) => c.nome).join(', '))}">${p.cores.map((c) => `<i style="background:${c.hex}" title="${esc(c.nome)}"></i>`).join('')}</div>` : ''}
        <div class="cartao__rodape">${precoHTML(p, 'Consulte')}
          <button class="btn btn--contorno btn--peq btn--bloco" type="button" data-abrir-produto="${esc(p.id)}">Ver produto</button>
        </div>
      </div>
    </article>`;
  }

  function cartaoServico(c) {
    const noPedido = E.carrinho.some((i) => i.tipo === 'servico' && i.id === c.id);
    const temVideo = !!idYoutube(c.video);
    return `<article class="cartao servico">
      <button class="cartao__midia cartao__midia--larga" type="button" data-abrir-servico="${esc(c.id)}" aria-label="Ver fotos, vídeo e detalhes de ${esc(c.nome)}">
        <img src="${esc(c.fotos[0] || IMG_FALHA)}" alt="${esc(c.nome)}" loading="lazy" width="1200" height="900">
        <span class="selo">${esc(c.categoria)}</span>
        ${temVideo ? `<span class="selo selo--escuro selo--video">${ICONE_VIDEO}Vídeo</span>` : ''}
      </button>
      <div class="cartao__corpo">
        <h3>${esc(c.nome)}</h3>
        <p>${esc(c.resumo)}</p>
        ${c.inclui.length ? `<ul class="lista-check">${c.inclui.slice(0, 4).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <div class="cartao__rodape">
          ${precoHTML(c)}
        </div>
        <div class="cartao__rodape">
          <button class="btn btn--contorno btn--peq" type="button" data-abrir-servico="${esc(c.id)}">Fotos, vídeo e detalhes</button>
          <button class="btn ${noPedido ? 'btn--escuro' : 'btn--primario'} btn--peq" type="button" data-alternar-servico="${esc(c.id)}" aria-pressed="${noPedido}">${noPedido ? '✓ No pedido' : 'Adicionar ao pedido'}</button>
        </div>
      </div>
    </article>`;
  }

  function cartaoVideo(v) {
    const vertical = ehVertical(v.youtube, v.formato);
    return `<article class="video ${vertical ? '' : 'video--horizontal'}">
      ${playerHTML(v.youtube, v.titulo, v.formato)}
      <div class="video__info"><h3>${esc(v.titulo)}</h3>${v.descricao ? `<p>${esc(v.descricao)}</p>` : ''}</div>
    </article>`;
  }

  function filtrosHTML(aba, categorias, rotulo = (c) => c) {
    if (categorias.length < 2) return '';
    const todas = ['Todos', ...categorias];
    return `<div class="filtros" role="group" aria-label="Filtrar">${todas.map((c) =>
      `<button class="chip" type="button" data-filtro="${esc(aba)}" data-valor="${esc(c)}" aria-pressed="${E.filtro[aba] === c}">${esc(c === 'Todos' ? c : rotulo(c))}</button>`).join('')}</div>`;
  }
  const categoriasDe = (lista, campo) => [...new Set(lista.map((i) => i[campo]))];

  function linkZap(texto) {
    const n = soDigitos(E.dados.loja.whatsapp);
    return `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
  }

  /* ---------- Abas ---------- */
  function renderInicio() {
    const { loja, videos, produtos, catalogos } = E.dados;
    const capaServ = catalogos[0]?.fotos[0] || '';
    const capaLoja = produtos[0]?.fotos[0] || '';
    $('#aba-inicio').innerHTML = `
      <div class="hero">
        <div class="hero__in">
          <div style="display:grid;gap:20px">
            <span class="sobretitulo" style="color:var(--acento)">Produtora de conteúdo para moda</span>
            <h1>Sua roupa <span>em movimento</span></h1>
            <p class="hero__sub">${esc(loja.descricao)}</p>
            <div class="hero__acoes">
              <a class="btn btn--primario" href="#catalogos">Ver catálogos</a>
              <a class="btn btn--contorno" href="#loja">Loja Dry Fit</a>
            </div>
          </div>
          <div class="portas">
            <a class="porta" href="#catalogos">
              ${capaServ ? `<img src="${esc(capaServ)}" alt="" loading="lazy">` : ''}
              <strong>Vídeos e fotos</strong>
              <span>Modelos vestindo as suas peças, closes de tecido e elasticidade.</span>
              <em>Ver catálogos →</em>
            </a>
            <a class="porta porta--loja" href="#loja">
              <strong>Loja Dry Fit</strong>
              <span>Camisas e shorts que secam rápido, para treino e dia a dia.</span>
              <em>Comprar agora →</em>
            </a>
          </div>
        </div>
      </div>

      <div class="secao">
        <div class="cabeca"><span class="sobretitulo">Como funciona</span><h2>Do roteiro ao vídeo pronto</h2></div>
        <div class="grade grade--3 passos" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
          <div class="passo"><h3>Escolha no catálogo</h3><p>Veja os pacotes de vídeo e foto, com exemplos reais de cada um.</p></div>
          <div class="passo"><h3>Combine pelo WhatsApp</h3><p>Monte o pedido no site e envie. Alinhamos peças, roteiro e data.</p></div>
          <div class="passo"><h3>Receba e venda</h3><p>Vídeos e fotos editados, prontos para Reels, TikTok, loja virtual e anúncios.</p></div>
        </div>
      </div>

      ${videos.length ? `<div class="secao" style="padding-top:0">
        <div class="linha-titulo"><div class="cabeca" style="margin:0"><span class="sobretitulo">Portfólio</span><h2>Vídeos em destaque</h2></div><a class="ver-tudo" href="#videos">Ver todos →</a></div>
        <div class="grade-videos">${videos.filter((v) => ehVertical(v.youtube, v.formato)).slice(0, 3).map(cartaoVideo).join('')}</div>
      </div>` : ''}

      ${produtos.length ? `<div class="secao" style="padding-top:0">
        <div class="linha-titulo"><div class="cabeca" style="margin:0"><span class="sobretitulo">Loja Dry Fit</span><h2>Mais procurados</h2></div><a class="ver-tudo" href="#loja">Ver loja →</a></div>
        <div class="grade grade--4">${produtos.slice(0, 4).map(cartaoProduto).join('')}</div>
      </div>` : ''}

      <div class="secao" style="padding-top:0">
        <div class="chamada">
          <span class="sobretitulo">Tem uma marca de roupa?</span>
          <h2>Vamos criar o conteúdo que vende a sua peça</h2>
          <p>Conte o que você precisa e receba uma proposta pelo WhatsApp.</p>
          <a class="btn btn--zap" href="${esc(linkZap(`Olá! Vim pelo site e quero um orçamento de vídeos/fotos para a minha marca.`))}" target="_blank" rel="noopener">Pedir orçamento no WhatsApp</a>
        </div>
      </div>`;
  }

  function renderCatalogos() {
    const { catalogos } = E.dados;
    const lista = catalogos.filter((c) => E.filtro.catalogos === 'Todos' || c.categoria === E.filtro.catalogos);
    $('#aba-catalogos').innerHTML = `<div class="secao secao--estreita">
      <div class="cabeca"><span class="sobretitulo">Produção de conteúdo</span><h2>Catálogos</h2>
        <p>Pacotes de vídeo e foto com modelos para a sua marca. Toque em um pacote para ver fotos, vídeo e tudo o que está incluído.</p></div>
      ${filtrosHTML('catalogos', categoriasDe(catalogos, 'categoria'))}
      ${lista.length ? `<div class="grade grade--servicos">${lista.map(cartaoServico).join('')}</div>`
        : `<div class="vazio"><strong>Nenhum pacote cadastrado ainda</strong><span>Em breve novos catálogos por aqui.</span></div>`}
    </div>`;
  }

  function fotosFiltradas() {
    return E.dados.fotos.filter((f) => E.filtro.fotos === 'Todos' || f.categoria === E.filtro.fotos);
  }
  function renderFotos() {
    const lista = fotosFiltradas();
    $('#aba-fotos').innerHTML = `<div class="secao secao--estreita">
      <div class="cabeca"><span class="sobretitulo">Portfólio</span><h2>Fotos</h2><p>Ensaios, modelos e detalhes de tecido. Toque em uma foto para ampliar.</p></div>
      ${filtrosHTML('fotos', categoriasDe(E.dados.fotos, 'categoria'))}
      ${lista.length ? `<div class="galeria">${lista.map((f, i) => `<button class="galeria__item" type="button" data-foto="${i}" aria-label="Ampliar foto: ${esc(f.titulo || 'sem título')}">
          <img src="${esc(f.imagem)}" alt="${esc(f.titulo)}" loading="lazy">${f.titulo ? `<span>${esc(f.titulo)}</span>` : ''}</button>`).join('')}</div>`
        : `<div class="vazio"><strong>Nenhuma foto por aqui ainda</strong><span>Volte em breve para ver os novos ensaios.</span></div>`}
    </div>`;
  }

  function renderVideos() {
    const lista = E.dados.videos.filter((v) => E.filtro.videos === 'Todos' || v.categoria === E.filtro.videos);
    $('#aba-videos').innerHTML = `<div class="secao secao--estreita">
      <div class="cabeca"><span class="sobretitulo">Portfólio</span><h2>Vídeos</h2><p>Vídeos demonstrativos com modelos: caimento, movimento, elasticidade da lycra e acabamento.</p></div>
      ${filtrosHTML('videos', categoriasDe(E.dados.videos, 'categoria'))}
      ${lista.length ? `<div class="grade-videos">${lista.map(cartaoVideo).join('')}</div>`
        : `<div class="vazio"><strong>Nenhum vídeo nesta categoria</strong><span>Escolha outra categoria acima.</span></div>`}
    </div>`;
  }

  function renderLoja() {
    const { produtos } = E.dados;
    $('#aba-loja').innerHTML = `<div class="secao secao--estreita">
      <div class="cabeca"><span class="sobretitulo">Loja</span><h2>Loja Dry Fit</h2>
        <p>Camisas e shorts Dry Fit: leves, respiráveis e de secagem rápida. Escolha cor e tamanho, monte o pedido e finalize pelo WhatsApp.</p></div>
      <div class="ferramentas">
        ${filtrosHTML('loja', categoriasDe(produtos, 'tipo'), plural) || '<div></div>'}
        <div class="ferramentas__dir">
          <label class="busca"><span class="pular">Buscar produto</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input class="campo" type="search" id="buscaLoja" placeholder="Buscar produto" value="${esc(E.busca)}" autocomplete="off" enterkeyhint="search">
          </label>
          <label><span class="pular">Ordenar</span>
            <select class="campo" id="ordemLoja">
              <option value="destaques">Destaques</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
            </select>
          </label>
        </div>
      </div>
      <div id="gradeLoja"></div>
    </div>`;
    $('#ordemLoja').value = E.ordem;
    atualizarGradeLoja();
  }

  function atualizarGradeLoja() {
    const termo = E.busca.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let lista = E.dados.produtos.filter((p) => {
      if (E.filtro.loja !== 'Todos' && p.tipo !== E.filtro.loja) return false;
      if (!termo) return true;
      const alvo = `${p.nome} ${p.tipo} ${p.resumo} ${p.cores.map((c) => c.nome).join(' ')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return termo.split(/\s+/).every((t) => alvo.includes(t));
    });
    const preco = (p) => p.preco ?? Infinity;
    if (E.ordem === 'menor') lista = [...lista].sort((a, b) => preco(a) - preco(b) || a.ordem - b.ordem);
    else if (E.ordem === 'maior') lista = [...lista].sort((a, b) => (b.preco ?? -1) - (a.preco ?? -1) || a.ordem - b.ordem);
    else lista = [...lista].sort((a, b) => (b.disponivel - a.disponivel) || a.ordem - b.ordem);

    $('#gradeLoja').innerHTML = lista.length
      ? `<div class="grade grade--4">${lista.map(cartaoProduto).join('')}</div>`
      : `<div class="vazio"><strong>Nenhum produto encontrado</strong><span>Tente outra palavra ou limpe os filtros.</span>
         <button class="btn btn--contorno btn--peq" type="button" data-limpar-busca>Limpar busca e filtros</button></div>`;
  }

  function renderRodape() {
    const { loja } = E.dados;
    const insta = String(loja.instagram || '').replace(/^@/, '').trim();
    $('#rodape').innerHTML = `<div class="rodape__in">
        <div><h3>${esc(loja.nome)}</h3><p>${esc(loja.descricao)}</p></div>
        <div><h3>Contato</h3><ul>
          ${loja.whatsapp ? `<li><a href="${esc(linkZap('Olá! Vim pelo site.'))}" target="_blank" rel="noopener">WhatsApp: ${esc(formatarFone(loja.whatsapp))}</a></li>` : ''}
          ${insta ? `<li><a href="https://instagram.com/${esc(encodeURIComponent(insta))}" target="_blank" rel="noopener">Instagram: @${esc(insta)}</a></li>` : ''}
          ${loja.email ? `<li><a href="mailto:${esc(loja.email)}">${esc(loja.email)}</a></li>` : ''}
          ${loja.cidade ? `<li>${esc(loja.cidade)}</li>` : ''}
          ${loja.atendimento ? `<li>${esc(loja.atendimento)}</li>` : ''}
        </ul></div>
        <div><h3>Navegue</h3><ul>
          ${ABAS.map((a) => `<li><a href="#${a}">${a === 'inicio' ? 'Início' : TITULOS[a]}</a></li>`).join('')}
          <li><a href="#" data-instalar>Instalar o app no celular</a></li>
        </ul></div>
      </div>
      <div class="rodape__base">© ${new Date().getFullYear()} ${esc(loja.nome)} · Este site não usa cookies de rastreamento. Os vídeos do YouTube só carregam quando você toca para assistir.</div>`;
  }

  const RENDER = { inicio: renderInicio, catalogos: renderCatalogos, fotos: renderFotos, videos: renderVideos, loja: renderLoja };

  /* ---------- Rotas (#aba ou #aba/item) ---------- */
  function lerRota() {
    const [aba, item] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
    return { aba: ABAS.includes(aba) ? aba : null, item: item || null };
  }

  function irPara() {
    const { aba, item } = lerRota();
    if (!aba && E.aba && location.hash && location.hash !== '#') return; // âncora interna (ex.: #conteudo)
    const destino = aba || 'inicio';
    if (destino !== E.aba) {
      E.aba = destino;
      ABAS.forEach((a) => { $(`#aba-${a}`).hidden = a !== destino; });
      if (!E.renderizadas.has(destino)) { RENDER[destino](); E.renderizadas.add(destino); }
      $$('[data-aba]').forEach((l) => {
        if (l.dataset.aba === destino) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
      });
      document.title = TITULOS[destino] ? `${TITULOS[destino]} · ${E.dados.loja.nome}` : `${E.dados.loja.nome} | ${E.dados.loja.slogan}`;
      if (!item) window.scrollTo(0, 0);
    }
    if (item) {
      // O item (produto ou pacote) abre por cima da aba atual
      if (acharProduto(item)) abrirProduto(item);
      else if (acharServico(item)) abrirServico(item);
      else history.replaceState(null, '', `#${destino}`);
    } else if (E.modalAberto) {
      fecharModal(true);
    }
  }

  function rerenderAbas() {
    // Mantém tudo coerente quando o pedido muda (ex.: botão "No pedido" dos catálogos)
    E.renderizadas.forEach((a) => { if (a === 'catalogos' || a === 'inicio') { if (a === E.aba) RENDER[a](); else E.renderizadas.delete(a); } });
  }

  /* ---------- Bloqueio de rolagem e foco ---------- */
  let travas = 0;
  const travar = () => { travas++; document.body.classList.add('travado'); };
  const destravar = () => { travas = Math.max(0, travas - 1); if (!travas) document.body.classList.remove('travado'); };
  function prenderFoco(e, container) {
    if (e.key !== 'Tab') return;
    const focaveis = $$('a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])', container).filter((el) => el.offsetParent !== null);
    if (!focaveis.length) return;
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  /* ---------- Modal (produto e serviço) ---------- */
  function abrirModal(html) {
    const modal = $('#modal');
    $('#modalCorpo').innerHTML = html;
    if (!E.modalAberto) {
      E.ultimoFoco = document.activeElement;
      modal.hidden = false;
      travar();
      E.modalAberto = true;
    }
    $('.modal__caixa', modal).scrollTop = 0;
    $('.modal__caixa', modal).focus({ preventScroll: true });
  }

  function fecharModal(peloHistorico = false) {
    if (!E.modalAberto) return;
    $('#modal').hidden = true;
    $('#modalCorpo').innerHTML = ''; // para o vídeo
    E.modalAberto = false;
    destravar();
    if (!peloHistorico) {
      if (E.modalPorClique) history.back();
      else history.replaceState(null, '', `#${E.aba}`);
    }
    E.modalPorClique = false;
    if (E.ultimoFoco && document.contains(E.ultimoFoco)) E.ultimoFoco.focus({ preventScroll: true });
  }

  function navegarParaItem(id) {
    E.modalPorClique = true;
    location.hash = `#${E.aba}/${encodeURIComponent(id)}`;
  }

  function carrosselHTML(fotos, nome, larga = false) {
    if (!fotos.length) fotos = [IMG_FALHA];
    return `<div class="carrossel ${larga ? 'carrossel--larga' : ''}">
      <div class="carrossel__trilho" id="trilho" tabindex="0" aria-label="Fotos de ${esc(nome)}">
        ${fotos.map((f, i) => `<img src="${esc(f)}" alt="${esc(nome)} — foto ${i + 1} de ${fotos.length}" data-ampliar="${i}" ${i ? 'loading="lazy"' : ''}>`).join('')}
      </div>
      ${fotos.length > 1 ? `<div class="carrossel__setas"><button class="btn-icone ant" type="button" data-carrossel="-1" aria-label="Foto anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
        <button class="btn-icone prox" type="button" data-carrossel="1" aria-label="Próxima foto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div>` : ''}
    </div>
    ${fotos.length > 1 ? `<div class="miniaturas">${fotos.map((f, i) => `<button type="button" data-mini="${i}" aria-label="Ver foto ${i + 1}" aria-current="${i === 0}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}`;
  }

  function midiaHTML(fotos, nome, video, formato, larga) {
    const temVideo = !!idYoutube(video);
    return `<div class="detalhe__midia" data-fotos='${esc(JSON.stringify(fotos))}' data-nome="${esc(nome)}">
      ${temVideo ? `<div class="alternar-midia" role="group" aria-label="Escolher mídia">
        <button class="chip" type="button" data-midia="fotos" aria-pressed="true">Fotos (${fotos.length})</button>
        <button class="chip" type="button" data-midia="video" aria-pressed="false">▶ Vídeo</button></div>` : ''}
      <div data-painel="fotos">${carrosselHTML(fotos, nome, larga)}</div>
      ${temVideo ? `<div data-painel="video" data-video="${esc(video)}" data-formato="${esc(formato)}" hidden>${playerHTML(video, nome, formato)}</div>` : ''}
    </div>`;
  }

  const ICONE_COMPARTILHAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';

  function abrirProduto(id) {
    const p = acharProduto(id);
    if (!p) return;
    const sel = { cor: p.cores.length ? 0 : -1, tamanho: null, qtd: 1 };
    abrirModal(`<div class="detalhe" data-produto="${esc(p.id)}">
      ${midiaHTML(p.fotos, p.nome, p.video, p.videoFormato, false)}
      <div class="detalhe__info">
        <span class="cartao__tipo">${esc(p.tipo)}</span>
        <h2 id="modalTitulo">${esc(p.nome)}</h2>
        ${precoHTML(p, 'Consulte pelo WhatsApp')}
        <div class="detalhe__desc"><p><strong>${esc(p.resumo)}</strong></p>${p.descricao ? `<p>${esc(p.descricao)}</p>` : ''}</div>
        ${p.destaques.length ? `<ul class="destaques">${p.destaques.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
        ${p.cores.length ? `<div class="escolha"><div class="escolha__rotulo">Cor: <span id="corNome">${esc(p.cores[0].nome)}</span></div>
          <div class="opcoes">${p.cores.map((c, i) => `<button class="opcao-cor" type="button" data-cor="${i}" aria-pressed="${i === 0}" aria-label="Cor ${esc(c.nome)}" title="${esc(c.nome)}"><i style="background:${c.hex}"></i></button>`).join('')}</div></div>` : ''}
        ${p.tamanhos.length ? `<div class="escolha"><div class="escolha__rotulo">Tamanho: <span id="tamNome">escolha um</span></div>
          <div class="opcoes">${p.tamanhos.map((t) => `<button class="opcao-tam" type="button" data-tam="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
          <span class="erro-campo" id="erroTam" hidden>Escolha o tamanho para continuar.</span></div>` : ''}
        <div class="compra">
          <div class="qtd" aria-label="Quantidade"><button type="button" data-qtd="-1" aria-label="Diminuir quantidade">−</button><output id="qtdValor" aria-live="polite">1</output><button type="button" data-qtd="1" aria-label="Aumentar quantidade">+</button></div>
          <button class="btn btn--primario" type="button" id="btnAdicionar" ${p.disponivel ? '' : 'disabled'}>${p.disponivel ? 'Adicionar ao pedido' : 'Esgotado'}</button>
        </div>
        <div class="info-linha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-4-7.5L21 3v5h-5"/></svg>Pagamento e entrega combinados pelo WhatsApp.</div>
        <button class="btn-texto compartilhar" type="button" data-compartilhar>${ICONE_COMPARTILHAR} Compartilhar produto</button>
      </div>
    </div>`);

    const corpo = $('#modalCorpo');
    corpo.onclick = (e) => {
      const corBtn = e.target.closest('[data-cor]');
      if (corBtn) {
        sel.cor = Number(corBtn.dataset.cor);
        $$('[data-cor]', corpo).forEach((b) => b.setAttribute('aria-pressed', b === corBtn));
        $('#corNome').textContent = p.cores[sel.cor].nome;
        const idx = p.fotos.indexOf(p.cores[sel.cor].foto);
        if (idx >= 0) { mostrarPainel(corpo, 'fotos'); irParaFoto(corpo, idx); }
        return;
      }
      const tamBtn = e.target.closest('[data-tam]');
      if (tamBtn) {
        sel.tamanho = tamBtn.dataset.tam;
        $$('[data-tam]', corpo).forEach((b) => b.setAttribute('aria-pressed', b === tamBtn));
        $('#tamNome').textContent = sel.tamanho;
        $('#erroTam').hidden = true;
        return;
      }
      const qtdBtn = e.target.closest('[data-qtd]');
      if (qtdBtn) {
        sel.qtd = Math.min(99, Math.max(1, sel.qtd + Number(qtdBtn.dataset.qtd)));
        $('#qtdValor').textContent = sel.qtd;
        return;
      }
      if (e.target.closest('#btnAdicionar')) {
        if (p.tamanhos.length && !sel.tamanho) {
          $('#erroTam').hidden = false;
          $('.opcao-tam', corpo).focus();
          return;
        }
        adicionarProduto(p.id, sel.cor >= 0 ? p.cores[sel.cor].nome : '', sel.tamanho || '', sel.qtd);
        avisar(`${sel.qtd}× ${p.nome} adicionado ao pedido`);
        fecharModal();
        return;
      }
      if (e.target.closest('[data-compartilhar]')) compartilhar(p.nome, `${location.origin}/#loja/${p.id}`);
    };
  }

  function abrirServico(id) {
    const c = acharServico(id);
    if (!c) return;
    const noPedido = () => E.carrinho.some((i) => i.tipo === 'servico' && i.id === c.id);
    abrirModal(`<div class="detalhe">
      ${midiaHTML(c.fotos, c.nome, c.video, c.videoFormato, true)}
      <div class="detalhe__info">
        <span class="cartao__tipo">${esc(c.categoria)}</span>
        <h2 id="modalTitulo">${esc(c.nome)}</h2>
        ${precoHTML(c)}
        <div class="detalhe__desc"><p><strong>${esc(c.resumo)}</strong></p>${c.descricao ? `<p>${esc(c.descricao)}</p>` : ''}</div>
        ${c.inclui.length ? `<div class="escolha"><div class="escolha__rotulo">O que está incluído</div><ul class="lista-check">${c.inclui.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
        ${c.prazo ? `<div class="info-linha"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${esc(c.prazo)}</div>` : ''}
        <button class="btn ${noPedido() ? 'btn--escuro' : 'btn--primario'} btn--bloco" type="button" id="btnServico">${noPedido() ? '✓ Já está no pedido (remover)' : 'Adicionar ao pedido'}</button>
        <a class="btn btn--zap btn--bloco" href="${esc(linkZap(`Olá! Vim pelo site e quero um orçamento do pacote "${c.nome}".`))}" target="_blank" rel="noopener">Pedir orçamento agora no WhatsApp</a>
        <button class="btn-texto compartilhar" type="button" data-compartilhar>${ICONE_COMPARTILHAR} Compartilhar pacote</button>
      </div>
    </div>`);
    const corpo = $('#modalCorpo');
    corpo.onclick = (e) => {
      if (e.target.closest('#btnServico')) {
        const entrou = alternarServico(c.id);
        avisar(entrou ? `"${c.nome}" adicionado ao pedido` : `"${c.nome}" removido do pedido`);
        if (entrou) fecharModal(); else abrirServico(c.id);
        return;
      }
      if (e.target.closest('[data-compartilhar]')) compartilhar(c.nome, `${location.origin}/#catalogos/${c.id}`);
    };
  }

  function mostrarPainel(corpo, qual) {
    $$('[data-midia]', corpo).forEach((b) => b.setAttribute('aria-pressed', b.dataset.midia === qual));
    $$('[data-painel]', corpo).forEach((p) => { p.hidden = p.dataset.painel !== qual; });
    // Ao voltar para as fotos, recria a capa do vídeo para ele parar de tocar
    const painelVideo = $('[data-painel="video"]', corpo);
    if (qual === 'fotos' && painelVideo && $('iframe', painelVideo)) {
      painelVideo.innerHTML = playerHTML(painelVideo.dataset.video, corpo.dataset.nome, painelVideo.dataset.formato);
    }
  }

  function irParaFoto(corpo, idx) {
    const trilho = $('#trilho', corpo);
    if (!trilho) return;
    trilho.scrollTo({ left: idx * trilho.clientWidth, behavior: 'smooth' });
  }
  function fotoAtual(trilho) { return Math.round(trilho.scrollLeft / Math.max(1, trilho.clientWidth)); }

  async function compartilhar(titulo, url) {
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return; }
      await navigator.clipboard.writeText(url);
      avisar('Link copiado! É só colar no WhatsApp.');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      avisar('Não foi possível compartilhar agora.');
    }
  }

  /* ---------- Lightbox ---------- */
  const LB = { lista: [], i: 0 };
  function abrirLightbox(lista, i) {
    LB.lista = lista; LB.i = i;
    LB.ultimoFoco = document.activeElement;
    $('#lightbox').hidden = false;
    travar();
    mostrarLightbox();
    $('[data-lb="fechar"]').focus();
  }
  function mostrarLightbox() {
    const item = LB.lista[LB.i];
    const img = $('#lightboxImg');
    img.src = item.src; img.alt = item.legenda || 'Foto';
    $('#lightboxLegenda').textContent = `${item.legenda ? item.legenda + ' · ' : ''}${LB.i + 1} de ${LB.lista.length}`;
    const varias = LB.lista.length > 1;
    $('[data-lb="ant"]').hidden = !varias; $('[data-lb="prox"]').hidden = !varias;
  }
  function moverLightbox(d) { LB.i = (LB.i + d + LB.lista.length) % LB.lista.length; mostrarLightbox(); }
  function fecharLightbox() {
    if ($('#lightbox').hidden) return;
    $('#lightbox').hidden = true; destravar();
    if (LB.ultimoFoco && document.contains(LB.ultimoFoco)) LB.ultimoFoco.focus({ preventScroll: true });
  }

  /* ---------- Pedido (carrinho) ---------- */
  function salvarCarrinho() { armazenamento.gravar(CHAVE_CARRINHO, E.carrinho); atualizarContador(); }
  function chave(i) { return `${i.tipo}|${i.id}|${i.cor || ''}|${i.tamanho || ''}`; }

  function adicionarProduto(id, cor, tamanho, qtd) {
    const novo = { tipo: 'produto', id, cor, tamanho, qtd };
    const existente = E.carrinho.find((i) => chave(i) === chave(novo));
    if (existente) existente.qtd = Math.min(99, existente.qtd + qtd);
    else E.carrinho.push(novo);
    salvarCarrinho();
    pularContador();
  }
  function alternarServico(id) {
    const idx = E.carrinho.findIndex((i) => i.tipo === 'servico' && i.id === id);
    if (idx >= 0) E.carrinho.splice(idx, 1);
    else E.carrinho.push({ tipo: 'servico', id, qtd: 1 });
    salvarCarrinho();
    rerenderAbas();
    if (idx < 0) pularContador();
    return idx < 0;
  }

  // Remove do pedido itens que não existem mais no catálogo
  function limparCarrinhoInvalido() {
    E.carrinho = (Array.isArray(E.carrinho) ? E.carrinho : []).filter((i) => i && (i.tipo === 'produto' ? acharProduto(i.id) : acharServico(i.id)))
      .map((i) => ({ ...i, qtd: Math.min(99, Math.max(1, parseInt(i.qtd, 10) || 1)) }));
    salvarCarrinho();
  }

  function totais() {
    let produtos = 0, pecas = 0, semPreco = 0;
    E.carrinho.forEach((i) => {
      if (i.tipo !== 'produto') return;
      const p = acharProduto(i.id);
      pecas += i.qtd;
      if (p.preco) produtos += p.preco * i.qtd; else semPreco++;
    });
    const servicos = E.carrinho.filter((i) => i.tipo === 'servico').length;
    return { produtos, pecas, servicos, semPreco, itens: pecas + servicos };
  }

  function atualizarContador() {
    const { itens } = totais();
    const el = $('#carrinhoQtd');
    el.hidden = itens === 0;
    el.textContent = itens > 99 ? '99+' : itens;
    $('#btnCarrinho').setAttribute('aria-label', `Abrir pedido (${itens} ${itens === 1 ? 'item' : 'itens'})`);
  }
  function pularContador() {
    const el = $('#carrinhoQtd');
    el.classList.remove('pulo'); void el.offsetWidth; el.classList.add('pulo');
  }

  function montarMensagem(cliente) {
    const { loja } = E.dados;
    const t = totais();
    const linhas = [`Olá, ${loja.nome}! Vim pelo site e quero fazer este pedido:`];
    const prods = E.carrinho.filter((i) => i.tipo === 'produto');
    const servs = E.carrinho.filter((i) => i.tipo === 'servico');
    if (prods.length) {
      linhas.push('', '*LOJA DRY FIT*');
      prods.forEach((i) => {
        const p = acharProduto(i.id);
        const variacao = [i.cor, i.tamanho && `tam. ${i.tamanho}`].filter(Boolean).join(', ');
        const valor = p.preco ? reais(p.preco * i.qtd) : 'preço a consultar';
        linhas.push(`• ${i.qtd}x ${p.nome}${variacao ? ` (${variacao})` : ''} — ${valor}`);
      });
      linhas.push(`*Total dos produtos: ${reais(t.produtos)}*${t.semPreco ? ' + itens a consultar' : ''}`, 'Frete: a combinar');
    }
    if (servs.length) {
      linhas.push('', '*PRODUÇÃO DE VÍDEOS E FOTOS (orçamento)*');
      servs.forEach((i) => linhas.push(`• ${acharServico(i.id).nome}`));
    }
    linhas.push('', `*Nome:* ${cliente.nome}`);
    if (cliente.cidade) linhas.push(`*Cidade/bairro:* ${cliente.cidade}`);
    if (cliente.obs) linhas.push(`*Observações:* ${cliente.obs}`);
    return linhas.join('\n');
  }

  function renderGaveta() {
    const corpo = $('#gavetaCorpo');
    if (!E.carrinho.length) {
      corpo.innerHTML = `<div class="vazio"><strong>Seu pedido está vazio</strong>
        <span>Adicione peças da Loja Dry Fit ou pacotes de vídeo e foto dos catálogos.</span>
        <a class="btn btn--primario" href="#loja" data-fechar-gaveta>Ver Loja Dry Fit</a>
        <a class="btn btn--contorno" href="#catalogos" data-fechar-gaveta>Ver catálogos</a></div>`;
      return;
    }
    const t = totais();
    const cliente = armazenamento.ler(CHAVE_CLIENTE, { nome: '', cidade: '' });
    const prods = E.carrinho.filter((i) => i.tipo === 'produto');
    const servs = E.carrinho.filter((i) => i.tipo === 'servico');
    corpo.innerHTML = `
      ${prods.length ? `<div class="grupo-pedido"><h3>Loja Dry Fit</h3>${prods.map((i) => {
        const p = acharProduto(i.id);
        const foto = (p.cores.find((c) => c.nome === i.cor) || {}).foto || p.fotos[0] || IMG_FALHA;
        return `<div class="item"><img src="${esc(foto)}" alt="">
          <div class="item__info"><span class="item__nome">${esc(p.nome)}</span>
            <span class="item__var">${esc([i.cor, i.tamanho && `Tam. ${i.tamanho}`].filter(Boolean).join(' · '))}</span>
            <div class="item__linha">
              <div class="qtd qtd--peq" aria-label="Quantidade de ${esc(p.nome)}"><button type="button" data-item-qtd="-1" data-chave="${esc(chave(i))}" aria-label="Diminuir">−</button><output>${i.qtd}</output><button type="button" data-item-qtd="1" data-chave="${esc(chave(i))}" aria-label="Aumentar">+</button></div>
              <strong>${p.preco ? reais(p.preco * i.qtd) : 'Consultar'}</strong>
            </div>
            <button class="item__remover" type="button" data-remover="${esc(chave(i))}">Remover</button>
          </div></div>`;
      }).join('')}</div>` : ''}
      ${servs.length ? `<div class="grupo-pedido"><h3>Vídeos e fotos (orçamento)</h3>${servs.map((i) => {
        const c = acharServico(i.id);
        return `<div class="item"><img src="${esc(c.fotos[0] || IMG_FALHA)}" alt="">
          <div class="item__info"><span class="item__nome">${esc(c.nome)}</span><span class="item__var">${c.preco ? reais(c.preco) : 'Valor sob consulta'}</span>
            <button class="item__remover" type="button" data-remover="${esc(chave(i))}">Remover</button></div></div>`;
      }).join('')}</div>` : ''}
      <div class="resumo">
        ${prods.length ? `<div class="resumo__linha"><span>Produtos (${t.pecas} ${t.pecas === 1 ? 'peça' : 'peças'})</span><span>${reais(t.produtos)}</span></div>
        <div class="resumo__linha"><span>Frete</span><span>A combinar</span></div>
        <div class="resumo__linha resumo__total"><span>Total</span><span>${reais(t.produtos)}</span></div>` : ''}
        ${servs.length ? `<small>Os pacotes de vídeo e foto são orçados no atendimento pelo WhatsApp.</small>` : ''}
        ${t.semPreco ? `<small>Alguns itens têm preço a consultar.</small>` : ''}
      </div>
      <form class="form-pedido" id="formPedido" novalidate>
        <label><div>Seu nome</div><input class="campo" name="nome" autocomplete="name" required maxlength="80" value="${esc(cliente.nome)}"></label>
        <span class="erro-campo" id="erroNome" hidden>Digite seu nome para enviarmos o pedido.</span>
        <label><div>Cidade / bairro <small>(para calcular o frete)</small></div><input class="campo" name="cidade" autocomplete="address-level2" maxlength="80" value="${esc(cliente.cidade)}"></label>
        <label><div>Observações <small>(opcional)</small></div><textarea class="campo" name="obs" maxlength="500" placeholder="Ex.: prefiro retirar pessoalmente"></textarea></label>
        <button class="btn btn--zap btn--bloco" type="submit">
          <svg viewBox="0 0 32 32" aria-hidden="true" style="fill:currentColor;stroke:none"><path d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3z"/></svg>
          Enviar pedido pelo WhatsApp</button>
        <button class="btn-texto" type="button" data-esvaziar>Esvaziar pedido</button>
      </form>`;
  }

  function abrirGaveta() {
    renderGaveta();
    const g = $('#gaveta');
    if (g.hidden) { E.focoGaveta = document.activeElement; g.hidden = false; travar(); }
    $('.gaveta__caixa', g).focus({ preventScroll: true });
  }
  function fecharGaveta() {
    const g = $('#gaveta');
    if (g.hidden) return;
    g.hidden = true; destravar();
    if (E.focoGaveta && document.contains(E.focoGaveta)) E.focoGaveta.focus({ preventScroll: true });
  }

  function enviarPedido(form) {
    const dados = Object.fromEntries(new FormData(form).entries());
    const cliente = { nome: String(dados.nome || '').trim(), cidade: String(dados.cidade || '').trim(), obs: String(dados.obs || '').trim() };
    if (!cliente.nome) { $('#erroNome').hidden = false; form.nome.focus(); return; }
    armazenamento.gravar(CHAVE_CLIENTE, { nome: cliente.nome, cidade: cliente.cidade });
    const numero = soDigitos(E.dados.loja.whatsapp);
    if (numero.length < 12) { avisar('O WhatsApp da loja não está configurado corretamente.'); return; }
    const url = linkZap(montarMensagem(cliente));
    const janela = window.open(url, '_blank', 'noopener');
    if (!janela) location.href = url;
    // Depois de enviar, oferece limpar o pedido
    const corpo = $('#gavetaCorpo');
    corpo.insertAdjacentHTML('afterbegin', `<div class="resumo" id="avisoEnviado"><strong>Pedido aberto no WhatsApp ✓</strong>
      <small>Confira a mensagem e toque em enviar. Se já enviou, pode limpar o pedido.</small>
      <button class="btn btn--contorno btn--peq" type="button" data-esvaziar="confirmado">Já enviei, limpar pedido</button></div>`);
    corpo.scrollTop = 0;
  }

  /* ---------- Instalar app (PWA) ---------- */
  const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function configurarInstalacao() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* sem modo offline, o site funciona normalmente */ });
    }
    if (instalado()) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      E.instalarEvento = e;
      $('#btnInstalarTopo').hidden = false;
      agendarAviso();
    });
    window.addEventListener('appinstalled', () => {
      E.instalarEvento = null;
      $('#btnInstalarTopo').hidden = true;
      $('#avisoInstalar').hidden = true;
      avisar('App instalado! Procure o ícone na tela inicial.');
    });
    if (ehIOS()) { $('#btnInstalarTopo').hidden = false; agendarAviso(); }
  }

  function agendarAviso() {
    const adiado = armazenamento.ler(CHAVE_INSTALAR, 0);
    if (Date.now() - adiado < 7 * 24 * 3600 * 1000) return; // já recusou nos últimos 7 dias
    clearTimeout(E.timerAviso);
    E.timerAviso = setTimeout(() => mostrarAvisoInstalar(false), 15000);
  }

  function mostrarAvisoInstalar(peloUsuario) {
    if (instalado()) { if (peloUsuario) avisar('O app já está instalado neste aparelho.'); return; }
    const aviso = $('#avisoInstalar');
    const btn = $('#btnInstalar');
    if (E.instalarEvento) {
      $('#instalarDica').textContent = 'Acesso rápido aos catálogos e à loja, direto da tela inicial.';
      btn.textContent = 'Instalar';
      btn.dataset.modo = 'prompt';
    } else if (ehIOS()) {
      $('#instalarDica').innerHTML = 'No Safari, toque em <strong>Compartilhar</strong> (quadrado com seta) e depois em <strong>“Adicionar à Tela de Início”</strong>.';
      btn.textContent = 'Entendi';
      btn.dataset.modo = 'fechar';
    } else {
      if (!peloUsuario) return;
      $('#instalarDica').innerHTML = 'Abra o menu do navegador (⋮) e toque em <strong>“Instalar app”</strong> ou <strong>“Adicionar à tela inicial”</strong>.';
      btn.textContent = 'Entendi';
      btn.dataset.modo = 'fechar';
    }
    aviso.hidden = false;
  }

  async function clicarInstalar() {
    const btn = $('#btnInstalar');
    if (btn.dataset.modo === 'prompt' && E.instalarEvento) {
      E.instalarEvento.prompt();
      const { outcome } = await E.instalarEvento.userChoice;
      E.instalarEvento = null;
      if (outcome !== 'accepted') armazenamento.gravar(CHAVE_INSTALAR, Date.now());
    }
    $('#avisoInstalar').hidden = true;
  }

  /* ---------- Toast ---------- */
  function avisar(texto) {
    const t = $('#toast');
    t.textContent = texto;
    t.classList.add('visivel');
    clearTimeout(E.timerToast);
    E.timerToast = setTimeout(() => t.classList.remove('visivel'), 2800);
  }

  /* ---------- Eventos globais ---------- */
  function ligarEventos() {
    window.addEventListener('hashchange', irPara);

    document.addEventListener('click', (e) => {
      const alvo = e.target;
      let el;
      if ((el = alvo.closest('.player__capa'))) { tocarVideo(el); return; }
      if ((el = alvo.closest('[data-abrir-produto]'))) { navegarParaItem(el.dataset.abrirProduto); return; }
      if ((el = alvo.closest('[data-abrir-servico]'))) { navegarParaItem(el.dataset.abrirServico); return; }
      if ((el = alvo.closest('[data-alternar-servico]'))) {
        const c = acharServico(el.dataset.alternarServico);
        const entrou = alternarServico(c.id);
        avisar(entrou ? `"${c.nome}" adicionado ao pedido` : `"${c.nome}" removido do pedido`);
        return;
      }
      if ((el = alvo.closest('[data-filtro]'))) {
        const aba = el.dataset.filtro;
        E.filtro[aba] = el.dataset.valor;
        if (aba === 'loja') {
          $$('[data-filtro="loja"]').forEach((b) => b.setAttribute('aria-pressed', b === el));
          atualizarGradeLoja();
        } else RENDER[aba]();
        return;
      }
      if (alvo.closest('[data-limpar-busca]')) {
        E.busca = ''; E.filtro.loja = 'Todos'; renderLoja(); return;
      }
      if ((el = alvo.closest('[data-foto]'))) {
        const lista = fotosFiltradas().map((f) => ({ src: f.imagem, legenda: f.titulo }));
        abrirLightbox(lista, Number(el.dataset.foto));
        return;
      }
      if ((el = alvo.closest('[data-ampliar]'))) {
        const midia = el.closest('.detalhe__midia');
        const fotos = JSON.parse(midia.dataset.fotos);
        abrirLightbox(fotos.map((f) => ({ src: f, legenda: midia.dataset.nome })), Number(el.dataset.ampliar));
        return;
      }
      if ((el = alvo.closest('[data-carrossel]'))) {
        const corpo = el.closest('.detalhe__midia');
        const trilho = $('#trilho', corpo);
        const total = trilho.children.length;
        irParaFoto(corpo, (fotoAtual(trilho) + Number(el.dataset.carrossel) + total) % total);
        return;
      }
      if ((el = alvo.closest('[data-mini]'))) { irParaFoto(el.closest('.detalhe__midia'), Number(el.dataset.mini)); return; }
      if ((el = alvo.closest('[data-midia]'))) { mostrarPainel(el.closest('.detalhe__midia'), el.dataset.midia); return; }
      if (alvo.closest('[data-fechar]')) { fecharModal(); return; }
      if ((el = alvo.closest('[data-lb]'))) {
        const acao = el.dataset.lb;
        if (acao === 'fechar') fecharLightbox(); else moverLightbox(acao === 'ant' ? -1 : 1);
        return;
      }
      if (alvo === $('#lightbox') || alvo.classList.contains('lightbox__fig')) { fecharLightbox(); return; }
      if (alvo.closest('#btnCarrinho')) { abrirGaveta(); return; }
      if (alvo.closest('[data-fechar-gaveta]')) { fecharGaveta(); return; }
      if ((el = alvo.closest('[data-item-qtd]'))) {
        const item = E.carrinho.find((i) => chave(i) === el.dataset.chave);
        if (item) { item.qtd = Math.min(99, Math.max(1, item.qtd + Number(el.dataset.itemQtd))); salvarCarrinho(); renderGaveta(); }
        return;
      }
      if ((el = alvo.closest('[data-remover]'))) {
        E.carrinho = E.carrinho.filter((i) => chave(i) !== el.dataset.remover);
        salvarCarrinho(); rerenderAbas(); renderGaveta(); avisar('Item removido');
        return;
      }
      if ((el = alvo.closest('[data-esvaziar]'))) {
        if (el.dataset.esvaziar !== 'confirmado' && !window.confirm('Tirar todos os itens do pedido?')) return;
        E.carrinho = []; salvarCarrinho(); rerenderAbas(); renderGaveta();
        avisar('Pedido limpo');
        return;
      }
      if (alvo.closest('[data-instalar]') || alvo.closest('#btnInstalarTopo')) { e.preventDefault(); mostrarAvisoInstalar(true); return; }
      if (alvo.closest('#btnInstalar')) { clicarInstalar(); return; }
      if (alvo.closest('#btnInstalarDepois')) { armazenamento.gravar(CHAVE_INSTALAR, Date.now()); $('#avisoInstalar').hidden = true; return; }
    });

    document.addEventListener('submit', (e) => {
      if (e.target.id === 'formPedido') { e.preventDefault(); enviarPedido(e.target); }
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'buscaLoja') {
        E.busca = e.target.value;
        clearTimeout(E.timerBusca);
        E.timerBusca = setTimeout(atualizarGradeLoja, 150);
      }
      if (e.target.name === 'nome' && e.target.closest('#formPedido')) $('#erroNome').hidden = true;
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'ordemLoja') { E.ordem = e.target.value; atualizarGradeLoja(); }
    });

    // Atualiza as miniaturas conforme a foto visível no carrossel
    document.addEventListener('scroll', (e) => {
      const trilho = e.target;
      if (!(trilho instanceof Element) || trilho.id !== 'trilho') return;
      const i = fotoAtual(trilho);
      $$('[data-mini]', trilho.closest('.detalhe__midia')).forEach((b) => b.setAttribute('aria-current', Number(b.dataset.mini) === i));
    }, true);

    document.addEventListener('keydown', (e) => {
      if (!$('#lightbox').hidden) {
        if (e.key === 'Escape') fecharLightbox();
        else if (e.key === 'ArrowLeft') moverLightbox(-1);
        else if (e.key === 'ArrowRight') moverLightbox(1);
        else prenderFoco(e, $('#lightbox'));
        return;
      }
      if (!$('#gaveta').hidden) { if (e.key === 'Escape') fecharGaveta(); else prenderFoco(e, $('.gaveta__caixa')); return; }
      if (E.modalAberto) {
        if (e.key === 'Escape') fecharModal();
        else if (e.target.id === 'trilho' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          const corpo = e.target.closest('.detalhe__midia');
          const total = e.target.children.length;
          irParaFoto(corpo, (fotoAtual(e.target) + (e.key === 'ArrowLeft' ? -1 : 1) + total) % total);
        } else prenderFoco(e, $('.modal__caixa'));
      }
    });

    // Deslizar o dedo no visualizador de fotos
    let toqueX = null;
    $('#lightbox').addEventListener('touchstart', (e) => { toqueX = e.touches[0].clientX; }, { passive: true });
    $('#lightbox').addEventListener('touchend', (e) => {
      if (toqueX === null) return;
      const dx = e.changedTouches[0].clientX - toqueX;
      if (Math.abs(dx) > 50) moverLightbox(dx > 0 ? -1 : 1);
      toqueX = null;
    });

    // Imagem que não carregou: mostra um aviso no lugar
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && !img.dataset.falhou) { img.dataset.falhou = '1'; img.src = IMG_FALHA; }
    }, true);

    // Sincroniza o pedido entre abas do navegador
    window.addEventListener('storage', (e) => {
      if (e.key === CHAVE_CARRINHO) { E.carrinho = armazenamento.ler(CHAVE_CARRINHO, []); limparCarrinhoInvalido(); rerenderAbas(); if (!$('#gaveta').hidden) renderGaveta(); }
    });
  }

  /* ---------- Início ---------- */
  async function iniciar() {
    ligarEventos();
    configurarInstalacao();
    try {
      E.dados = await carregarDados();
    } catch (erro) {
      $('#carregando').innerHTML = `<div class="erro-carga" role="alert"><strong>Não foi possível carregar o catálogo.</strong>
        <span>${navigator.onLine ? 'Recarregue a página. Se o problema continuar, avise a loja.' : 'Você está sem internet. Conecte-se e tente de novo.'}</span>
        <code>${esc(erro.message)}</code>
        <button class="btn btn--primario btn--peq" type="button">Tentar de novo</button></div>`;
      $('#carregando .btn').onclick = () => location.reload();
      return;
    }
    const { loja } = E.dados;
    $('#marcaNome').textContent = loja.nome;
    $('#faixaDemo').hidden = !loja.demonstracao;
    $('#zapFlutuante').href = linkZap('Olá! Vim pelo site.');
    $('#zapFlutuante').hidden = !soDigitos(loja.whatsapp);
    E.carrinho = armazenamento.ler(CHAVE_CARRINHO, []);
    limparCarrinhoInvalido();
    renderRodape();
    $('#carregando').remove();
    irPara();
  }

  // Exposto só para testes automáticos
  window.__site = { idYoutube, paraCentavos, reais, formatarFone, montarMensagem: (c) => montarMensagem(c), estado: E };

  iniciar();
})();
