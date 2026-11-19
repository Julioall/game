# Pixel Art + otimização de grama + neblina leve

Esta alteração acrescenta um **perfil selecionável de Pixel Art** ao renderizador Three.js. A cena já tinha um `PixelArtPass`, mas usava supersampling na maior parte do tempo e o efeito de pixelização era pouco aparente.

## Como utilizar

No painel **Diagnóstico**, o campo **Efeito visual** permite mudar em tempo real:

| Perfil | Resolução interna (janela de 1200×800) | Quantização da paleta | Comportamento |
| --- | --- | --- | --- |
| Sem filtro | Resolucão dinâmica normal | Não | Render direto, sem segundo passe |
| Pixel Art | 600×400 | 15/17/15 níveis RGB | Grade de pixels + dithering + bordas discretas |
| Pixel Art forte | 400×267 | 9/11/9 níveis RGB | Pixels maiores + paleta mais contida |

O padrão é **Pixel Art**. HUD, texto e minimapa continuam em DOM/canvas separado e não sofrem redução de resolução. O CSS existente do canvas usa `image-rendering: pixelated`, evitando blur na ampliação.

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
