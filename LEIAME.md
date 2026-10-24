# Estúdio Movimento — site de catálogos (vídeos e fotos) + Loja Dry Fit

Site "dois em um":
- **Produção de conteúdo:** abas **Catálogos**, **Fotos** e **Vídeos** (pacotes de vídeo/foto com modelos).
- **Loja Dry Fit:** camisas e shorts com fotos, vídeo, explicação, cor, tamanho e pedido pelo WhatsApp.
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
| `nome` | `"Estúdio Movimento"` | aparece no topo e no WhatsApp |
| `whatsapp` | `"5511999999999"` | 55 + DDD + número, só números |
| `instagram` | `"estudiomovimento"` | sem @ |
| `demonstracao` | `true` | mude para `false` para tirar a faixa "Modo demonstração" |

### Adicionar um produto (Loja Dry Fit)
Copie um produto inteiro (de `{` até `}`), cole depois dele com uma vírgula e mude:
- `id`: nome curto sem espaço nem acento (ex.: `"camisa-nova"`) — vira o link do produto.
- `tipo`: `"Camisa"` ou `"Short"` (cria os filtros sozinho).
- `preco` e `precoAntigo`: use ponto nos centavos (`59.90`). `precoAntigo: null` = sem promoção.
  Sem preço (`null`) aparece "Consulte".
- `resumo`: explicação curta que aparece **embaixo do produto**.
- `descricao` e `destaques`: aparecem ao abrir o produto.
- `cores`: nome, cor (`hex`) e a foto daquela cor.
- `video`: link do YouTube (veja abaixo). `"disponivel": false` mostra "Esgotado".

### Adicionar fotos
1. No GitHub, abra a pasta `imagens` → **Add file → Upload files** → arraste as fotos → **Commit changes**.
2. No `catalogo.json`, use o caminho: `"imagens/nome-da-foto.jpg"`.

Dicas: JPG ou WebP, até ~1600 px de largura e menos de 500 KB cada (carrega rápido no celular).
Limite do Cloudflare Pages: 25 MB por arquivo. Nomes sem espaço e sem acento.

### Adicionar vídeos (YouTube não listado)
1. No YouTube, envie o vídeo e escolha visibilidade **Não listado** (só quem tem o link vê).
2. Copie o link (`Compartilhar → Copiar`). Serve `youtu.be/...`, `youtube.com/watch?v=...` ou `youtube.com/shorts/...`.
3. Cole no campo `"youtube"` (aba Vídeos) ou `"video"` (produto/pacote).
4. `"formato": "vertical"` (Reels/Shorts) ou `"horizontal"`. Links de Shorts já viram vertical sozinhos.

Sem link, aparece "Vídeo em breve". O vídeo só carrega quando a pessoa toca (site rápido e sem cookies do YouTube antes).

### Catálogos (pacotes de vídeo e foto)
Mesmo esquema: `nome`, `categoria` (Vídeo, Foto, Combo...), `resumo`, `descricao`, `inclui` (lista),
`preco` (`null` = "Sob consulta"), `fotos` e `video`.

---

## Como o pedido funciona
O cliente monta o pedido (peças + pacotes), digita o nome e toca em **Enviar pedido pelo WhatsApp**.
Abre o WhatsApp da loja com a mensagem pronta: itens, cor, tamanho, quantidade, total e frete "a combinar".
O pedido fica salvo no aparelho do cliente até ele limpar.

## Instalar no celular
- **Android (Chrome):** aparece o aviso "Instale o app" ou o botão ⬇ no topo.
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início" (o site mostra essa dica).

## Backup e segurança dos dados
- O GitHub guarda **todas as versões** (History). Nada se perde; dá para voltar qualquer alteração.
- Para uma cópia no computador: botão **Code → Download ZIP**.
- O site não guarda dados de clientes em servidor: o pedido vai direto pelo WhatsApp.

## Mudar cores e fontes
No topo de `css/estilo.css`: `--acento` (verde-lima), `--fonte-titulo` e `--fonte-texto`.
Se mudar o nome da loja, troque também o `<title>` e as linhas `og:` do `index.html` (aparecem no Google e no WhatsApp).

## Publicação (já configurada)
Cloudflare Pages → projeto conectado a este repositório → branch `main`,
**sem comando de build**, pasta de saída `/`. Domínio próprio: Cloudflare → projeto → Custom domains.
