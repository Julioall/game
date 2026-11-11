# Protótipo e migração

## Estado atual

O repositório contém o protótipo executável. O mapa permite até 5.000 × 5.000 m. Há vilas, solares, castelos e grandes cidades. A câmera livre permite navegar, inspecionar o terreno, coletar madeira e pedra e construir uma cabana. A coleta e a construção persistem por configuração no navegador.

O modo experimental de travessia permite caminhar, vadear e nadar em superfícies naturais. Sua posição vale para a sessão. A integração com pontes, portas, interiores e tarefas continua nos próximos recortes. A [revisão da água e arquitetura](revisao-agua-arquitetura.md) registra contratos, limites e medições.

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

### Água e interações aquáticas

1. **Base implementada.** A hidrologia grava o tipo da água e a direção de jusante em um byte por célula. `WorldState.waterAt(x, z)` consulta a superfície recortada, profundidade e corrente relativa dentro do mapa. O shader anima os rios a jusante, usa ondulações mais lentas nos lagos e mais largas no mar. A inspeção mostra o tipo e a profundidade ao clicar na água.
2. **Travessia em teste jogável.** Use **Explorar a pé**, clique em terra firme perto de uma margem e mova o personagem com WASD, setas ou toque no destino. O estado valida cada passo a 30 Hz. O personagem vadeia a partir de 0,15 m e nada a partir de 1 m, com deriva em água corrente. O movimento confirmado pode emitir ondulações. Esc, o botão do modo e os atalhos de mapa encerram a travessia. A posição vale para a sessão e fica fora do save. A navegação considera o relevo e a água. Colisões com estruturas, pontes e busca de caminhos ficam para o recorte de navegação do personagem.
3. **Próximo recorte da água.** Definir o habitat das primeiras espécies por tipo de água, profundidade e corrente. Validar os deslocamentos em trechos conectados, inclusive nas margens e confluências, e medir o custo da atividade local.

A direção escolhida é manter a superfície visual no shader e consultar a hidrologia para decisões de jogo. Avaliar ondas de Gerstner se o mar precisar de relevo visível e PBF se uma interação local exigir movimento de volume. As duas técnicas ficam como opções de protótipo.

O acabamento em `src/render/water.js` e `src/render/materials.js` mistura a corrente visual em até três células vizinhas e combina ondas de lago e mar nas desembocaduras. O leito tinge a água rasa conforme a profundidade. A espuma segue a corrente nos rios e acompanha as ondas nas praias. A superfície externa do oceano cobre apenas a área fora do mapa para evitar sobreposição nos canais baixos.

`src/render/coast.js` combina três grupos de frentes costeiras com frequências, fases e extensão diferentes. O ruído em coordenadas globais fragmenta as frentes e desloca o momento da quebra ao longo da costa. A profundidade e a inclinação do leito orientam a aproximação. A água e a película sobre a areia compartilham a mesma função de avanço e recuo. A película usa apenas triângulos próximos do mar, fica limitada a 0,22 m acima do nível da água e permite clicar no terreno abaixo dela. A animação é procedural no shader e acompanha a preferência de movimento reduzido.

As desembocaduras fornecem trajetos visuais de corrente por 14 a 32 m dentro da água receptora, conforme a vazão. `src/world/terrain/water-flow.js` traça esses trajetos pela água disponível, contorna margens e reduz a intensidade até integrar o movimento ao lago ou mar. A consulta da apresentação usa os candidatos locais do índice por chunk, incluindo a área de espalhamento. O shader aplica o mesmo movimento à espuma e aos reflexos na transição.

A apresentação também transmite a intensidade, o avanço e a posição lateral na zona de mistura. O shader usa esses dados para formar ondulações de encontro entre a corrente e as ondas receptoras, dois giros laterais sutis e espuma de turbulência. A força decai junto com o espalhamento da corrente e fica limitada à água conectada à foz. A perturbação é um efeito procedural de superfície.

A geração de hidrologia 2 usa a cota de drenagem no eixo do rio e preserva o nível da água que o recebe. As nascentes começam rasas e estreitas e ganham largura e profundidade ao longo das primeiras 16 células. A geração descarta ramos isolados muito curtos que terminam no lago. A regra corrige as manchas na margem sem remover tributários de um canal maior. Pontes geradas exigem pelo menos 0,25 m de profundidade no eixo do rio para evitar travessias sobre o começo raso da nascente.

A hidrologia 3 dá aos canais uma lagoa de cabeceira com saída para jusante. Com o controle de lagos zerado, a geração mantém os córregos sem lagoas. Nos mapas de até 768 m, as lagoas usam a área já molhada para preservar espaço para povoados. No mapa de 5.000 m, o alargamento gradual ocorre ao longo de até 235 passos na grade, cerca de 235 a 332 m conforme a direção. O canal continua pela drenagem até outro rio, lago ou mar. Uma vazão maior pode gerar lagoa e canal mais largos. A geração de recursos favorece árvores e pedras nos primeiros 16 m ao redor da lagoa, usando as espécies do bioma e respeitando estradas, lotes e a configuração de vegetação.

A hidrologia 4 aprofunda o leito na conexão com o lago ou mar usando a faixa de influência da corrente. A profundidade diminui nas laterais e ao longo do espalhamento, produzindo uma passagem de cor mais escura. A corrente deforma as ondas da água receptora e perde influência gradualmente. As matas das nascentes recebem árvores maduras em uma segunda distribuição local, com IDs `st:`, respeitando bioma, terra firme e ocupação. As copas podem se sobrepor nessa área.

O formato do save continua na versão 1. Como o terreno e a localização dos povoados podem mudar, o jogo abre automaticamente a versão de geração mais recente com save existente, ou usa a hidrologia 4 para um mundo novo. Para comparar, acrescente `hydrology=1`, `hydrology=2`, `hydrology=3` ou `hydrology=4` à URL. Cada geração mantém progresso separado e a versão 1 conserva a chave original.

## Executar e verificar

Use Node.js 24 e um navegador com WebGL 2. Rode `npm ci` e `npm run dev -- --port 5917`. Abra [o servidor local](http://127.0.0.1:5917/). A semente 1769 abre a vila com ponte.

Use `npm test`, `npm run build`, `npm run playtest` e `npm run benchmark:placement`. O playtest usa Chrome instalado ou Edge com `KINGDOM_BROWSER=msedge`. A variável `KINGDOM_URL` permite usar um servidor já aberto. Os relatórios ficam em `playtest-output/`.
