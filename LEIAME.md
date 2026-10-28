# Julian Carlos — vídeos e fotos com IA

Site "dois em um":
- **Vídeos e fotos com IA:** abas **Catálogo IA**, **Fotos** e **Vídeos**. O cliente escolhe **quantos vídeos e quantas fotos** quer,
  o formato de cada um, e vê o preço na hora (com desconto por quantidade).
- **Instalável no celular** (Android e iPhone) e abre mesmo sem internet (menos os vídeos).

Hospedagem: **Cloudflare Pages** (grátis), ligada a este repositório do **GitHub**.
Toda alteração salva no GitHub vai para o ar sozinha em cerca de 1 minuto.

---

## Estrutura

```
index.html              página principal
css/estilo.css          visual (cores e fontes no topo do arquivo)
js/app.js               funcionamento (não precisa mexer)
dados/catalogo.json     >>> TODO O CONTEÚDO DO SITE FICA AQUI <<<
imagens/                fotos dos produtos, pacotes e galeria
videos/                 vídeos próprios (.mp4) e capas (.jpg)
icones/                 ícone do app e do navegador
manifest.webmanifest    configuração do app instalável
sw.js                   modo offline do app
_headers                segurança e cache (Cloudflare)
```

---

## Como atualizar o site (pelo navegador, sem instalar nada)

1. Entre no repositório no GitHub.
2. Abra `dados/catalogo.json` e clique no **lápis** (Edit).
3. Altere o que precisar e clique em **Commit changes** (verde).
4. Espere ~1 minuto e recarregue o site.

> ⚠️ Regras do arquivo: textos sempre entre **aspas "assim"**, itens separados por **vírgula**,
> e **sem vírgula depois do último item** de uma lista. Se errar, o site mostra um aviso com
> o problema, e você pode desfazer no GitHub (History → voltar versão).

### Dados da loja (topo do arquivo)
| Campo | Exemplo | Observação |
|---|---|---|
| `nome` | `"Julian Carlos"` | aparece no topo e no WhatsApp |
| `whatsapp` | `"5511999999999"` | 55 + DDD + número, só números |
| `instagram` | `"juliancarlos"` | sem @ |
| `demonstracao` | `true` | mude para `false` para tirar a faixa "Modo demonstração" |

### Adicionar fotos
1. No GitHub, abra a pasta `imagens` → **Add file → Upload files** → arraste as fotos → **Commit changes**.
2. No `catalogo.json`, use o caminho: `"imagens/nome-da-foto.jpg"`.

Dicas: JPG ou WebP, até ~1600 px de largura e menos de 500 KB cada (carrega rápido no celular).
Limite do Cloudflare Pages: 25 MB por arquivo. Nomes sem espaço e sem acento.

### Adicionar vídeos próprios (.mp4) — mais simples
1. Exporte o vídeo em MP4 (H.264), de preferência com menos de 10 MB (limite do Cloudflare Pages: 25 MB por arquivo).
2. No GitHub, envie para a pasta `videos` (Add file → Upload files), junto com uma imagem de capa `.jpg`.
3. No `catalogo.json`: `"video": "videos/nome.mp4"` e `"capa": "videos/nome.jpg"` (na aba Vídeos)
   ou `"videoCapa"` (em produtos e serviços).

> Os 4 vídeos de jeans atuais são **animações de teste** (ilustração), só para ver o site funcionando.
> Troque pelos vídeos reais feitos com IA.

### Vídeos de exemplo (YouTube Shorts) — como está configurado hoje
Os 6 exemplos (3 Essencial R$ 30 e 3 Premium R$ 40) ficam em `videos` no `catalogo.json`, cada um com
título, descrição (a legenda que aparece embaixo do vídeo), `servico` (estilo/preço), `duracao` e `capa`.
Os links dos 6 Shorts (canal do Julian) já estão preenchidos. Se o campo `"video"` ficar vazio, aparece a capa com "Vídeo em breve".
Para ativar: poste como **Short não listado** (nunca "privado"), com "Permitir incorporação" ligado e
"Não é conteúdo para crianças", e cole o link em `"video"`. O vídeo toca dentro do site, com som.

### Adicionar vídeos do YouTube (não listado) — para vídeos grandes
1. No YouTube, envie o vídeo e escolha visibilidade **Não listado** (só quem tem o link vê).
2. Copie o link (`Compartilhar → Copiar`). Serve `youtu.be/...`, `youtube.com/watch?v=...` ou `youtube.com/shorts/...`.
3. Cole no campo `"video"` (aba Vídeos, produto ou serviço).
4. `"formato": "vertical"` (Reels/Shorts) ou `"horizontal"`. Links de Shorts já viram vertical sozinhos.

Sem link, aparece "Vídeo em breve". O vídeo só carrega quando a pessoa toca (site rápido e sem cookies do YouTube antes).

### Catálogo IA (vídeos e fotos vendidos por quantidade)
Cada serviço em `catalogos` tem:
- `nome`, `categoria` (Vídeos, Fotos, Pacotes...), `resumo`, `descricao`, `inclui` (lista).
- `unidade` / `unidadePlural`: ex. `"vídeo"` / `"vídeos"` (aparece em "10 vídeos = R$ ...").
- `preco`: preço de **cada** unidade (`null` = valor combinado no atendimento).
- `faixas`: desconto por quantidade. Ex.: `{ "aPartirDe": 10, "preco": 39.90 }` = com 10 ou mais, cada um sai por R$ 39,90.
  O desconto soma todas as linhas do mesmo serviço no pedido (ex.: 5 verticais + 5 quadrados = 10).
- `quantidades`: botões de atalho (ex.: `[1, 3, 5, 10, 20]`). O cliente também pode digitar qualquer número.
- `opcoes`: escolha de formato (ex.: Vertical 9:16, Quadrado 1:1). Use `null` para não ter escolha.
- `fotos`, `video`, `videoCapa`, `videoFormato` (`"vertical"` ou `"horizontal"`).

### Textos do topo e "Como funciona"
Ficam em `textos` (no `catalogo.json`): título, destaque em verde, passos do "Como funciona" e o aviso sobre IA.

---

## Como o pedido funciona
O cliente escolhe quantos vídeos/fotos (e/ou peças da loja), digita o nome e toca em **Enviar pedido e pedir o Pix**.
Abre o WhatsApp do Julian (+55 83 99107-0515) com um **relatório pronto**: código do pedido (ex.: #JC2410-1532-K7),
data e hora, dados do cliente, cada item numerado (formato, quantidade × preço, valor), subtotais, total,
desconto por quantidade já aplicado, frete "a combinar" (só da loja) e o pedido da **chave Pix** para pagamento.
O número fica em `dados/catalogo.json` → `loja.whatsapp` (só números, com 55 + DDD).
O pedido fica salvo no aparelho do cliente até ele limpar.

## Sem endereço
O trabalho é 100% digital: o site não mostra endereço nem cidade (`loja.cidade` vazio).

## Zoom
O zoom com dois dedos e o duplo toque estão desligados de propósito (site se comporta como app).

## Instalar no celular
- **Android (Chrome):** aparece o aviso "Instale o app" ou o botão ⬇ no topo.
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início" (o site mostra essa dica).

## Backup e segurança dos dados
- O GitHub guarda **todas as versões** (History). Nada se perde; dá para voltar qualquer alteração.
- Para uma cópia no computador: botão **Code → Download ZIP**.
- O site não guarda dados de clientes em servidor: o pedido vai direto pelo WhatsApp.

## Logo
Símbolo "JC" (C em anel verde-lima + J + brilho de IA) e nome em Barlow Condensed.
Arquivos no site: `icones/` (ícone do app e da aba) e `imagens/logo/` (versões horizontal clara/escura e vertical).
`imagens/og-imagem.png` é a imagem que aparece quando o link é compartilhado no WhatsApp.
O kit completo (PNG e SVG, foto de perfil 1080 px) fica na pasta `logo-julian-carlos`.

## Mudar cores e fontes
No topo de `css/estilo.css`: `--acento` (verde-lima), `--fonte-titulo` e `--fonte-texto`.
Se mudar o nome da loja, troque também o `<title>` e as linhas `og:` do `index.html` (aparecem no Google e no WhatsApp).

## Publicação (já configurada)
Cloudflare Pages → projeto conectado a este repositório → branch `main`,
**sem comando de build**, pasta de saída `/`. Domínio próprio: Cloudflare → projeto → Custom domains.
