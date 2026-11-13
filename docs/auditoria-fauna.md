# Auditoria da fauna e organização atual

## Responsabilidades

| Módulo | Responsabilidade |
| --- | --- |
| `src/world/fauna-catalog.js` | 24 espécies, pesos de habitat e parâmetros de movimento. |
| `src/world/fauna.js` | Geração determinística, cotas, habitat aquático e índice por chunk. |
| `src/world/fauna-motion.js` | Passo de deslocamento, pausa e desvio, sem Three.js. |
| `src/world/fauna-system.js` | Estado de sessão, agenda de 10 Hz, ativação regional, ocupação e atualização do índice móvel. |
| `src/world/state.js` | Dono do sistema; fornece consultas destacadas e confirma os ticks. |
| `src/render/fauna.js` | Criação/descarte, seleção visível, qualidade e aplicação de animação. |
| `src/render/view.js` | Câmera, streaming, terreno, água e composição dos passes de apresentação. |

A simulação não depende de um animal ter terminado de carregar. Modelos descartados não apagam posições, e mudanças de chunk atualizam o índice autoritativo. A apresentação recebe cópias de leitura. A ocupação consulta árvores/pedras em células de 8 m, construções e estradas por chunks, incluindo coletas e novas cabanas.

A atividade ambiente usa a região do jogador ou foco de exploração. Fora dessa região os animais ficam adormecidos, sem liquidar necessidades. Isso é o escopo atual do protótipo; hábitos com consequências deverão usar prazos e regras de ativação próprios. O estado de fauna ainda é apenas de sessão; o save continua na versão 1. IDs, sementes do mundo e esquema existente foram preservados.

## Recursos do pacote

Motor fixado em `c95ae49346aa8e140a924376cec6cf0073d99512`; licença e origem em [avisos de terceiros](../THIRD_PARTY_NOTICES.md). `npm run audit:fauna` constrói as 24 espécies sem WebGL, consulta ações, marchas e attachments, exercita movimento/parada e uma ação por espécie. O relatório local fica em `playtest-output/fauna-library-audit.json`. O comando não valida visualmente todas as ações nem os efeitos específicos de cada anatomia.

O adaptador encaminha movimento com velocidade para `follow`, usa `move({speed:0})` para preservar idle nativo e aplica `play/stopAction` apenas nas transições. As ações aceitam alvos/direções e opções de loop/velocidade, com revisão para repetir o mesmo nome. Só ações oferecidas por `animal.actions` são executadas. O estado atual produz caminhada e idle; ações de hábitos dependem de regras futuras.

| Recurso | Estado |
| --- | --- |
| Construção procedural, rig, IK, cobertura e marchas | Motor original preservado; low e LOD 2 no visual atual. |
| Ações básicas e especiais | Inventariadas nas 24 espécies; ponte de apresentação disponível. |
| Voo, pouso e poleiros | Disponíveis para aves no motor; navegação aérea e locais de pouso ainda não implementados no jogo. |
| Eventos (`footstep`, `attackHit`, `actionStart`, etc.) | API preservada no pacote; consumidores de áudio/efeitos e confirmação de combate pendentes. |
| Attachments (boca, cabeça, sela, etc.) | Disponíveis nos modelos; equipamento e montaria pendentes. |
| Variação de sexo, idade e aparência | Motor suporta; apresentação reutiliza duas aparências por espécie. Sementes individuais permanecem no domínio. |
| Bake e atlas | API e ferramenta do motor disponíveis; ZIP não trouxe atlas pronto. Pipeline offline ainda pendente. |
| Água | Tubarões no mar e peixes em lagoas de nascente, validados no spawn e deslocamento. |

## Inventário confirmado

Ações básicas recorrentes: idle, jump, sit, lie, sleep, eat, drink, attack, hit, death e stand. A lista efetiva deve ser consultada por espécie; nomes disponíveis não substituem as regras de jogo.

| Espécie | Plano | Marchas | Ações adicionais |
| --- | --- | --- | --- |
| wolf | quadruped | walk, trot, canter, gallop | — |
| fox | quadruped | walk, trot, canter, gallop | pounce, listen |
| deer | quadruped | walk, trot, gallop, bound | stomp, alert, flee |
| boar | quadruped | walk, trot, gallop | sniff, grunt, headshake |
| horse | quadruped | walk, trot, canter, gallop | — |
| cow | quadruped | walk, trot, canter, gallop | lick, chew, moo, swish, shake |
| sheep | quadruped | walk, trot, canter, gallop | alert, bleat, headshake, stamp, pronk |
| goat | quadruped | walk, trot, gallop | browse, bleat, headshake, paw |
| rabbit | quadruped | shuffle, halfbound, bound | hop, binky, groom, periscope, thump, flee |
| bear | quadruped | walk, amble, canter, gallop | standup, sniff, dig |
| chicken | bird | walk, run, fly | takeoff, land, perch, glide, flap |
| dog | quadruped | walk, trot, canter, gallop | greet, playbow, sniff, dig |
| pig | quadruped | walk, trot, gallop | wallow, grunt, sniff, root, frolic |
| cat | quadruped | walk, trot, bound, gallop | loaf, groom, knead, stalk, slowblink |
| rat | quadruped | walk, trot, gallop, halfbound, bound | rear, groom, scurry, box |
| frog | quadruped | crawl, hop | hop, croak, blink |
| snake | snake | crawl, slither, dash | coil, strike |
| spider | spider | walk, run | — |
| crow | bird | walk, hop, fly | takeoff, land, perch, glide, flap |
| eagle | bird | walk, hop, run, fly | takeoff, land, perch, glide, flap |
| lion | quadruped | walk, trot, gallop | roar, yawn |
| cheetah | quadruped | walk, trot, canter, gallop, sprint | — |
| fish | swimmer | scull, cruise, sprint | burst |
| shark | swimmer | patrol, cruise, sprint | burst |

## Próximos recortes para inteligência e hábitos

1. Definir perfis por espécie (dieta, horários, sociabilidade e ameaças) como dados de domínio.
2. Adicionar necessidades e seleção de tarefas (descansar, procurar alimento, beber), com alvos validados e reserva/cancelamento no estado.
3. Aplicar navegação conectada e percepção local; acrescentar separação entre animais e reações a ameaças. O desvio atual é local e não garante alcançar destinos.
4. Ligar tarefas confirmadas a ações de animação; eventos de animação orientam efeitos, nunca concedem alimento ou dano diretamente.
5. Definir agenda distante, reprodução e migração versionada dos saves quando essas regras entrarem.
6. Medir novamente antes de decidir ECS, Worker persistente ou atlas.

## Validação e limites conhecidos

- `npm test`: testes de domínio, compatibilidade de saves, habitat, passo fixo, cópias de leitura e encaminhamento de ações.
- `npm run build`: produção compila; aviso de chunk principal acima de 500 kB continua presente.
- `npm run audit:fauna`: 24 modelos construídos; zero falhas e nenhuma espécie do pacote ausente.
- `npm run playtest`: mapa 1024, coleta/construção, save/recarga, travessia, câmera em primeira pessoa, estresse e mobile emulado.
- Microamostra Node no mapa 1024, semente 1769: 30 ticks com 42 animais locais em aproximadamente 32 ms no total; 1.830 candidatos de fauna e 31.881 candidatos de obstáculos, com 20.475 testes geométricos. É uma amostra local, não meta garantida.
- O primeiro carregamento dos modelos ainda pode causar picos e queda de FPS; a criação tem no máximo dois trabalhos pendentes, sem limitar o total de animais visíveis. Antes da consulta por células de 8 m, o playtest observou cerca de 23 FPS na vista ampla durante construção. Na rodada final, mediu aproximadamente 141 FPS na vila, 83 FPS na vista ampla e 133 FPS durante navegação; falta medir hardware integrado e modelos pré-construídos.
- Praia é apresentação (areia/vegetação visível), sem modificação de relevo ou recursos autoritativos. O modo de câmera em primeira pessoa ainda não tem colisão física com construções.
