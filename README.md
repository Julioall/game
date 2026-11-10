# O jogo

Jogo de simulação medieval em que você vive como um personagem, convive com habitantes autônomos e pode chegar a administrar um povoado ou liderar um reino. As três escalas compartilham o mesmo mundo, seus habitantes e as consequências das decisões.

O repositório contém o protótipo navegável e a documentação de design e engenharia. O protótipo permite explorar o mapa, coletar recursos e construir uma cabana.

## Executar

Use Node.js 24 e um navegador com WebGL 2.

```sh
npm ci
npm run dev
```

Abra o endereço mostrado no terminal. Para verificar, use `npm test`, `npm run build`, `npm run playtest` e `npm run benchmark:placement`.

## Comece aqui

| Documento | O que contém |
| --- | --- |
| [GDD](docs/gdd.md) | Experiência do jogador, inspirações, sistemas e primeiro recorte jogável |
| [Arquitetura-alvo](docs/arquitetura-alvo.md) | Limites dos módulos, contratos e decisões sobre ECS, eventos e simulação |
| [Protótipo e migração](docs/prototipo-e-migracao.md) | Estrutura do código, migração concluída e próximo recorte jogável |
| [Validação e desempenho](docs/validacao.md) | Linha de base, cenários, métricas e critérios de aceitação |
| [AGENTS.md](AGENTS.md) | Orientações de trabalho para quem der continuidade ao projeto |

As propostas estão identificadas como tais. O estado do protótipo e os comandos de execução local ficam no guia de migração.
