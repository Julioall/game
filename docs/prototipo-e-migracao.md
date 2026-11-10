# Protótipo e migração

## Estado atual

O repositório contém o protótipo executável. O mapa permite até 5.000 × 5.000 m. Há vilas, solares, castelos e grandes cidades. A câmera livre permite navegar, inspecionar o terreno, coletar madeira e pedra e construir uma cabana. A coleta e a construção persistem por configuração no navegador.

| Área | Implementação |
| --- | --- |
| Terreno e água | `src/world/terrain/` separa relevo, hidrologia, drenagem e validação de solo. `src/world/generate.js` orquestra a geração. `src/render/terrain.js` gera a malha do terreno e `src/render/water.js` recorta a água nos mesmos triângulos. |
| Vegetação e árvores | `src/world/ecology.js` classifica biomas. `src/world/vegetation.js` gera recursos e plantas por chunk, com IDs derivados da semente e das coordenadas globais. `src/render/vegetation.js` monta os modelos e as instâncias. A coleta resolve o alvo no mundo pelo ID. |
| Construções | `src/world/construction.js` valida lotes com índices locais e `src/world/buildings.js` fornece dimensões, fundação e referência de entrada das casas. `src/render/structures.js` compõe a malha de construções com os módulos de casas, pontes e fortificações. |
| Estado e apresentação | `src/world/state.js` aplica coleta e construção, mantém os deltas e fornece consultas de leitura para a visualização. `src/render/view.js` cuida da câmera, chunks visíveis e seleção. `src/main.js` conecta interface, plataforma e regras. |
| Plataforma | `src/platform/world-worker.js` gera e transfere o mundo, depois encerra. `src/platform/local-save.js` usa a mesma chave e o mesmo formato de save do protótipo de origem. |
| Testes e pesquisa | `test/world.test.js` cobre geração, ocupação e persistência. `tools/playtest.mjs` percorre o jogo no navegador. [Pesquisa e atribuições](pesquisa.md) registra referências e licenças. |

A importação preservou o protótipo em um commit próprio. Os commits seguintes organizaram, em ordem, terreno e água, vegetação e árvores, e construções. O índice das construções considera a área de influência em mais de um chunk e aplica a mesma geometria de ocupação do protótipo. A planta inicial das casas fornece medidas e posição de entrada. Portas jogáveis e navegação interior são o próximo recorte.

O índice de povoados expõe apenas consultas e devolve registros imutáveis separados dos dados de origem. A apresentação consulta as células da grade por índice, sem acesso aos buffers usados pela simulação. A projeção copia apenas os metadados necessários à interface. Ao carregar um save da versão atual, o estado preserva registros válidos, ignora construções inválidas e zera saldos que não sejam inteiros seguros e não negativos. Saves ilegíveis ou de versão desconhecida iniciam um estado vazio.

## Próximas etapas

1. **Cabana habitável.** Adicionar personagem, superfícies navegáveis, porta e visibilidade do telhado a partir da planta da cabana. Validar entrada, saída, alcance e persistência.
2. **Tarefa autônoma.** Introduzir coleta com deslocamento, reserva e cancelamento. Usar as mesmas regras de coleta para o jogador e os habitantes.
3. **Escala de simulação.** Medir tempo por sistema, custo de navegação e quantidade de entidades ativas antes de escolher ECS completo ou um Worker de simulação. Usar os [critérios de validação](validacao.md).

Uma mudança de ID, versão de geração ou esquema de save exige plano de compatibilidade e teste de saves anteriores.

## Executar e verificar

Use Node.js 24 e um navegador com WebGL 2. Rode `npm ci` e `npm run dev -- --port 5917`. Abra [o servidor local](http://127.0.0.1:5917/). A semente 1769 abre a vila com ponte.

Use `npm test`, `npm run build`, `npm run playtest` e `npm run benchmark:placement`. O playtest usa Chrome instalado ou Edge com `KINGDOM_BROWSER=msedge`. A variável `KINGDOM_URL` permite usar um servidor já aberto. Os relatórios ficam em `playtest-output/`.
