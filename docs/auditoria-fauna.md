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
| Bake e atlas | API e ferramenta do motor disponíveis; ZIP não trouxe atlas pronto. 48 malhas low pré-geradas, duas sementes por espécie, disponíveis em public/fauna; atlas de sprites continua pendente. |
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


## Revisão de carregamento e estabilidade visual

A criação de modelos só dentro do enquadramento, a fila vinculada à consulta
espacial de 450 ms e o descarte no mesmo limite causavam atrasos e recriações
junto às bordas. O carregamento assíncrono também podia terminar com uma posição
antiga, especialmente quando o animal já estava parado no estado autoritativo.

Implementação atual:

- `src/render/fauna.js` antecipa a importação da biblioteca durante a geração do
  terreno. A fila inicia no máximo um trabalho por quadro, reutiliza vagas sem
  esperar a próxima consulta e conserva o limite de dois trabalhos pendentes.
- A seleção usa uma margem projetada de 1,4 para preparar modelos e 1,8 para
  conservar os existentes. A consulta radial tem folga de pelo menos 12 m ou
  25% do raio, com descarte fora da região. A prioridade é a fauna enquadrada.
- Ao terminar o carregamento, o modelo recebe a posição atual do estado. Idle
  continua nativo e também acompanha a posição autoritativa, sem follow com
  velocidade zero. A simulação não depende do carregamento visual.
- `src/render/fauna-appearance.js` faz uma entrada por descarte ordenado de
  fragmentos durante 0,3 s, preservando teste de profundidade e os materiais do
  motor. O relógio dessa transição independe do dt da animação, inclusive com
  movimento reduzido. Não são criados materiais transparentes adicionais.
- A tela inicial espera os modelos enquadrados, com prazo máximo de três
  segundos após criar a visualização. Falhas não bloqueiam a abertura do mapa.

### Malhas preparadas antes da execução

`npm run prepare:fauna` gera 48 arquivos compactados e um manifesto em
`public/fauna/`, usando exatamente low e sementes 1769/1770, já empregadas pelo
renderer. O conjunto ocupa aproximadamente 37,3 MiB. São recursos distribuídos
com o jogo, e não um cache temporário. Não entram no bundle JavaScript inicial.

`src/render/fauna-assets.js` baixa e descompacta apenas as aparências necessárias,
reutilizando a mesma promessa e buffer por aparência durante a sessão. Aceita
servidores que já descompactam Content-Encoding e servidores que entregam gzip
bruto. O cabeçalho PANM é conferido antes de usar o bake. Se faltar o arquivo ou
houver falha de leitura, a criação procedural continua como fallback. O cache de
buffers tem no máximo as 48 aparências deste perfil e pode elevar a memória
retida entre regenerações de mundo; ainda falta medir em dispositivos móveis.

`src/render/fauna-species.js` usa as 24 entradas públicas species da dependência,
evita depender de chunks internos antigos do otimizador de desenvolvimento e
reutiliza a promessa por espécie. O motor continua com sua revisão fixada e os
mesmos rigs, ações, qualidade e sementes. Não há nova dependência nem mudança
em IDs, comportamento, população ou save.

### Verificações desta revisão

- `npm test`: 39 testes passaram. Incluem limite de concorrência, avanço da fila
  entre consultas, preparação fora da tela, retenção nas bordas, descarte de
  trabalhos cancelados, sincronização após carregamento, chegada com dt zero,
  cache de download, gzip bruto/já decodificado e fallback.
- `npm run build`: passou; o aviso de tamanho do bundle inicial permanece.
- `npm run audit:fauna`: 24 espécies, zero falhas e nenhuma ausente.
- `npm run check:fauna-bakes`: verifica os 48 arquivos, hashes, sementes,
  geometria, movimento e descarte sem WebGL.
- Navegador em 5917, semente 1769: abertura inicial, cinco passos de afastamento
  e alternância de aproximação/afastamento conferidos com capturas. Na vista
  ampla foram carregadas 31 aparências pré-geradas sem falhas de arquivo ou de
  modelo após corrigir o carregamento das espécies. A configuração temporária
  de cache usada no diagnóstico foi restaurada.

Não foi feita comparação estatística antes/depois. Primeiro download, criação
dos objetos de render e compilação de shaders ainda têm custo. Teletransportes
para regiões não visitadas podem exigir novos downloads; a antecipação e a
entrada curta reduzem o aparecimento abrupto, sem garantir ausência de atraso
em rede lenta. Atlas e instanciamento de animais continuam fora deste recorte.

## Otimização de CPU no zoom amplo

O perfil de CPU no navegador apontou atualização/pose de animais, matrizes e
solução de pernas entre os maiores consumidores. O renderer do pacote desativa
frustumCulled em partes dos animais; conservar modelos de antecipação dentro da
cena mantinha travessia de ossos e submissões mesmo quando estavam fora da tela.

O adaptador agora conserva o modelo carregado, mas o retira da cena sem descarte
fora de uma margem projetada de 1,15, recolocando-o a partir de 1,08. Isso evita
trabalho na árvore de render e recriação dos modelos. Ao retornar, a pose recebe
imediatamente o estado atual. O índice e a simulação autoritativa não mudam.

A apresentação acumula dt e atualiza a animação no máximo a 30 Hz com span de
66 m ou mais, e no máximo a 60 Hz de perto/primeira pessoa. O render continua
livre para apresentar mais quadros. A acumulação conserva o tempo de animação;
ela não altera os ticks de simulação, IDs, saves, resolução ou geometrias. A
cadência pode ficar um pouco abaixo do teto conforme a duração dos quadros.

O diagnóstico informa a média móvel de CPU do adaptador de fauna e quantos
modelos fora da tela estão em espera. Essa medição exclui tempo assíncrono de
download, criação de modelos e custo de GPU; não representa o custo total da fauna.

Verificação: 41 testes aprovados, incluindo retirada da cena sem descarte,
retorno com posição atual, limite de cadência e conservação de dt. Build e
inspeção visual do zoom amplo passaram, sem erros no console. A amostra final
na vila da semente 1769, janela 871 × 711, resolução interna 1307 × 1067,
registrou 117 FPS, p95 de 14 ms, 550 chamadas, 52 modelos carregados e 18 em
espera fora da cena, com média de CPU do adaptador de 1,34 ms. O carregamento
já estava sem trabalhos pendentes. Não é garantia de 144 FPS.

Antes da alteração, a vista aberta pelo usuário apresentou 62 FPS e p95 de
21,1 ms, mas com outro foco (61 chunks e 66 modelos); portanto esses números
não constituem comparação controlada. Não há benchmark repetido no mesmo
foco e população nem medição em dispositivo móvel nesta rodada. Alterações
contemporâneas da água também impedem atribuir todo ganho exclusivamente à fauna.

## Distribuição de animação e partes distantes

A revisão atual usa fases com hash do ID para distribuir trabalho entre quadros,
60 Hz de perto, 30 Hz no mapa amplo e 20 Hz apenas para espécies pequenas
afastadas do foco com span a partir de 90 m. As camadas de cobertura do pacote
são desligadas abaixo de 16 pixels CSS estimados no mapa amplo e retornam
de perto. Corpos, olhos, rigs e estado autoritativo permanecem. A acumulação
conserva tempo de animação. A [comparação de render](otimizacao-render.md) registra
condições, números e os 47 testes desta revisão.
