// ================= FIREBASE E LOGIN (COM BANCO DE DADOS) =================
const firebaseConfig = {
    apiKey: "AIzaSyAlkfKtC4MdvFJ8QSWvoZehTEjwD1pDeC8",
    authDomain: "meutvtime-79607.firebaseapp.com",
    projectId: "meutvtime-79607",
    storageBucket: "meutvtime-79607.firebasestorage.app",
    messagingSenderId: "692295790487",
    appId: "1:692295790487:web:b002ab023e9fe49ee79ed2"
};

// Inicia o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let usuarioLogado = null;

// Observador: Fica vigiando o login
auth.onAuthStateChanged(user => {
    if (user) {
        usuarioLogado = user;
        document.getElementById('tela-login').style.display = 'none'; 
        
        // Puxa TODOS os dados (Séries, Filmes e Perfil) da Nuvem
        db.collection('usuarios').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                const dados = doc.data();
                // Baixa os dados da nuvem para o celular
                localStorage.setItem('meuTvTimeSeries', JSON.stringify(dados.series || []));
                localStorage.setItem('meuTvTimeFilmes', JSON.stringify(dados.filmes || []));
                if (dados.perfil) localStorage.setItem('meuTvTimePerfil', JSON.stringify(dados.perfil));
                if (dados.listas) localStorage.setItem('meuTvTimeListasCus', JSON.stringify(dados.listas || []));
                
                // Atualiza as variáveis na memória do código ativo
                minhasSeries = dados.series || [];
                meusFilmes = dados.filmes || [];
                minhasListas = dados.listas || [];
                meuPerfil = dados.perfil || { avatar: '', banner: '' };
            } else {
                // Conta totalmente nova! Garante que o celular fique limpo
                localStorage.setItem('meuTvTimeSeries', JSON.stringify([]));
                localStorage.setItem('meuTvTimeFilmes', JSON.stringify([]));
                localStorage.setItem('meuTvTimePerfil', JSON.stringify({ 
                    nome: user.displayName, 
                    avatar: user.photoURL, 
                    banner: '' 
                }));
            }
            
            // Força o site a desenhar as informações corretas após o login
            if (!sessionStorage.getItem('nuvemCarregada')) {
                sessionStorage.setItem('nuvemCarregada', 'true');
                window.location.reload();
            } else {
                // Roda as renderizações iniciais com os dados atualizados da nuvem
                renderizarSeries();
                renderizarFilmes();
                renderizarPerfilSeries();
                renderizarPerfilFilmes();
                renderizarFavoritos();
                renderizarListasPerfil();
                atualizarEstatisticas();
                renderizarImagensPerfil(); 
            }
        });
        
    } else {
        usuarioLogado = null;
        document.getElementById('tela-login').style.display = 'flex';
    }
});

// Entrar
window.fazerLoginGoogle = function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        alert("Erro ao fazer login: " + error.message);
    });
};

// Sair e Limpar a Memória (O CAÇA-FANTASMAS)
window.fazerLogout = function() {
    auth.signOut().then(() => {
        localStorage.clear(); 
        sessionStorage.clear();
        window.location.reload();
    });
};

// -----------------------------------------------------------------
// SALVANDO NA NUVEM (Séries, Filmes e Perfil)
// -----------------------------------------------------------------
window.salvarSeries = function() {
    localStorage.setItem('meuTvTimeSeries', JSON.stringify(minhasSeries));
    if (usuarioLogado) db.collection('usuarios').doc(usuarioLogado.uid).set({ series: minhasSeries }, { merge: true });
};

window.salvarFilmes = function() {
    localStorage.setItem('meuTvTimeFilmes', JSON.stringify(meusFilmes));
    if (usuarioLogado) db.collection('usuarios').doc(usuarioLogado.uid).set({ filmes: meusFilmes }, { merge: true });
};

// Garante que o banner e a foto sejam salvos na nuvem quando editados
window.salvarPerfil = function() {
    localStorage.setItem('meuTvTimePerfil', JSON.stringify(meuPerfil));
    if (usuarioLogado) db.collection('usuarios').doc(usuarioLogado.uid).set({ perfil: meuPerfil }, { merge: true });
};

window.salvarListasCus = function() {
    localStorage.setItem('meuTvTimeListasCus', JSON.stringify(minhasListas));
    if (usuarioLogado) db.collection('usuarios').doc(usuarioLogado.uid).set({ listas: minhasListas }, { merge: true });
};

// ================= REMOÇÃO DE DADOS SEGURA E IMEDIATA =================
window.removerSerie = function(id) {
    if (confirm("Deseja remover esta série do seu perfil?")) {
        // 1. Remove da lista local do celular
        minhasSeries = minhasSeries.filter(s => s.id !== id);
        localStorage.setItem('meuTvTimeSeries', JSON.stringify(minhasSeries));
        
        // 2. Remove de dentro das listas personalizadas locais
        minhasListas = minhasListas.map(lista => {
            if (lista.itens) {
                lista.itens = lista.itens.filter(item => !(item.id === id && item.tipo === 'serie'));
            }
            return lista;
        });
        localStorage.setItem('meuTvTimeListasCus', JSON.stringify(minhasListas));

        // 3. Atualiza a nuvem NA HORA se estiver logado
        if (usuarioLogado) {
            db.collection('usuarios').doc(usuarioLogado.uid).set({ 
                series: minhasSeries,
                listas: minhasListas
            }, { merge: true }).then(() => {
                if (typeof fecharDetalhes === 'function') fecharDetalhes();
                window.location.reload();
            }).catch(error => {
                alert("Erro ao salvar remoção na nuvem: " + error.message);
            });
        } else {
            if (typeof fecharDetalhes === 'function') fecharDetalhes();
            window.location.reload();
        }
    }
};
window.adicionarSerieDiretoDetalhes = function(id, nome, posterUrl) {
    // Adiciona na lista local do celular
    minhasSeries.push({ id, nome: nome.toUpperCase(), posterUrl, episodiosVistos: [], favorito: false });
    
    // Salva no LocalStorage
    localStorage.setItem('meuTvTimeSeries', JSON.stringify(minhasSeries));
    
    // Salva na nuvem silenciosamente se estiver logado
    if (usuarioLogado) {
        db.collection('usuarios').doc(usuarioLogado.uid).set({ series: minhasSeries }, { merge: true }).then(() => {
            // Recarrega a própria tela de detalhes para computar a mudança visual
            abrirDetalhesSerie(id);
        });
    } else {
        abrirDetalhesSerie(id);
    }
    
    // Atualiza as grades invisivelmente ao fundo
    renderizarSeries(); 
    renderizarPerfilSeries(); 
    atualizarEstatisticas();
};

window.removerFoto = function() { 
    meuPerfil.avatar = ''; 
    salvarPerfil(); 
    window.location.reload(); 
};

window.removerBanner = function() { 
    meuPerfil.banner = ''; 
    salvarPerfil(); 
    window.location.reload(); 
};


// ================= 1. DADOS E MEMÓRIA =================
let minhasSeries = JSON.parse(localStorage.getItem('meuTvTimeSeries')) || [];
let meusFilmes = JSON.parse(localStorage.getItem('meuTvTimeFilmes')) || [];
let minhasListas = JSON.parse(localStorage.getItem('meuTvTimeListasCus')) || []; // Banco de dados das Listas
let meuPerfil = JSON.parse(localStorage.getItem('meuTvTimePerfil')) || { avatar: '', banner: '' };


// ================= 2. RENDERIZAR MINHA LISTA (SÉRIES) =================
function renderizarSeries() {
    const listaContainer = document.getElementById('lista-series');
    if (!listaContainer) return;
    listaContainer.innerHTML = '';

    if(minhasSeries.length === 0) {
        listaContainer.innerHTML = '<p style="text-align:center; color:#888; margin-top:30px;">Sua lista está vazia.</p>';
        return;
    }

    minhasSeries.forEach(serie => {
        let proxTemp = 1; let proxEp = 1;
        if (serie.episodiosVistos && serie.episodiosVistos.length > 0) {
            let vistos = serie.episodiosVistos.map(v => {
                let p = v.split('-'); return { t: parseInt(p[0]), e: parseInt(p[1]) };
            });
            vistos.sort((a, b) => a.t !== b.t ? a.t - b.t : a.e - b.e);
            let ultimoVisto = vistos[vistos.length - 1];
            proxTemp = ultimoVisto.t; proxEp = ultimoVisto.e + 1;
        }

        const tForm = String(proxTemp).padStart(2, '0');
        const eForm = String(proxEp).padStart(2, '0');
        const img = serie.posterUrl ? `<img src="${serie.posterUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="background:#333; width:100%; height:100%;"></div>`;

        listaContainer.innerHTML += `
            <div class="serie-card" style="position:relative; cursor:pointer;" onclick="abrirDetalhesEpisodio(${serie.id}, ${proxTemp}, ${proxEp})">
                
                <!-- Clicar na imagem abre a SÉRIE -->
                <div class="img-container" onclick="event.stopPropagation(); abrirDetalhesSerie(${serie.id})">${img}</div>
                
                <div class="serie-info">
                    <!-- Clicar no nome abre a SÉRIE -->
                    <span class="serie-tag" onclick="event.stopPropagation(); abrirDetalhesSerie(${serie.id})">${serie.nome} <i>&gt;</i></span>
                    <span class="serie-ep-info">T${tForm} | E${eForm}</span>
                    <span class="serie-ep-title" style="color:#aaa; font-size:12px;">Próximo episódio</span>
                </div>
                
                <div class="serie-action">
                    <!-- Clicar no check marca o episódio direto daqui -->
                    <button class="check-btn" onclick="event.stopPropagation(); marcarDoCartao(${serie.id}, ${proxTemp}, ${proxEp})">✓</button>
                </div>
            </div>`;
    });
}


window.marcarDoCartao = function(id, t, e) {
    let serie = minhasSeries.find(s => s.id === id);
    if (serie) {
        if (!serie.episodiosVistos) serie.episodiosVistos = [];
        const epId = `${t}-${e}`;
        if (!serie.episodiosVistos.includes(epId)) serie.episodiosVistos.push(epId);
        salvarSeries(); atualizarEstatisticas(); renderizarSeries();
    }
};

// ================= 3. RENDERIZAR MEUS FILMES =================
function renderizarFilmes() {
    const listaContainer = document.getElementById('lista-filmes');
    if (!listaContainer) return;
    listaContainer.innerHTML = '';

    if(meusFilmes.length === 0) {
        listaContainer.innerHTML = '<p style="text-align:center; color:#888; margin-top:30px;">Nenhum filme adicionado.</p>';
        return;
    }

    meusFilmes.forEach(filme => {
        const img = filme.posterUrl ? `<img src="${filme.posterUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="background:#333; width:100%; height:100%;"></div>`;
        const classeVisto = filme.visto ? 'visto' : '';

        listaContainer.innerHTML += `
            <div class="serie-card" onclick="abrirDetalhesFilme(${filme.id})">
                <div class="img-container">${img}</div>
                <div class="serie-info">
                    <span class="serie-tag">${filme.nome} <i>&gt;</i></span>
                    <span class="serie-ep-title" style="color:#aaa; font-size:12px; margin-top:5px;">Filme</span>
                </div>
                <div class="serie-action">
                    <button class="check-btn ${classeVisto}" onclick="event.stopPropagation(); toggleFilmeDireto(${filme.id}, this)">✓</button>
                </div>
            </div>`;
    });
}

window.toggleFilmeDireto = function(id, btn) {
    let filme = meusFilmes.find(f => f.id === id);
    if (filme) {
        filme.visto = !filme.visto;
        salvarFilmes(); atualizarEstatisticas(); renderizarFilmes();
    }
};


// ================= 3.5. RENDERIZAR PERFIL (SÉRIES, FILMES E LISTAS) =================
function renderizarPerfilSeries() {
    const carrosselPerfil = document.getElementById('perfil-series-carrossel');
    if (!carrosselPerfil) return; 
    carrosselPerfil.innerHTML = '';
    if (minhasSeries.length === 0) { carrosselPerfil.innerHTML = '<p style="color:#888; font-size:12px; padding-left:10px;">Nenhuma série adicionada.</p>'; return; }

    minhasSeries.forEach(serie => {
        const imagemHtml = serie.posterUrl ? `<img src="${serie.posterUrl}">` : `<div style="background:#333; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#888;">${serie.nome}</div>`;
        carrosselPerfil.innerHTML += `<div class="poster-item" onclick="abrirDetalhesSerie(${serie.id})">${imagemHtml}</div>`;
    });
}

function renderizarPerfilFilmes() {
    const carrosselFilmes = document.getElementById('perfil-filmes-carrossel');
    if (!carrosselFilmes) return; 
    carrosselFilmes.innerHTML = '';
    if (meusFilmes.length === 0) { carrosselFilmes.innerHTML = '<p style="color:#888; font-size:12px; padding-left:10px;">Nenhum filme adicionado.</p>'; return; }

    meusFilmes.forEach(filme => {
        const imagemHtml = filme.posterUrl ? `<img src="${filme.posterUrl}">` : `<div style="background:#333; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#888;">${filme.nome}</div>`;
        carrosselFilmes.innerHTML += `<div class="poster-item" onclick="abrirDetalhesFilme(${filme.id})">${imagemHtml}</div>`;
    });
}

window.renderizarListasPerfil = function() {
    const carrossel = document.getElementById('perfil-listas-carrossel');
    if (!carrossel) return;
    carrossel.innerHTML = '';
    
    if (minhasListas.length === 0) {
        carrossel.innerHTML = '<p style="color: #888; font-size: 12px; padding-left: 10px;">Crie uma lista para organizar seus favoritos!</p>';
        return;
    }
    
    minhasListas.forEach(lista => {
        let capa = '#333';
        if (lista.itens && lista.itens.length > 0 && lista.itens[0].posterUrl) capa = `url('${lista.itens[0].posterUrl}')`;
        
        carrossel.innerHTML += `
            <div class="poster-item wide" onclick="abrirTelaVerLista(${lista.id})" style="background: ${capa} center/cover; position: relative;">
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7);"></div>
                <span class="poster-label" style="z-index:2; text-align:center; width:100%; left:0; bottom:40%; font-size:14px;">${lista.nome}</span>
                <span style="position:absolute; bottom:10px; left:0; width:100%; text-align:center; color:#ccc; font-size:10px; z-index:2;">${lista.itens.length} itens</span>
            </div>
        `;
    });
};


// ================= 4. NAVEGAÇÃO INFERIOR E DE ABAS =================
const botoesMenu = document.querySelectorAll('.nav-item');
const telas = {
    'tela-series': document.getElementById('tela-series'),
    'tela-filmes': document.getElementById('tela-filmes'),
    'tela-explorar': document.getElementById('tela-explorar'),
    'tela-perfil': document.getElementById('tela-perfil')
};

botoesMenu.forEach(botao => {
    botao.addEventListener('click', function() {
        botoesMenu.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        Object.values(telas).forEach(t => t.classList.add('escondido'));
        telas[this.getAttribute('data-target')].classList.remove('escondido');
    });
});


// ================= 5. INTEGRAÇÃO TMDB (BUSCA MISTA) =================
const API_KEY = 'c7c73e6baf0d3719328a6c2c23381897';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
let modoBusca = 'tv';

window.mudarModoBusca = function(modo) {
    modoBusca = modo;
    document.getElementById('btn-busca-tv').classList.toggle('active', modo === 'tv');
    document.getElementById('btn-busca-movie').classList.toggle('active', modo === 'movie');
    document.getElementById('resultados-busca').innerHTML = '';
    document.getElementById('input-busca').value = '';
    document.getElementById('input-busca').placeholder = modo === 'tv' ? 'Buscar Séries...' : 'Buscar Filmes...';
};

document.getElementById('btn-buscar').addEventListener('click', () => executarBusca());
document.getElementById('input-busca').addEventListener('keypress', (e) => { if (e.key === 'Enter') executarBusca(); });

async function executarBusca() {
    const termo = document.getElementById('input-busca').value.trim();
    if (!termo) return;
    const container = document.getElementById('resultados-busca');
    container.innerHTML = '<p style="text-align:center; color:#888; width:100%;">Buscando...</p>';
    
    try {
        const resposta = await fetch(`${BASE_URL}/search/${modoBusca}?api_key=${API_KEY}&language=pt-BR&query=${encodeURIComponent(termo)}`);
        const dados = await resposta.json();
        renderizarResultadosBusca(dados.results);
    } catch (e) { container.innerHTML = '<p style="color:red; text-align:center; width:100%;">Erro de conexão.</p>'; }
}

function renderizarResultadosBusca(resultados) {
    const container = document.getElementById('resultados-busca');
    container.innerHTML = '';
    if (resultados.length === 0) { container.innerHTML = '<p style="text-align:center; color:#888; width:100%;">Nenhum resultado.</p>'; return; }

    resultados.forEach(item => {
        const posterPath = item.poster_path ? `${IMG_URL}${item.poster_path}` : '';
        const posterHtml = posterPath ? `<img src="${posterPath}">` : `<div style="width:100%; height:220px; background:#333; display:flex; align-items:center; justify-content:center; font-size:10px; color:#888;">Sem Imagem</div>`;
        const tituloReal = item.name || item.title;
        const nomeSeguro = tituloReal.replace(/'/g, "\\'");

        if (modoBusca === 'tv') {
            // Verifica se a série já está adicionada
            const jaAdicionada = minhasSeries.some(s => s.id === item.id);
            const textoBotao = jaAdicionada ? '✓ Adicionada' : '+ Adicionar Série';
            const estiloBotao = jaAdicionada ? 'background-color: #2ecc71; color: white;' : '';

            container.innerHTML += `
                <div class="resultado-item" onclick="abrirDetalhesSerie(${item.id})">
                    ${posterHtml}
                    <div class="resultado-titulo">${tituloReal}</div>
                    <button class="btn-add-lista" style="${estiloBotao}" onclick="event.stopPropagation(); alternarSerieBusca(${item.id}, '${nomeSeguro}', '${posterPath}', this)">${textoBotao}</button>
                </div>`;
        } else {
            // Verifica se o filme já está adicionado
            const jaAdicionado = meusFilmes.some(f => f.id === item.id);
            const textoBotao = jaAdicionado ? '✓ Adicionado' : '+ Adicionar Filme';
            const estiloBotao = jaAdicionado ? 'background-color: #2ecc71; color: white;' : '';

            container.innerHTML += `
                <div class="resultado-item" onclick="abrirDetalhesFilme(${item.id})">
                    ${posterHtml}
                    <div class="resultado-titulo">${tituloReal}</div>
                    <button class="btn-add-lista" style="${estiloBotao}" onclick="event.stopPropagation(); alternarFilmeBusca(${item.id}, '${nomeSeguro}', '${posterPath}', this)">${textoBotao}</button>
                </div>`;
        }
    });
}


// ================= 6. ADICIONAR / REMOVER VIA BUSCA (SEM POP-UPS) =================
window.alternarSerieBusca = function(id, nome, posterUrl, botao) {
    const index = minhasSeries.findIndex(s => s.id === id);

    if (index > -1) {
        // Se já existe, REMOVE
        minhasSeries.splice(index, 1);
        botao.innerText = '+ Adicionar Série';
        botao.style.backgroundColor = ''; // Volta pro CSS padrão (cinza/escuro)
        botao.style.color = '';
    } else {
        // Se não existe, ADICIONA
        minhasSeries.push({ id, nome: nome.toUpperCase(), posterUrl, episodiosVistos: [], favorito: false });
        botao.innerText = '✓ Adicionada';
        botao.style.backgroundColor = '#2ecc71'; // Fica verde
        botao.style.color = 'white';
    }

    // Salva tudo e atualiza as outras telas em segundo plano
    salvarSeries(); 
    renderizarSeries(); 
    renderizarPerfilSeries(); 
    atualizarEstatisticas();
};

window.alternarFilmeBusca = function(id, nome, posterUrl, botao) {
    const index = meusFilmes.findIndex(f => f.id === id);

    if (index > -1) {
        // Se já existe, REMOVE
        meusFilmes.splice(index, 1);
        botao.innerText = '+ Adicionar Filme';
        botao.style.backgroundColor = '';
        botao.style.color = '';
    } else {
        // Se não existe, ADICIONA
        meusFilmes.push({ id, nome: nome.toUpperCase(), posterUrl, visto: false, favorito: false });
        botao.innerText = '✓ Adicionado';
        botao.style.backgroundColor = '#2ecc71';
        botao.style.color = 'white';
    }

    // Salva tudo e atualiza as outras telas em segundo plano
    salvarFilmes(); 
    renderizarFilmes(); 
    renderizarPerfilFilmes(); 
    atualizarEstatisticas();
};


window.abrirDetalhesSerie = async function(serieId) {
    const tela = document.getElementById('tela-detalhes');
    const conteudo = document.getElementById('conteudo-detalhes');
    tela.classList.remove('escondido');
    conteudo.innerHTML = '<p style="text-align:center; margin-top:50px; color:#888;">Carregando...</p>';

    const serieSalva = minhasSeries.find(s => s.id === serieId);

    try {
        const resp = await fetch(`${BASE_URL}/tv/${serieId}?api_key=${API_KEY}&language=pt-BR`);
        const serie = await resp.json();
        const ano = serie.first_air_date ? serie.first_air_date.split('-')[0] : 'N/A';

        let htmlTemporadas = '';
        serie.seasons.forEach(temp => {
            if (temp.season_number > 0) {
                let classeVisto = '';
                if (serieSalva && serieSalva.episodiosVistos) {
                    const eps = serieSalva.episodiosVistos.filter(e => e.startsWith(`${temp.season_number}-`));
                    if (eps.length === temp.episode_count && temp.episode_count > 0) classeVisto = 'visto';
                }
                htmlTemporadas += `
                    <div class="season-header" onclick="carregarEpisodios(${serie.id}, ${temp.season_number})">
                        <h3 style="font-size:16px;">Temporada ${temp.season_number}</h3>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:12px; color:#888;">${temp.episode_count} eps</span>
                            <button class="check-btn ${classeVisto}" style="width:25px; height:25px;" onclick="event.stopPropagation(); marcarTemporadaCompleta(${serie.id}, ${temp.season_number}, this)">✓</button>
                        </div>
                    </div>
                    <div id="eps-temp-${temp.season_number}" class="eps-container escondido"></div>`;
            }
        });

        const isFavorito = serieSalva && serieSalva.favorito ? 'ativo' : '';
        const nomeSeguro = serie.name.replace(/'/g, "\\'");
        const posterUrlPath = serie.poster_path ? `${IMG_URL}${serie.poster_path}` : '';

        // Se a série já está na lista, mostra o botão vermelho. Se não, deixa vazio lá em cima.
        const botaoRemoverHtml = serieSalva 
            ? `<button onclick="removerSerie(${serie.id})" style="background: #c0392b; color: white; border: none; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; cursor: pointer;">Remover Série</button>`
            : '';

        // Se a série NÃO está na lista, cria o botão amarelo fixo no rodapé
        const botaoAdicionarFixoHtml = !serieSalva
            ? `<button onclick="adicionarSerieDiretoDetalhes(${serie.id}, '${nomeSeguro}', '${posterUrlPath}')" style="position: fixed; bottom: 0; left: 0; width: 100%; background: #ffcc00; color: #000; border: none; padding: 18px; font-weight: bold; font-size: 14px; letter-spacing: 1px; z-index: 5000; cursor: pointer; text-align: center;">+ ADICIONAR SÉRIE</button>`
            : '';

        conteudo.innerHTML = `
            <div style="height:230px; background:linear-gradient(to bottom, transparent, #000), url('${IMG_URL}${serie.backdrop_path}') center/cover;"></div>
            <div style="padding:15px; margin-top:-30px; padding-bottom: 80px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                    <h2 style="font-size:24px; font-weight:bold; width:70%;">${serie.name}</h2>
                    <div style="display:flex;">
                        <button class="btn-add-to-list-icon" onclick="abrirModalAddLista(${serie.id}, 'serie', '${posterUrlPath}', '${nomeSeguro}')">☰</button>
                        <button class="btn-favorito ${isFavorito}" onclick="toggleFavoritoSerie(${serie.id}, this)">♥</button>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <p style="color:#aaa; font-size:13px; margin: 0;">${ano} • ${serie.number_of_seasons} Temporadas</p>
                    ${botaoRemoverHtml}
                </div>
                
                <div style="display:flex; margin-bottom:20px; border-bottom:1px solid #222;">
                    <button class="tab-btn active" style="width:50%;" onclick="mudarAba('sobre', this)">SOBRE</button>
                    <button class="tab-btn" style="width:50%;" onclick="mudarAba('episodios', this)">EPISÓDIOS</button>
                </div>
                <div id="aba-sobre"><p style="font-size:14px; color:#ccc;">${serie.overview || "Sem sinopse."}</p></div>
                <div id="aba-episodios" class="escondido">${htmlTemporadas}</div>
            </div>
            ${botaoAdicionarFixoHtml}`;
            
    } catch(e) { conteudo.innerHTML = '<p>Erro.</p>'; }
};



// ================= 8. DETALHES DO FILME =================
window.abrirDetalhesFilme = async function(filmeId) {
    const tela = document.getElementById('tela-detalhes');
    const conteudo = document.getElementById('conteudo-detalhes');
    tela.classList.remove('escondido');
    conteudo.innerHTML = '<p style="text-align:center; margin-top:50px; color:#888;">Carregando Filme...</p>';

    const filmeSalvo = meusFilmes.find(f => f.id === filmeId);

    try {
        const resp = await fetch(`${BASE_URL}/movie/${filmeId}?api_key=${API_KEY}&language=pt-BR`);
        const filme = await resp.json();
        const ano = filme.release_date ? filme.release_date.split('-')[0] : 'N/A';
        const duracao = filme.runtime ? `${filme.runtime} min` : 'N/A';

        const estaVisto = filmeSalvo && filmeSalvo.visto;
        const btnVistoHtml = `
            <div style="text-align:center; margin: 20px 0;">
                <button id="btn-visto-filme" onclick="toggleVistoFilmeModal(${filme.id})" style="background-color: ${estaVisto ? '#78b833' : '#333'}; color: #fff; border: none; padding: 15px 30px; border-radius: 30px; font-weight: bold; font-size: 16px; width: 100%; display:flex; justify-content:center; gap:10px; align-items:center;">
                    <span style="background:#fff; color:${estaVisto ? '#78b833' : '#000'}; border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;">✓</span>
                    ${estaVisto ? 'Assistido' : 'Marcar como visto'}
                </button>
            </div>
        `;

        const isFavoritoFilme = filmeSalvo && filmeSalvo.favorito ? 'ativo' : '';
        const nomeSeguro = filme.title.replace(/'/g, "\\'");
        const posterUrlPath = filme.poster_path ? `${IMG_URL}${filme.poster_path}` : '';

        conteudo.innerHTML = `
            <div style="height:230px; background:linear-gradient(to bottom, transparent, #000), url('${IMG_URL}${filme.backdrop_path}') center/cover;"></div>
            <div style="padding:15px; margin-top:-30px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                    <h2 style="font-size:24px; font-weight:bold; width:70%;">${filme.title}</h2>
                    <div style="display:flex;">
                        <!-- NOVO BOTÃO DE LISTA -->
                        <button class="btn-add-to-list-icon" onclick="abrirModalAddLista(${filme.id}, 'filme', '${posterUrlPath}', '${nomeSeguro}')">☰</button>
                        <button class="btn-favorito ${isFavoritoFilme}" onclick="toggleFavoritoFilme(${filme.id}, this)">♥</button>
                    </div>
                </div>
                <p style="color:#aaa; font-size:13px; margin-bottom:15px;">${ano} • Filme • ${duracao}</p>
                
                ${filmeSalvo ? btnVistoHtml : '<p style="color:#ffcc00; text-align:center; font-size:12px; margin:20px 0;">Adicione o filme à sua lista para marcá-lo como visto.</p>'}
                <h3 style="font-size:16px; margin-bottom:8px; color:#ffcc00;">Sinopse</h3>
                <p style="font-size:14px; line-height:1.6; color:#ccc; text-align:justify;">${filme.overview || "Sinopse não disponível em português."}</p>
            </div>`;
    } catch(e) { conteudo.innerHTML = '<p>Erro.</p>'; }
};

window.toggleVistoFilmeModal = function(id) {
    let filme = meusFilmes.find(f => f.id === id);
    if(filme) {
        filme.visto = !filme.visto;
        salvarFilmes(); atualizarEstatisticas(); renderizarFilmes();
        const btn = document.getElementById('btn-visto-filme');
        if (filme.visto) {
            btn.style.backgroundColor = '#78b833';
            btn.innerHTML = `<span style="background:#fff; color:#78b833; border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;">✓</span> Assistido`;
        } else {
            btn.style.backgroundColor = '#333';
            btn.innerHTML = `<span style="background:#fff; color:#000; border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;">✓</span> Marcar como visto`;
        }
    }
}
window.fecharDetalhes = function() { document.getElementById('tela-detalhes').classList.add('escondido'); };


// ================= 9. REGRAS DE ABAS E EPS (SÉRIES) =================
window.mudarAba = function(aba, btnClicado) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btnClicado.classList.add('active');
    document.getElementById('aba-sobre').classList.toggle('escondido', aba !== 'sobre');
    document.getElementById('aba-episodios').classList.toggle('escondido', aba !== 'episodios');
};

window.carregarEpisodios = async function(serieId, seasonNum) {
    const container = document.getElementById(`eps-temp-${seasonNum}`);
    if (container.innerHTML !== '') return container.classList.toggle('escondido');
    container.innerHTML = '<p style="text-align:center; padding:10px; color:#888;">Carregando...</p>';
    container.classList.remove('escondido');

    const serieSalva = minhasSeries.find(s => s.id === serieId);
    const vistos = (serieSalva && serieSalva.episodiosVistos) ? serieSalva.episodiosVistos : [];

    try {
        const resp = await fetch(`${BASE_URL}/tv/${serieId}/season/${seasonNum}?api_key=${API_KEY}&language=pt-BR`);
        const dados = await resp.json();
        let html = '';
        dados.episodes.forEach(ep => {
            const img = ep.still_path ? `${IMG_URL}${ep.still_path}` : '';
            const tForm = String(seasonNum).padStart(2, '0');
            const eForm = String(ep.episode_number).padStart(2, '0');
            const classeVisto = vistos.includes(`${seasonNum}-${ep.episode_number}`) ? 'visto' : '';
            html += `
                <div class="ep-card">
                    <img src="${img}" class="ep-img" style="background:#333;">
                    <div class="ep-info">
                        <div style="font-weight:bold; font-size:14px;">T${tForm} | E${eForm}</div>
                        <div style="font-size:12px; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${ep.name}</div>
                    </div>
                    <button class="ep-check ${classeVisto}" data-ep="${ep.episode_number}" onclick="toggleEpisodioVisto(${serieId}, ${seasonNum}, ${ep.episode_number}, this)">✓</button>
                </div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p>Erro.</p>'; }
};

window.toggleEpisodioVisto = function(serieId, tempNum, epNum, btn) {
    let serie = minhasSeries.find(s => s.id === serieId);
    if (!serie) return alert('Adicione à sua lista primeiro!');
    if (!serie.episodiosVistos) serie.episodiosVistos = [];
    const epId = `${tempNum}-${epNum}`;
    const index = serie.episodiosVistos.indexOf(epId);
    if (index > -1) { serie.episodiosVistos.splice(index, 1); btn.classList.remove('visto'); } 
    else { serie.episodiosVistos.push(epId); btn.classList.add('visto'); }
    salvarSeries(); atualizarEstatisticas(); renderizarSeries();
};

window.marcarTemporadaCompleta = async function(serieId, tempNum, btnTemp) {
    let serie = minhasSeries.find(s => s.id === serieId);
    if (!serie) return alert('Adicione à lista primeiro!');
    if (!serie.episodiosVistos) serie.episodiosVistos = [];

    const marcando = btnTemp.classList.toggle('visto');
    const container = document.getElementById(`eps-temp-${tempNum}`);
    if (container.innerHTML === '') await carregarEpisodios(serieId, tempNum);
    
    container.querySelectorAll('.ep-check').forEach(btn => {
        const epId = `${tempNum}-${btn.getAttribute('data-ep')}`;
        if (marcando) { btn.classList.add('visto'); if (!serie.episodiosVistos.includes(epId)) serie.episodiosVistos.push(epId); } 
        else { btn.classList.remove('visto'); const i = serie.episodiosVistos.indexOf(epId); if (i > -1) serie.episodiosVistos.splice(i, 1); }
    });
    salvarSeries(); atualizarEstatisticas(); renderizarSeries();
};


// ================= 10. ESTATÍSTICAS =================
window.abrirEstatisticas = function() { document.getElementById('tela-estatisticas').classList.remove('escondido'); atualizarEstatisticas(); };
window.fecharEstatisticas = function() { document.getElementById('tela-estatisticas').classList.add('escondido'); };
window.atualizarEstatisticas = function() {
    let totalEpsVistos = 0;
    minhasSeries.forEach(s => { if (s.episodiosVistos) totalEpsVistos += s.episodiosVistos.length; });
    let totalFilmesVistos = meusFilmes.filter(f => f.visto).length;
    let totalMinutos = (totalEpsVistos * 45) + (totalFilmesVistos * 120);
    let meses = Math.floor(totalMinutos / 43200); let restoMinutos = totalMinutos % 43200;
    let dias = Math.floor(restoMinutos / 1440); restoMinutos = restoMinutos % 1440;
    let horas = Math.floor(restoMinutos / 60);

    const elMeses = document.getElementById('stat-meses'); if (elMeses) elMeses.innerText = meses;
    const elDias = document.getElementById('stat-dias'); if (elDias) elDias.innerText = dias;
    const elHoras = document.getElementById('stat-horas'); if (elHoras) elHoras.innerText = horas;
    const elTotalEps = document.getElementById('stat-total-eps'); if (elTotalEps) elTotalEps.innerText = totalEpsVistos;
    const elDetEps = document.getElementById('det-total-eps'); if(elDetEps) elDetEps.innerText = totalEpsVistos;
    const elDetSeries = document.getElementById('det-total-series'); if(elDetSeries) elDetSeries.innerText = minhasSeries.length;
    const elDetFilmes = document.getElementById('det-total-filmes'); if(elDetFilmes) elDetFilmes.innerText = meusFilmes.length;
};


// ================= 11. FAVORITOS (SÉRIES E FILMES) =================
window.toggleFavoritoSerie = function(id, btn) {
    let serie = minhasSeries.find(s => s.id === id);
    if (!serie) return alert('Você precisa adicionar a série à sua lista primeiro!');
    serie.favorito = !serie.favorito; btn.classList.toggle('ativo'); salvarSeries(); renderizarFavoritos();
};
window.toggleFavoritoFilme = function(id, btn) {
    let filme = meusFilmes.find(f => f.id === id);
    if (!filme) return alert('Você precisa adicionar o filme à sua lista primeiro!');
    filme.favorito = !filme.favorito; btn.classList.toggle('ativo'); salvarFilmes(); renderizarFavoritos();
};
window.renderizarFavoritos = function() {
    const carrosselSeries = document.getElementById('perfil-series-favoritas-carrossel');
    const carrosselFilmes = document.getElementById('perfil-filmes-favoritos-carrossel');
    if (!carrosselSeries || !carrosselFilmes) return;

    carrosselSeries.innerHTML = ''; const seriesFav = minhasSeries.filter(s => s.favorito);
    if (seriesFav.length === 0) { carrosselSeries.innerHTML = '<p style="color:#888; font-size:12px; padding-left:10px;">Nenhuma série favorita.</p>'; } 
    else { seriesFav.forEach(serie => { const img = serie.posterUrl ? `<img src="${serie.posterUrl}">` : `<div style="background:#333;width:100%;height:100%;"></div>`; carrosselSeries.innerHTML += `<div class="poster-item" onclick="abrirDetalhesSerie(${serie.id})">${img}</div>`; }); }

    carrosselFilmes.innerHTML = ''; const filmesFav = meusFilmes.filter(f => f.favorito);
    if (filmesFav.length === 0) { carrosselFilmes.innerHTML = '<p style="color:#888; font-size:12px; padding-left:10px;">Nenhum filme favorito.</p>'; } 
    else { filmesFav.forEach(filme => { const img = filme.posterUrl ? `<img src="${filme.posterUrl}">` : `<div style="background:#333;width:100%;height:100%;"></div>`; carrosselFilmes.innerHTML += `<div class="poster-item" onclick="abrirDetalhesFilme(${filme.id})">${img}</div>`; }); }
};


// ================= 12. LÓGICA DAS LISTAS PERSONALIZADAS =================
window.abrirModalCriarLista = function() {
    document.getElementById('modal-criar-lista').classList.remove('escondido');
    document.getElementById('input-nome-lista').value = '';
};
window.fecharModalCriarLista = function() { document.getElementById('modal-criar-lista').classList.add('escondido'); };

window.salvarNovaLista = function() {
    const nome = document.getElementById('input-nome-lista').value.trim();
    if(!nome) return alert('Digite um nome para a lista!');
    minhasListas.push({ id: Date.now(), nome: nome.toUpperCase(), itens: [] });
    salvarListasCus(); renderizarListasPerfil(); fecharModalCriarLista();
};

window.abrirModalAddLista = function(itemId, tipo, posterUrl, nome) {
    if(minhasListas.length === 0) { alert('Vá ao seu Perfil e crie uma lista primeiro!'); return; }
    document.getElementById('modal-add-lista').classList.remove('escondido');
    const divOpcoes = document.getElementById('opcoes-listas-add');
    divOpcoes.innerHTML = '';
    minhasListas.forEach(lista => {
        divOpcoes.innerHTML += `<button class="btn-escolher-lista" onclick="addItemNaLista(${lista.id}, ${itemId}, '${tipo}', '${posterUrl}', '${nome}')">${lista.nome}</button>`;
    });
};
window.fecharModalAddLista = function() { document.getElementById('modal-add-lista').classList.add('escondido'); };

window.addItemNaLista = function(listaId, itemId, tipo, posterUrl, nome) {
    let lista = minhasListas.find(l => l.id === listaId);
    if(lista) {
        if(lista.itens.find(i => i.id === itemId && i.tipo === tipo)) {
            alert('Este item já está nessa lista!');
        } else {
            lista.itens.push({ id: itemId, tipo: tipo, posterUrl: posterUrl, nome: nome });
            salvarListasCus(); renderizarListasPerfil();
            alert(`Adicionado à lista ${lista.nome}!`);
            fecharModalAddLista();
        }
    }
};

window.abrirTelaVerLista = function(listaId) {
    const lista = minhasListas.find(l => l.id === listaId);
    if(!lista) return;
    document.getElementById('tela-ver-lista').classList.remove('escondido');
    document.getElementById('titulo-ver-lista').innerText = lista.nome;
    const container = document.getElementById('conteudo-ver-lista');
    container.innerHTML = '';
    
    if(lista.itens.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#888; width:100%;">Lista vazia.</p>';
    } else {
        lista.itens.forEach(item => {
            const img = item.posterUrl ? `<img src="${item.posterUrl}">` : `<div style="background:#333;width:100%;height:220px;"></div>`;
            const onclickFn = item.tipo === 'serie' ? `abrirDetalhesSerie(${item.id})` : `abrirDetalhesFilme(${item.id})`;
            container.innerHTML += `
                <div class="resultado-item" onclick="${onclickFn}">
                    ${img}
                    <div class="resultado-titulo">${item.nome}</div>
                    <button class="btn-add-lista" onclick="event.stopPropagation(); removerItemLista(${lista.id}, ${item.id}, '${item.tipo}')" style="background:#c0392b; color:#fff;">Remover</button>
                </div>
            `;
        });
    }
};
window.fecharTelaVerLista = function() { document.getElementById('tela-ver-lista').classList.add('escondido'); };

window.removerItemLista = function(listaId, itemId, tipo) {
    if(!confirm('Remover este item da lista?')) return;
    let lista = minhasListas.find(l => l.id === listaId);
    if(lista) {
        lista.itens = lista.itens.filter(i => !(i.id === itemId && i.tipo === tipo));
        salvarListasCus(); renderizarListasPerfil(); abrirTelaVerLista(listaId);
    }
};

// ================= 13. EDITAR PERFIL (AVATAR E BANNER) =================
// Cria o banco de dados específico para o Perfil
function salvarPerfil() {
    localStorage.setItem('meuTvTimePerfil', JSON.stringify(meuPerfil));
    // Salva na nuvem também, se estiver logado
    if (typeof usuarioLogado !== 'undefined' && usuarioLogado) {
        db.collection('usuarios').doc(usuarioLogado.uid).set({ perfil: meuPerfil }, { merge: true });
    }
}

// Atualiza o HTML com as fotos salvas
window.renderizarImagensPerfil = function() {
    const banner = document.getElementById('meu-banner-perfil');
    const avatar = document.getElementById('meu-avatar-perfil');
    
    if (banner) {
        banner.style.backgroundImage = meuPerfil.banner ? `url('${meuPerfil.banner}')` : 'none';
    }
    if (avatar) {
        avatar.style.backgroundImage = meuPerfil.avatar ? `url('${meuPerfil.avatar}')` : 'none';
    }
};

// Funções para abrir e fechar o modal inicial de Editar
window.abrirModalEditarPerfil = function() {
    document.getElementById('modal-editar-perfil').classList.remove('escondido');
};
window.fecharModalEditarPerfil = function() {
    document.getElementById('modal-editar-perfil').classList.add('escondido');
};

// ====== NOVAS FUNÇÕES: REMOVER FOTO E BANNER ======
window.removerFoto = function() {
    meuPerfil.avatar = ''; 
    salvarPerfil();
    renderizarImagensPerfil(); 
    fecharModalEditarPerfil();
    window.location.reload();
};

window.removerBanner = function() {
    meuPerfil.banner = ''; 
    salvarPerfil();
    renderizarImagensPerfil(); 
    fecharModalEditarPerfil();
    window.location.reload();
};
// ==================================================

// Função que abre a galeria com todas as suas séries e filmes
window.abrirSelecaoImagem = function(tipo) {
    fecharModalEditarPerfil();
    document.getElementById('modal-selecionar-imagem').classList.remove('escondido');
    
    const grid = document.getElementById('grid-selecao-imagens');
    grid.innerHTML = '';

    // Junta as séries e os filmes que você já adicionou em uma única lista
    const todosOsItens = [...minhasSeries, ...meusFilmes];

    if (todosOsItens.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#888; width:100%; margin-top:30px;">Você precisa adicionar séries ou filmes na guia Explorar primeiro!</p>';
        return;
    }

    // Desenha cada item como um botão selecionável
    todosOsItens.forEach(item => {
        if (item.posterUrl) {
            grid.innerHTML += `
                <div class="resultado-item" onclick="aplicarImagemPerfil('${tipo}', '${item.posterUrl}')" style="cursor:pointer; border: 2px solid transparent;">
                    <img src="${item.posterUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:5px;">
                </div>
            `;
        }
    });
};

window.fecharSelecaoImagem = function() {
    document.getElementById('modal-selecionar-imagem').classList.add('escondido');
};

// Salva a imagem escolhida e atualiza a tela instantaneamente
window.aplicarImagemPerfil = function(tipo, url) {
    if (tipo === 'avatar') {
        meuPerfil.avatar = url;
    } else if (tipo === 'banner') {
        meuPerfil.banner = url;
    }
    
    salvarPerfil();
    renderizarImagensPerfil();
    fecharSelecaoImagem();
};


// ================= INICIALIZAÇÃO GERAL =================
renderizarSeries();
renderizarFilmes();
renderizarPerfilSeries();
renderizarPerfilFilmes();
renderizarFavoritos();
renderizarListasPerfil();
atualizarEstatisticas();
renderizarImagensPerfil(); 
// // ================= 14. IMPORTAÇÃO DE DADOS DO TV TIME =================

const inputCsvTvTime = document.getElementById('input-csv-tvtime');

if (inputCsvTvTime) {
    inputCsvTvTime.addEventListener('change', function(evento) {
        const arquivo = evento.target.files[0];
        if (!arquivo) return;

        const leitor = new FileReader();
        
        leitor.onload = async function(e) {
            const texto = e.target.result;
            const linhas = texto.split('\n');
            const seriesParaImportar = [];

            // Pula a primeira linha (cabeçalho) e lê o resto
            for (let i = 1; i < linhas.length; i++) {
                const linha = linhas[i].trim();
                if (linha === '') continue;

                // Expressão regular para dividir por vírgulas, mas ignorar vírgulas dentro de aspas
                const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                
                if (colunas.length >= 1) {
                    let nomeSerie = colunas[0].trim();
                    nomeSerie = nomeSerie.replace(/^"|"$/g, ''); 
                    
                    if (nomeSerie && nomeSerie !== 'Tv_show_name') {
                        seriesParaImportar.push(nomeSerie);
                    }
                }
            }

            if (seriesParaImportar.length === 0) {
                alert('Nenhuma série encontrada no arquivo. Verifique se é o documento correto.');
                return;
            }

            alert(`Encontradas ${seriesParaImportar.length} séries. A importação começou! Isso vai demorar cerca de ${Math.ceil(seriesParaImportar.length / 60)} minuto(s). NÃO feche o aplicativo.`);

            let adicionadas = 0;

            for (let i = 0; i < seriesParaImportar.length; i++) {
                const nomeBusca = seriesParaImportar[i];

                try {
                    const resposta = await fetch(`${BASE_URL}/search/tv?api_key=${API_KEY}&language=pt-BR&query=${encodeURIComponent(nomeBusca)}`);
                    const dados = await resposta.json();

                    if (dados.results && dados.results.length > 0) {
                        const serieTMDB = dados.results[0]; 
                        const jaExiste = minhasSeries.find(s => s.id === serieTMDB.id);
                        
                        if (!jaExiste) {
                            const posterUrlPath = serieTMDB.poster_path ? `${IMG_URL}${serieTMDB.poster_path}` : '';
                            
                            minhasSeries.push({ 
                                id: serieTMDB.id, 
                                nome: serieTMDB.name.toUpperCase(), 
                                posterUrl: posterUrlPath, 
                                episodiosVistos: [], 
                                favorito: false 
                            });
                            adicionadas++;
                        }
                    }
                } catch(erro) {
                    console.log('Erro ao importar a série:', nomeBusca);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            salvarSeries();
            if (typeof renderizarSeries === 'function') renderizarSeries();
            if (typeof renderizarPerfilSeries === 'function') renderizarPerfilSeries();
            if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
            
            alert(`Importação concluída! ${adicionadas} novas séries foram adicionadas à sua lista.`);
            inputCsvTvTime.value = ''; 
        };

        leitor.readAsText(arquivo);
    });
}
// ================= 15. TELA DE "TODAS AS SÉRIES" E FILTROS =================

let sortAtual = 'adicionados'; 
let filterAtual = 'tudo'; 

let tempSort = 'adicionados';
let tempFilter = 'tudo';

window.abrirTodasAsSeriesPerfil = function() {
    document.getElementById('tela-todas-series').classList.remove('escondido');
    renderizarGridTodasAsSeries();
};

window.fecharTodasAsSeriesPerfil = function() {
    document.getElementById('tela-todas-series').classList.add('escondido');
};

window.abrirFiltrosSeries = function() {
    tempSort = sortAtual;
    tempFilter = filterAtual;
    atualizarVisualModalFiltros();
    document.getElementById('modal-filtros-series').classList.remove('escondido');
};

window.fecharFiltrosSeries = function() {
    document.getElementById('modal-filtros-series').classList.add('escondido');
};

window.selecionarSort = function(sort) {
    tempSort = sort;
    atualizarVisualModalFiltros();
};

window.selecionarFilter = function(filter) {
    tempFilter = filter;
    atualizarVisualModalFiltros();
};

window.atualizarVisualModalFiltros = function() {
    const btns = document.querySelectorAll('.btn-sort');
    btns.forEach(btn => btn.classList.remove('active'));
    if(tempSort === 'assistidos') btns[0].classList.add('active');
    if(tempSort === 'adicionados') btns[1].classList.add('active');
    if(tempSort === 'alfabetica') btns[2].classList.add('active');

    document.querySelectorAll('.radio-btn').forEach(radio => {
        radio.classList.remove('ativo');
    });
    const radioAtivo = document.getElementById(`radio-${tempFilter}`);
    if(radioAtivo) radioAtivo.classList.add('ativo');
};

window.redefinirFiltros = function() {
    tempSort = 'adicionados';
    tempFilter = 'tudo';
    atualizarVisualModalFiltros();
};

window.aplicarFiltros = function() {
    sortAtual = tempSort;
    filterAtual = tempFilter;
    fecharFiltrosSeries();
    renderizarGridTodasAsSeries();
};

window.renderizarGridTodasAsSeries = function() {
    const grid = document.getElementById('grid-todas-series');
    grid.innerHTML = '';

    if (minhasSeries.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#888; grid-column: span 3; margin-top: 50px;">Nenhuma série adicionada.</p>';
        return;
    }

    let seriesFiltradas = minhasSeries.filter(serie => {
        const temEpisodios = serie.episodiosVistos && serie.episodiosVistos.length > 0;
        if (filterAtual === 'assistindo') return temEpisodios;
        if (filterAtual === 'naocomecei') return !temEpisodios;
        return true; 
    });

    let seriesOrdenadas = [...seriesFiltradas];
    
    if (sortAtual === 'alfabetica') {
        seriesOrdenadas.sort((a, b) => a.nome.localeCompare(b.nome));
    } 
    else if (sortAtual === 'adicionados') {
        seriesOrdenadas.reverse(); 
    } 
    else if (sortAtual === 'assistidos') {
        seriesOrdenadas.reverse().sort((a, b) => {
            const aEps = a.episodiosVistos ? a.episodiosVistos.length : 0;
            const bEps = b.episodiosVistos ? b.episodiosVistos.length : 0;
            if (aEps > 0 && bEps === 0) return -1;
            if (aEps === 0 && bEps > 0) return 1;
            return 0;
        });
    }

    seriesOrdenadas.forEach(serie => {
        const imagemHtml = serie.posterUrl 
            ? `<img src="${serie.posterUrl}" style="width:100%; height:100%; object-fit:cover;">`
            : `<div style="background:#333; width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-align:center; font-size:10px; color:#888; padding:5px;">${serie.nome}</div>`;

        let progressBar = '';
        if (serie.episodiosVistos && serie.episodiosVistos.length > 0) {
            progressBar = `<div style="position:absolute; bottom:0; left:0; width:60%; height:5px; background:#ffcc00; z-index:2;"></div>`;
        }

        grid.innerHTML += `
            <div style="width:100%; aspect-ratio: 2/3; position:relative; overflow:hidden; cursor:pointer;" onclick="abrirDetalhesSerie(${serie.id})">
                ${imagemHtml}
                <div style="position:absolute; bottom:0; left:0; width:100%; height:20px; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent);"></div>
                ${progressBar}
            </div>
        `;
    });
};

// ================= 16. GRADES DE FILMES E FAVORITOS =================
window.abrirGradePerfil = function(tipo) {
    const tela = document.getElementById('tela-grade-generica');
    const titulo = document.getElementById('titulo-grade-generica');
    const grid = document.getElementById('grid-generica');
    const menuFavoritos = document.getElementById('menu-favoritos-tvtime');
    
    tela.classList.remove('escondido');
    grid.innerHTML = '';
    
    let lista = [];
    let isSerie = true;

    if (tipo === 'seriesFav') {
        titulo.innerText = 'Séries favoritas';
        lista = minhasSeries.filter(s => s.favorito);
        menuFavoritos.style.display = 'block'; 
        isSerie = true;
    } else if (tipo === 'filmes') {
        titulo.innerText = 'Filmes';
        lista = meusFilmes;
        menuFavoritos.style.display = 'none'; 
        isSerie = false;
    } else if (tipo === 'filmesFav') {
        titulo.innerText = 'Filmes favoritos';
        lista = meusFilmes.filter(f => f.favorito);
        menuFavoritos.style.display = 'block'; 
        isSerie = false;
    }

    if (lista.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#888; grid-column: span 3; margin-top: 50px;">Nenhum item encontrado.</p>';
        return;
    }

    lista.forEach(item => {
        const imagemHtml = item.posterUrl 
            ? `<img src="${item.posterUrl}" style="width:100%; height:100%; object-fit:cover;">`
            : `<div style="background:#333; width:100%; height:100%; display:flex; align-items:center; justify-content:center; text-align:center; font-size:10px; color:#888; padding:5px;">${item.nome}</div>`;

        const onclickFn = isSerie ? `abrirDetalhesSerie(${item.id})` : `abrirDetalhesFilme(${item.id})`;

        grid.innerHTML += `
            <div style="width:100%; aspect-ratio: 2/3; position:relative; overflow:hidden; cursor:pointer;" onclick="${onclickFn}">
                ${imagemHtml}
            </div>
        `;
    });
};

window.fecharGradePerfil = function() {
    document.getElementById('tela-grade-generica').classList.add('escondido');
};

// ================= 17. DETALHES DO EPISÓDIO =================

window.abrirDetalhesEpisodio = async function(serieId, seasonNum, epNum) {
    const tela = document.getElementById('tela-detalhes-episodio');
    const conteudo = document.getElementById('conteudo-detalhes-episodio');
    tela.classList.remove('escondido');
    conteudo.innerHTML = '<p style="text-align:center; margin-top:50px; color:#888;">Carregando episódio...</p>';

    try {
        // Busca os dados específicos do episódio
        const resp = await fetch(`${BASE_URL}/tv/${serieId}/season/${seasonNum}/episode/${epNum}?api_key=${API_KEY}&language=pt-BR`);
        const ep = await resp.json();
        
        // Busca o nome da série
        const respSerie = await fetch(`${BASE_URL}/tv/${serieId}?api_key=${API_KEY}&language=pt-BR`);
        const serieData = await respSerie.json();

        // Organiza as informações visuais
        const img = ep.still_path ? `${IMG_URL}${ep.still_path}` : (serieData.backdrop_path ? `${IMG_URL}${serieData.backdrop_path}` : '');
        const tForm = String(seasonNum).padStart(2, '0');
        const eForm = String(epNum).padStart(2, '0');
        const dataAr = ep.air_date ? ep.air_date.split('-').reverse().join('/') : 'Data não informada';
        const sinopse = ep.overview || "Nenhuma sinopse disponível para este episódio ainda.";
        const tituloEpisodio = ep.name || `Episódio ${epNum}`;
        
        // Verifica se o episódio já foi marcado como visto
        const serieSalva = minhasSeries.find(s => s.id === serieId);
        const isVisto = (serieSalva && serieSalva.episodiosVistos && serieSalva.episodiosVistos.includes(`${seasonNum}-${epNum}`));
        const corBotao = isVisto ? '#78b833' : '#333';

        // Desenha a tela
        conteudo.innerHTML = `
            <div style="height:250px; background:linear-gradient(to bottom, transparent, #000), url('${img}') center/cover; margin-top: -70px;"></div>
            
            <div style="padding: 20px; margin-top: -30px;">
                <!-- Nome da Série (Clicável) -->
                <div onclick="fecharDetalhesEpisodio(); abrirDetalhesSerie(${serieId})" style="display:inline-block; border: 1px solid #555; border-radius: 15px; padding: 3px 10px; font-size: 11px; font-weight: bold; margin-bottom: 15px; color: #ccc; cursor:pointer;">
                    ${serieData.name.toUpperCase()} &gt;
                </div>
                
                <!-- Info do Episódio -->
                <h2 style="font-size:26px; font-weight:bold; margin-bottom: 5px;">T${tForm} \vert{} E${eForm}</h2>
                <h3 style="font-size:16px; color:#aaa; font-weight: normal; margin-bottom: 20px;">${tituloEpisodio}</h3>
                
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; padding-bottom: 15px; margin-bottom: 20px;">
                    <div style="font-size: 13px; color: #888;">📅 ${dataAr}</div>
                    
                    <!-- Botão Marcar como Visto (Redondo) -->
                    <button onclick="marcarEpisodioDetalhe(${serieId},${seasonNum}, ${epNum}, this)" style="background: ${corBotao}; color: white; border: none; border-radius: 50%; width: 45px; height: 45px; font-size: 20px; font-weight: bold; cursor: pointer; transition: 0.2s;">✓</button>
                </div>

                <!-- SEÇÃO VISUAL: AVALIAR -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h4 style="font-size: 11px; color: #888; letter-spacing: 1px; margin-bottom: 10px;">AVALIAR ESTE EPISÓDIO</h4>
                    <div style="display: flex; justify-content: center; gap: 15px; font-size: 26px; color: #ffcc00;">
                        <span>☆</span><span>☆</span><span>☆</span><span>☆</span><span>☆</span>
                    </div>
                </div>

                <!-- SEÇÃO VISUAL: SENTIMENTOS -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h4 style="font-size: 11px; color: #888; letter-spacing: 1px; margin-bottom: 10px;">COMO VOCÊ SE SENTIU?</h4>
                    <div style="display: flex; justify-content: center; gap: 12px; font-size: 32px;">
                        <span>😲</span><span>😂</span><span>😭</span><span>😍</span><span>😡</span>
                    </div>
                </div>

                <h4 style="font-size: 16px; margin-bottom: 10px; font-weight: bold;">Informações do episódio</h4>
                <p style="font-size:14px; line-height:1.6; color:#ccc; text-align:justify;">${sinopse}</p>
            </div>
        `;
    } catch(e) {
        conteudo.innerHTML = '<p style="text-align:center; margin-top:50px;">Erro de conexão ao carregar o episódio.</p>';
    }
};

window.fecharDetalhesEpisodio = function() {
    document.getElementById('tela-detalhes-episodio').classList.add('escondido');
};

// Lógica para marcar/desmarcar o episódio diretamente dessa tela
window.marcarEpisodioDetalhe = function(serieId, tempNum, epNum, botao) {
    let serie = minhasSeries.find(s => s.id === serieId);
    if (!serie) return alert('Adicione a série à sua lista primeiro!');
    if (!serie.episodiosVistos) serie.episodiosVistos = [];
    
    const epId = `${tempNum}-${epNum}`;
    const index = serie.episodiosVistos.indexOf(epId);
    
    if (index > -1) {
        serie.episodiosVistos.splice(index, 1);
        botao.style.background = '#333'; // Fica cinza
    } else {
        serie.episodiosVistos.push(epId);
        botao.style.background = '#78b833'; // Fica verde
    }
    
    salvarSeries(); 
    atualizarEstatisticas(); 
    renderizarSeries(); // Atualiza a aba Minha Lista no fundo
};
