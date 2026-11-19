# Pixel Art + otimização de grama + neblina leve

Esta alteração acrescenta um **perfil selecionável de Pixel Art** ao renderizador Three.js. A cena já tinha um `PixelArtPass`, mas usava supersampling na maior parte do tempo e o efeito de pixelização era pouco aparente.

## Como utilizar

No painel **Diagnóstico**, o campo **Efeito visual** permite mudar em tempo real:

| Perfil | Resolução interna (janela de 1200×800) | Quantização da paleta | Comportamento |
| --- | --- | --- | --- |
| Sem filtro | Resolucão dinâmica normal | Não | Render direto, sem segundo passe |
| Pixel Art | 600×400 | Paleta fixa de 32 cores | Grade de pixels + dithering moderado + contornos seletivos |
| Pixel Art forte | 400×267 | Mesma paleta fixa de 32 cores | Pixels maiores + dithering reforçado |

O padrão é **Pixel Art**. A redução de resolução é aplicada somente ao mundo 3D. HUD, texto e minimapa continuam em DOM/canvas separado e não sofrem redução de resolução. O CSS existente do canvas usa `image-rendering: pixelated`, evitando blur na ampliação.

O alvo gráfico e o material de pós-processamento são reutilizados ao trocar de modo; não há criação de texturas por quadro. Os modos de Pixel Art usam menos pixels internos, **mas ganho de FPS precisa ser medido no navegador**.

## Grama

Os três tipos de grass do gerador são reduzidos na origem, antes de montar as instâncias:

- Grama compactada em `grassPlacements`.
- Grama principal dos plots.
- Touceiras extras.

Um hash de coordenadas conserva cada candidato com probabilidade de 0,3, de forma estável independentemente do chunk ou da câmera. Árvores, pedras, arbustos, flores, juncos e plantações não passam por esse filtro. O efeito esperado é **aproximadamente 70% menos grama**, não uma contagem fixa por chunk.

## Neblina

A câmera superior agora aplica aproximadamente 30% da intensidade anterior da neblina linear nas distâncias relevantes. Mantém `near=250` e estende `far` de 403 para 760. A câmera de primeira pessoa continua em 403. Esse ajuste precisa ser conferido visualmente com o céu procedural da v24.

## Situação da integração

**Esta branch parte da PR #3 do GitHub, não do ZIP local `Word-ceu-v24.zip`.** As correções de cache, pré-carregamento, hidrologia v22 e céu que existem apenas no ZIP devem ser reconciliadas antes de publicar uma nova distribuição. Não usar a branch diretamente como substituta da v24.

Não houve execução de `npm test`, `npm run build` ou testes WebGL nesta sessão por indisponibilidade do ambiente local de arquivos/execução. Os testes adicionados em `test/pixel-art-style.test.js` estão prontos para executar após a integração.

## Paleta harmônica: Vale de Âmbar

Em vez de reduzir cada canal RGB isoladamente, a cena utiliza uma **paleta compartilhada de 32 cores**, em cinco rampas coerentes. Essa decisão impede que um verde de floresta, um azul de rio e uma sombra de pedra pareçam pertencer a estilos gráficos diferentes.

| Rampa | Tons escuros → claros | Uso |
| --- | --- | --- |
| Neutros | `#17242b` → `#ede5c8` | Sombras, pedra, névoa |
| Folhagem | `#244a43` → `#b5bd80` | Gramíneas, musgo, copas |
| Água e céu | `#334c6b` → `#dae1d8` | Rios, lagos, céu e horizonte |
| Terra | `#534439` → `#eed2a0` | Barro, madeira e luz solar |
| Argila | `#624351` → `#f0d6b5` | Telhados e detalhes quentes |

A correspondência de cor é pré-calculada no espaço perceptual OKLab, formando uma textura de consulta RGBA de 256×16 (16 KiB). A GPU usa uma única leitura adicional dessa tabela por pixel, em vez de comparar 32 cores a cada fragmento. Essa tabela é criada apenas uma vez e reutilizada entre sessões de cena.

### Princípios do guia *Pixel-Logic* (prévia gratuita de Michael Azzi)

Usamos **orientações gerais**, sem reproduzir ilustrações ou trechos do livro:

1. **Grade consistente:** baixa resolução interna e amostragem por vizinho mais próximo, sem borrão de interpolação. Referência: capítulo introdutório sobre proporções e escalonamento, páginas 19–21.
2. **Leitura das silhuetas:** contornos finos somente nas descontinuidades de profundidade, sem bordas pretas grossas em toda a geometria. Referência: introdução às linhas e espessura, páginas 23–24.
3. **Contorno seletivo:** escurecer localmente a própria cor da superfície, respeitando luz e material. Referência: tipos de contorno, páginas 30–35.
4. **Cores organizadas por material e luminosidade:** as 32 cores compartilham sombras e highlights compatíveis entre água, folhas, terra e céu.
5. **Dithering com parcimônia:** padrão Bayer 4×4 discreto, fixado à grade de pixels. O modo forte usa apenas uma intensidade um pouco maior, sem ruído animado.

**Limitação:** uma paleta aplicada em pós-processamento cria uma estética coerente, mas não substitui texturas e sprites desenhados manualmente. Não afirmar que todos os objetos já têm acabamento de pixel art artesanal.

### Compatibilidade e desempenho

A v24 local com céu procedural, cache e hidrologia não está publicada nesta branch. O PR #4 continua sendo um patch técnico. Integrar apenas os arquivos/modificações pertinentes sobre a v24, sem sobrescrever `src/render/view.js` nem `src/main.js` inteiros. Essas duas classes contêm alterações locais necessárias. O build Vite e o teste gráfico continuam obrigatórios antes de distribuir ZIP como versão estável.
