# Validação e desempenho

A [revisão da água e arquitetura](revisao-agua-arquitetura.md) reúne a auditoria e as medições consolidadas mais recentes, incluindo limites de memória e os comandos de reprodução. Os registros abaixo também conservam medições das etapas anteriores.

## Linha de base conhecida

Após a migração, nove testes passaram. O teste no navegador mede geração e renderização, incluindo FPS, tempo de quadro e streaming. A revisão posterior acrescentou um microbenchmark de travessia. A simulação populacional integrada ainda precisa de uma carga representativa.

Execute `npm run benchmark:placement` para repetir a consulta sintética. São sete rodadas de 1.024 consultas em um mapa de 768 m com semente 1769. No Node 24.19.0, em um Intel i3-10105, as medianas anteriores foram 18,72, 49,74 e 313,03 ms com zero, mil e dez mil construções distantes. Após a migração foram 16,95, 16,27 e 15,99 ms, respectivamente. A preparação do índice com dez mil construções levou 7,61 ms nessa execução. São medições de consulta de lote em uma máquina.

A migração também comparou 60.690 decisões de ocupação com o protótipo importado, incluindo bordas de defesas, sem divergências. Em duas sementes de referência, os dados gerados e as malhas amostradas de terreno, água e estruturas tiveram a mesma assinatura do protótipo importado. No Chrome, a versão de produção gerou um mapa de 5.000 × 5.000 m e carregou os chunks da borda sudeste sem erro.

## Verificação da água

`npm test` passou com 11 testes, incluindo profundidade na margem e corrente na geração compacta. `npm run build` e `npm run playtest` passaram. O playtest verifica a inspeção do lago na semente 1769 e inclui um perfil móvel emulado. No Chrome com Intel UHD 770, o p95 ficou em cerca de 16,8 ms antes e depois, com 309 chamadas de desenho na vila e 557 na vista ampla da semente 9057. Na semente 9057 a geração mediu 601 ms antes e 757 a 846 ms depois, em poucas execuções. Falta medir a variação em mais execuções e em dispositivos móveis reais.

Um teste adicional no Chrome abriu a semente 1769 com 5.000 × 5.000 m e confirmou a consulta do mar e o carregamento dos chunks na borda sudeste sem erros. O campo de tipo e corrente acrescenta cerca de 25 MB à grade nesse tamanho.

Para a travessia, `npm test` cobre entrada e saída pelo raso, deriva, limite do mapa e preservação do save. O cenário `npm run playtest` entra na água com WASD na semente 1769, volta à margem por clique, confirma o retorno ao modo mapa e registra `playtest-output/travessia.png`.

Na revisão visual, `npm test` passou com 13 testes. O build e o playtest no Chrome também passaram. A inspeção visual na semente 1769 cobriu rio com lago (82, 144), rio com mar (240, 67), praia (155, 230) e a borda leste. Com Intel UHD 770, o p95 ficou entre 16,8 e 16,9 ms nas cenas medidas. O maior lote de chunks no cenário de estresse subiu de 27 para 44 ms nessa comparação. Falta repetir essa medição em mais execuções e em dispositivos móveis reais.

Para a hidrologia 2, `npm test` passou com 15 testes, incluindo cotas das desembocaduras e comparação da assinatura dos dados de água e terreno com a hidrologia anterior. `npm run build` e `npm run playtest` passaram. Na semente 454 com 5.000 × 5.000 m, a geração revisada manteve 79 entradas de rio em lagos. Nenhuma ficou abaixo do lago ou veio de um ramo de até 12 células. No Chrome, o ponto (2513, 2784) ficou com aproximadamente 3,5 cm de profundidade e duas manchas na margem do lago desapareceram. A troca explícita para a geração nova deixou intacto um save com progresso na geração anterior. Falta medir o custo de geração em mais execuções do mapa máximo.

Na hidrologia 3, `npm test` passou com 17 testes e `npm run build` e `npm run playtest` passaram. Os testes cobrem lagoas conectadas às saídas, recursos das matas de nascente e as assinaturas de terreno das gerações 1 e 2. No Chrome, a semente 454 com 5.000 m apresentou 413 lagoas de cabeceira e zero rios quebrados. Em (2513, 2784), a lagoa teve aproximadamente 0,34 m de profundidade e a saída 0,10 m. Foram encontrados 41 árvores e 19 rochas nos 16 m ao redor desse ponto. No canal iniciado em (2474, 458), o alargamento foi verificado ao longo de 235 passos de drenagem, cerca de 278,5 m, até (2710, 451). As capturas ficam em `playtest-output/lagoa-nascente.png` e `playtest-output/corrego-nascente.png`. A comparação de desempenho da geração máxima ainda precisa de mais execuções.

## Matriz de verificação

O refinamento da mistura das águas foi conferido no Chrome na configuração da semente 454, mapa de 1.024 m, relevo 1, água 0,12, rios 0,19, lagos 0,2 e detalhe crisp. Em (686, 70), duas fases da animação e uma gravação de aproximadamente 4,8 s registraram espuma fragmentada e giros laterais com posição variável. O p95 amostrado foi 16,9 ms. Os arquivos ficam em `playtest-output/foz-refinada-454.png` e `playtest-output/foz-refinada-454.webm`.

A zona de mistura das desembocaduras passou nos 19 testes, no build e no playtest do Chrome. A verificação inclui intensidade de mistura mesmo quando a corrente local já é forte e bloqueio do efeito por terra. Foram conferidos os encontros com lago em (82, 144) e mar em (240, 67), semente 1769, com capturas em fases distintas e gravações de aproximadamente 4,8 s em `playtest-output/mistura-lago.webm` e `playtest-output/mistura-mar.webm`. Na Intel UHD 770, o p95 ficou entre 16,8 e 16,9 ms nas cenas de referência, com a mesma quantidade de chamadas de desenho nas vistas fixas. São amostras de uma execução por versão.

A revisão das ondas costeiras passou em `npm test` com 19 testes, no build e em `npm run playtest`. A comparação na Intel UHD 770 manteve p95 próximo de 16,8 ms nas cenas de referência. Na vila, as chamadas de desenho passaram de 402 para 403 e foram adicionados 94 triângulos para a película na areia. O maior lote de chunks no cenário de estresse mediu 24,5 ms antes e 32,4 ms depois nessa execução. Essa comparação cobre poucas execuções em um desktop. A avaliação em dispositivos móveis reais continua pendente. As capturas em fases distintas ficam em `playtest-output/praia-frentes-0.png`, `playtest-output/praia-frentes-1.png` e `playtest-output/praia-frentes-2.png`.

A conferência adicional incluiu uma tela de 390 × 844 e o litoral da semente 454 com 5.000 m, em (600, 227,55). No mapa máximo, o p95 amostrado nessa costa ficou em 16,8 ms, com 242 chamadas de desenho, sem erros no navegador. As capturas ficam em `playtest-output/praia-frentes-mobile.png` e `playtest-output/praia-frentes-5000.png`.

A hidrologia 4 passou em `npm test` com 19 testes, no build e no playtest do Chrome. Os testes cobrem aprofundamento restrito à água, preservação da linha d'água e coleta única das árvores adicionais após recarga de save. Na semente 1769, o ponto (80, 146) junto à foz passou de aproximadamente 0,73 m para 1,71 m de profundidade. Na semente 454 com 5.000 m, foram observadas 93 árvores nos 16 m ao redor de (2513, 2784), incluindo 52 árvores da distribuição adicional. O cenário não apresentou rios quebrados nem erros no navegador. As capturas ficam em `playtest-output/foz-lago-profunda.png`, `playtest-output/foz-mar-profunda.png` e `playtest-output/nascente-floresta-densa.png`. A medição de desempenho em hardware móvel real continua pendente.

A continuidade visual das desembocaduras passou em `npm test` com 18 testes, no build e em `npm run playtest`. Os testes verificam redução progressiva da corrente, espalhamento lateral e bloqueio por terra ou mudança de cota. No Chrome, foram conferidas duas fases da animação em rio com lago (82, 144) e rio com mar (240, 67), semente 1769. As capturas ficam em `playtest-output/foz-lago-integrada.png` e `playtest-output/foz-mar-integrada.png`. A gravação adicional pelo Playwright ficou indisponível por ausência do executável FFmpeg.

| Cenário | Medição | Critério |
| --- | --- | --- |
| Mesma atividade, mais objetos distantes | 0, 1.000 e 10.000 construções fora da área consultada. Candidatos examinados, latência p50/p95, memória e custo de montar o índice | Mesmo resultado de jogo e quantidade de candidatos locais independente dos objetos distantes |
| Fronteiras e áreas grandes | Lotes em divisas de chunks, terrenos inválidos, muralhas, campos e construções carregadas | Mesma resposta do protótipo, incluindo a prioridade da rejeição |
| Comandos e saves | Duas coletas no mesmo alvo, construção repetida, falha e recarga de save anterior | Aplicação única, sem débito duplicado, sem mudança em comando recusado e persistência após recarga |
| Tarefas com atores | 100, 1.000 e 5.000 atores em cenários futuros. Variar a população com a mesma atividade, depois variar a atividade e a densidade local | Medir p50/p95/p99 por tick, por sistema e por consulta, entidades efetivamente atualizadas, alocações, memória e filas. A meta numérica depende do hardware e da carga acordada |
| Apresentação | Tempo de quadro, FPS, picos e latência da intenção ao efeito visível em desktop e no perfil móvel escolhido | Controles e resposta preservados frente à linha de base. Registrar limites por dispositivo |
| Worker, se adotado | Mensagens e bytes por segundo, tempo de preparação, trânsito, aplicação e atraso de revisão | Demonstrar benefício líquido sob a mesma carga e recuperação consistente após lacunas |
| Níveis de simulação, quando adotados | Comparar referência detalhada e agregada no mesmo intervalo | Preservar as invariáveis declaradas, incluindo estoques e progresso, sem duplicação de atividade na transição |

## Procedimento

Use sementes, ações, câmera, resolução, navegador e hardware registrados. Aqueça o cenário, repita medições e separe geração, simulação, renderização, transporte e persistência. Relate percentis e contadores de trabalho. Use resultados equivalentes ao comparar estruturas de armazenamento ou agendamento. Registre também áreas densas, saturação de filas e picos de salvamento. Faça testes do núcleo em Node e testes de ponta a ponta no navegador depois da importação.

## Resolução do mapa por zoom

A resolução interna passa de blocos de 2/3/4 pixels na vista próxima para 2/3, 2/3 e 1
pixel nos presets crisp/balanced/atlas a partir de span 86 m. A transição começa
em 43 m e usa passos de 0,25; os alvos só são realocados quando suas dimensões
mudam. O limite atual é 150% das dimensões CSS em crisp/balanced e 100% em atlas, sem multiplicador de DPR.
A alteração preserva escala e regras dos animais, geometria, seleção e saves.

Na vila da semente 1769, janela de 871 × 711, o diagnóstico confirmou
290 × 237 na vista inicial balanced e 871 × 711 após cinco cliques em Afastar.
A inspeção visual confirmou maior definição no mapa afastado, sem erros no console.
A amostra visual não comprova legibilidade de cada espécie nem substitui benchmark.
A resolução distante pode processar até nove vezes mais pixels que o preset
balanced anterior; ainda falta comparação repetida de p95 e memória em cena
densa, mapa máximo e dispositivo móvel. Não foi alterado o LOD dos animais.

Executados npm test (33 testes aprovados), npm run build e git diff --check.
O teste novo verifica progressão da resolução, limite de supersampling, presets e primeira
pessoa. A resolução interna também fica disponível no diagnóstico.

O aumento seguinte de 50% em cada eixo elevou o alvo distante balanced de
100% para 150% das dimensões CSS (2160 × 1350 em uma janela 1440 × 900).
Isso representa 2,25 vezes os pixels da resolução distante anterior. As medidas
de 871 × 711 acima descrevem a revisão anterior e não um benchmark do novo limite.
Verificação visual do novo limite: na janela 871 × 711, o diagnóstico confirmou 1307 × 1067 após cinco cliques em Afastar, sem erros no console. Os 33 testes e o build passaram.

### Revisão atual: detalhe ao aproximar

A vista inicial e distante passam a compartilhar o piso de 150% CSS em
crisp/balanced, com crescimento até 200% entre span 43 m e 20 m. Atlas usa
100% a 150%. Primeira pessoa recebe o limite próximo. As descrições anteriores
dos presets e limites registram revisões históricas, não a configuração atual.
O limite próximo processa até quatro pixels por pixel CSS; o custo adicional
ainda requer benchmark comparativo em cenas densas e dispositivos móveis.

Na vila da semente 1769, após quatro cliques em Aproximar, a janela 871 × 711
renderizou a 1742 × 1422. Foram conferidas casas, ponte e vegetação com capturas
de inspeção; não houve erros no console. npm test passou com 33 testes,
npm run build passou e git diff --check não encontrou erros de formatação.
O teste da resolução cobre ganho progressivo na aproximação, piso distante,
limites por preset e primeira pessoa. Saves e geometria não foram alterados.


## Ajuste visual da água pelas referências (2026-11-14)

`src/render/materials.js` alonga os padrões de espuma na direção local de jusante, acrescenta filetes claros e realce nas margens dos rios. O mar recebe ondulações largas em quatro degraus de tom e cristas interrompidas por ruído em coordenadas globais, com azul-petróleo mais claro em profundidade. A espuma costeira e a película da praia conservam seu ciclo compartilhado. A mudança é apenas de apresentação: não altera hidrologia, sementes, IDs nem saves e não acrescenta malhas ou chamadas de desenho.

Verificação: `npm test` passou com 38 testes; `npm run build` passou, com aviso de chunks maiores que 500 kB. `npm run playtest` não conseguiu acessar a porta 5917. Uma segunda tentativa com `KINGDOM_URL=http://127.0.0.1:5923` também não conseguiu acesso. A captura direta pelo Playwright retornou `net::ERR_NETWORK_ACCESS_DENIED`. A compilação dos shaders no WebGL, a avaliação visual em movimento e a comparação de desempenho continuam pendentes no navegador com acesso ao servidor local. Não há medição nova de FPS.


### Refinamento low poly e pixel art

O shader da água agora usa ruído interpolado em triângulos, ondas de perfil triangular, quatro patamares de tom e três cores-base azul-petróleo. Os reflexos especulares suaves foram removidos. A espuma usa três níveis de cobertura com cortes definidos; seus padrões são amostrados em uma grade mundial de 0,2 m, também na película da praia. A derivada da profundidade continua sendo calculada nas coordenadas contínuas para preservar a orientação costeira. Terreno, simulação e saves permanecem iguais. `npm test` passou com 39 testes, `npm run build` passou com o aviso de tamanho de chunks e `git diff --check` passou; a aprovação visual em navegador continua pendente devido ao bloqueio de acesso local registrado acima.


### Remoção da apresentação aquática para reconstrução

Foram removidos os shaders `waterMaterial` e `beachMaterial`, `src/render/water.js`, as malhas de água dos chunks, o oceano externo e a espuma/película da praia. `src/render/coast.js` mantém apenas a distância visual da praia usada pelo terreno e pela vegetação. `waterRipple` permanece como ponto de integração sem efeito visual. Hidrologia e regras aquáticas não mudam; os leitos ficam expostos. `npm test`: 39 testes passaram. `npm run build`: passou com aviso de chunks grandes. `git diff --check`: passou. Verificação visual no navegador pendente devido ao bloqueio de acesso local registrado nesta sessão.

### CPU da fauna no zoom amplo

A [auditoria de fauna](auditoria-fauna.md#otimização-de-cpu-no-zoom-amplo) registra
o perfil de CPU, retirada dos modelos fora da cena, cadência visual e amostras.
Os 41 testes passaram, com inspeção de navegador e build. A resolução elevada
foi preservada. As amostras têm focos/populações diferentes e não sustentam uma
porcentagem de ganho nem meta de 144 FPS. Falta repetir no mesmo foco e hardware.

### Lotes, LOD, fases de animação e orçamento de GPU

A [comparação controlada](otimizacao-render.md) registra implementação, condições,
amostras e limites. Na cena fixa, referência 87,4 FPS / 711 chamadas / 11,49 milhões
de triângulos; otimizado 141,1 FPS / 421 chamadas / 3,82 milhões, com a mesma
resolução e 78 modelos carregados. São amostras curtas com fauna congelada, não
uma garantia de 144 FPS. npm test passou com 47 testes; npm run build e
git diff --check passaram. Pipeline de natureza gera LOD offline.

### Biomas de vegetação e pacote completo de árvores

[Registro da integração](biomas-vegetacao.md): 97 ativos preparados, 51 testes e
build aprovados. Navegador: mapa de 5 km, camada Biomas e identificação de
Palmeira/Palmeiral quente conferidos, sem erros no console. A grade física de
biomas e os IDs dos recursos não mudam. O bundle inicial cresceu; teste de
desempenho comparativo em floresta densa e inspeção de todas as estações pendentes.

### Correção das famílias por clima regional

A escolha visual deixou de herdar a família da lista legada de recursos. Pinheiros ficam nos perfis frios; carvalhos/bétulas nos temperados; salgueiros em áreas ciliares ou alagadiças com água doce próxima. Duas grades climáticas de 32 m preservam temperatura/chuva do gerador após compactação (49.928 bytes em 5 km). IDs, locais, envelopes de recursos e saves continuam iguais. [Regras e evidências](biomas-vegetacao.md). `npm test`: 55 aprovados; `npm run build`: aprovado com aviso de bundle grande; auditoria amostral de 15.659 árvores sem violações. Não há nova medição comparativa de FPS.

### Expansão de pedras e decoração da natureza

`node tools/prepare-nature.mjs 'C:\Users\Julio\Downloads\Ultimate Nature Pack by Quaternius'` preparou 150 modelos com LOD próximo/distante, 183.494/101.184 triângulos. `npm run build` passou; o bundle principal ficou em 11,03 MB (3,10 MB gzip), com aviso para chunk acima de 500 kB. A distribuição usa pedras, arbustos, cactos, flores, gramíneas, plantas de margem, cultivos, tocos e troncos; as silhuetas de pedra variam por célula de 64 m para conter chamadas de desenho. Testes e playtest visual não foram executados nesta rodada; validar aparência, chamadas e p95 em cena densa. Vitória-régia permanece sem posicionamento enquanto a superfície de água está removida.

### MegaKit: gramas e plantas verdes

Conversor preparou 19 modelos texturizados e atlas único, com 12 modelos verdes em uso. `npm test`: 57 aprovados, incluindo alcance do catálogo verde e geometrias/UV/LOD. `npm run build`: aprovado com aviso de bundle grande. No navegador da porta 5173, mapa 1024/seed1769/primavera/balanced: ativos carregados, vila e aproximação conferidas sem erro no console. Esta rodada não tem benchmark comparativo de FPS. A composição de grama com dez cópias foi removida; manchas e escalas individuais continuam.

### Traçado dos rios: geração 5 (2026-11-14)

Validação: `npm test` passou com 59 testes; `npm run build` passou com o aviso existente de bundle grande; `git diff --check` passou. `test/river-shape.test.js` verifica repetibilidade, conexões sem ciclos, descida das cotas, conservação de vazão, eixo molhado em três sementes de 512 m, locais válidos e retomada de save da geração 4. As assinaturas históricas das gerações 1 e 2 continuam aprovadas.

`npm run playtest` não alcançou o servidor na porta 5917. Inspeção manual pelo navegador integrado em `http://127.0.0.1:5173/?seed=1769&size=1024&style=spring&hydrology=5`: mundo carregado, navegação por vila, lago e minimapa funcionando, sem erros de console observados. A água visual continua removida, com leitos expostos. A inspeção não foi suficiente para aprovar o acabamento de todos os afluentes nem demonstrar redução dos maiores trechos retos. Curvas amplas em todas as sementes e custo/memória de geração em 5 km permanecem pendentes; a prioridade de drenagem acrescenta um buffer temporário Float64 de oito bytes por célula. Não há nova medição de FPS nem garantia de meandros em todo trecho.
### Origens em lagos interiores: geração 6 (2026-11-14)

`npm test`: 63 testes aprovados. `npm run build`: aprovado com o aviso existente de bundle grande. `git diff --check`: aprovado. `test/lake-outlets.test.js` cobre origens dentro dos lagos e longe do mar, percurso contínuo até o oceano sem ciclos nem subida, cobertura de todos os trechos pela rede originada nos lagos, determinismo em três sementes de 512 m, rejeição de lagos costeiros e rotas para bordas secas, controles desativados e retomada de save da geração 5.

Geração completa em 1024 m: sementes 1769, 454 e 12 produziram respectivamente 2053, 1618 e 1251 segmentos, com 24, 19 e 10 saídas de lagos; nenhuma descontinuidade nem lote inválido. No navegador integrado, semente 1769, primavera, `hydrology=6`, o mundo carregou sem erros de console observados. O diagnóstico confirmou 2053 segmentos, zero descontinuidades e zero lotes/vias inválidos. A superfície visual da água continua removida; a inspeção do acabamento de todas as saídas e o benchmark comparativo em 5 km permanecem pendentes. Não há nova conclusão de desempenho.
### Exclusão de água doce no frio: geração 7 (2026-11-14)

`npm test`: 65 testes aprovados. `npm run build`: aprovado com o aviso existente de bundle grande. `git diff --check`: aprovado. `test/cold-water.test.js` confere ausência de lagos, canais e água doce na máscara fria em três sementes de 512 m, continuidade das origens quentes até o mar, mapa totalmente frio sem água doce, compatibilidade com saves da geração 6 e ausência de rios quebrados/lotes inválidos. Os testes anteriores preservam as gerações históricas.

Navegador integrado: semente 1769, primavera, mapa 1024 m e `hydrology=7` carregaram sem erros de console observados. A inspeção confirma carregamento e navegação inicial; a avaliação visual de todas as regiões frias e o benchmark de geração em 5 km permanecem pendentes. A máscara acrescenta temporariamente um byte por célula. A superfície visual da água continua removida.
### Manchas regionais de bioma: geração 8 (2026-11-14)

`npm test` aprovou os 65 testes existentes; `node --test test/biome-regions.test.js` aprovou os dois testes acrescentados em seguida (67 no total). `npm run build` passou com o aviso existente de bundle grande. `git diff --check` passou. Os testes novos comparam fragmentação no mesmo terreno plano e clima em três sementes de 512 m: menos da metade das bordas antigas, uma região contínua acima de 10 mil células e manchas menores entre 50 e 2000 células. Também cobrem determinismo, preservação dos campos aquáticos, compatibilidade com progresso da geração 7 e ausência de descontinuidades/lotes inválidos.

Na semente 1769, tamanho 1024 m, a contagem de arestas entre células adjacentes dos biomas de planície (2–6) caiu de 131383 para 33259, mantendo populações de células semelhantes por bioma. Ambas as versões tiveram zero rios quebrados e zero lotes inválidos. São dados da grade, não uma medida de qualidade visual de todas as sementes nem desempenho. A variação multiescala faz mais amostragens de ruído durante a geração; custo comparativo e memória em 5 km permanecem pendentes.

No navegador integrado, `hydrology=8`, primavera e semente 1769 carregaram sem erros de console observados. A inspeção em zoom amplo confirmou uma grande região verde contínua com transição para montanha/neve. Falta inspecionar todas as combinações de clima e estação e os limites extremos de mapa.
### Vegetação no zoom máximo

A verificação visual com a semente 1769 e mapa de 1.024 m confirmou plantas visíveis no afastamento máximo. O LOD distante seleciona instâncias de forma determinística por coordenadas e usa as malhas simplificadas do capim. A densidade de cada categoria foi reduzida para limitar custo; ainda falta medir FPS, p95 e memória em áreas densas e em dispositivos de referência.

`npm run build` passou com o aviso existente de bundle principal acima de 500 kB. Os testes automatizados específicos desta mudança ainda estão pendentes; não há nova medição de FPS ou memória.

### Integração das texturas locais de terreno (2026-11-14)

Preparação: `python tools/prepare-terrain-textures.py 'C:\Users\Julio\Downloads\Terrain Textures'` gerou oito camadas no atlas 1088 × 544 (1277983 bytes). `npm test`: 69 testes aprovados. `npm run build`: aprovado com o aviso existente de bundle grande. `git diff --check`: aprovado. Os testes novos cobrem normalização dos pesos de todos os biomas, prioridade de campos/caminhos, areia, neve, dimensões do PNG e correspondência de nomes/hashes do manifesto.

Navegador integrado, mapa 1024 m, semente 1769, primavera, geração 8: vila com ponte e leito exposto, solo de planície e borda de neve/montanha conferidos; sem erros de console/shader observados. O atlas compilou no WebGL 2. Não houve medição comparativa de GPU nem inspeção de cada textura em todas as estações. O atlas acrescenta cerca de 3 MiB de armazenamento GPU RGBA8 com mipmaps; os pesos acrescentam 32 bytes por vértice do terreno e o shader faz amostragens conforme as camadas presentes. Custo em dispositivo móvel e mapa máximo permanece pendente.
### Streaming de terreno antes da decoração

O renderer prepara superfícies em etapa própria (até oito por quadro, orçamento de 5 ms), antes da geração de plantas e estruturas. A decoração mantém até dois chunks por quadro. O teste de frustum foi expandido em 32 m por lado para antecipar uma fileira; candidatos passam de 66 para 100 e cache de 80 para 144 chunks. Picking e diagnóstico toleram chunks com terreno preparado e decoração pendente. Build aprovado. A melhora visual em arrastes rápidos e o aumento de memória pelo cache ainda precisam de conferência no navegador.

### Streaming da vegetação

A máscara de cobertura passa a usar amostras de 1 m memorizadas por chunk e interpolação bilinear, evitando repetir consultas de estradas e âncoras para cada haste. Isso altera ligeiramente apenas posições decorativas aceitas nas bordas; IDs e posições dos recursos coletáveis permanecem iguais. Decoração passa a até seis chunks por quadro com orçamento de 7 ms; montagem de lotes passa a até seis células com orçamento de 5 ms. Cada trabalho individual ainda pode exceder o orçamento. Testes de cobertura e orçamento de renderização executados; build executado. Verificação visual de arrastes rápidos e benchmark continuam pendentes.

### Reconstrução da água com NVJOB (2026-11-14)

`python tools/prepare-nvjob-water.py` copiou cinco PNGs originais e três notices MIT. `npm test`: 72 testes aprovados. `npm run build`: aprovado com aviso existente de bundle grande. `git diff --check`: aprovado. `test/water-render.test.js` verifica recorte sobre terra seca, alinhamento com superfície/profundidade da consulta autoritativa, direção da corrente, continuidade entre chunks e oceano externo sem triângulos no interior do mapa.

Navegador integrado: semente 1769, tamanho 1024 m, primavera, geração 8. Conferidos rio sob a ponte da vila, lago e margem de praia/mar. O shader compilou e as cinco texturas carregaram sem erros de console observados. As capturas de inspeção mostraram superfície azul/verde, margem translúcida e detalhe em camadas. Não há nova medição comparativa de GPU/FPS nem playtest completo de travessia. Validação em mapas de 5 km, dispositivos móveis, todos os encontros entre níveis e movimento prolongado continua pendente. As versões anteriores desta documentação que dizem água removida são registros históricos; a apresentação atual está novamente ativa.
### Movimento de mar, rios e fozes (2026-11-14)

`npm run build`: aprovado com o aviso existente de bundle grande. `node --test test/water-motion.test.js test/water-render.test.js`: 7 aprovados. `npm test`: 75 aprovados e 1 falha; o teste de propriedade dos chunks em `test/world.test.js:385` exige zero sobreposições fora das nascentes, mas a vegetação em edição inclui uma camada `dt:` de matas fechadas e apresentou 37 sobreposições nessa amostra. Essa falha não vem de alteração na água e não foi mascarada nem o teste modificado nesta entrega. `git diff --check`: aprovado.

Os testes novos cobrem foz em lago e mar com perda de intensidade e espalhamento, bloqueio por terra ou diferença de cota, rejeição do tipo de receptor errado, direção fluvial suavizada e normalizada, mesmos atributos em bordas de chunks e continuidade dos ciclos em reinícios e sessões longas. A animação não modifica a geração nem a simulação.

Navegador integrado, semente 1769, 1024 m, primavera, geração 8: shader compilado sem erros de console observados; conferidos canais e encontros com águas abertas em diferentes enquadramentos. Em um encontro raso costeiro a transparência deixou o leito muito visível; a aprovação visual de toda a faixa de profundidades e de ambas as fozes em movimento prolongado permanece pendente. Sem medição comparativa de GPU/FPS nesta rodada. O shader tem mais amostragens para as fases sobrepostas, e a geometria acrescenta três floats de transição por vértice. A consulta de foz usa apenas candidatos locais e as amostras são reutilizadas por vértice do chunk.
### Lagos reflexivos e avanço/recuo costeiro (2026-11-14)

`npm run build`: aprovado com o aviso existente de bundle grande. `node --test test/water-motion.test.js test/water-render.test.js test/water-shore.test.js`: 10 aprovados. `npm test`: 78 aprovados e a mesma falha de sobreposição de copas em `test/world.test.js:385` registrada na etapa anterior (37 contra zero, após a nova camada de matas densas). `git diff --check`: aprovado. O teste de copas não foi alterado por esta entrega.

Os testes novos verificam película restrita à areia baixa junto ao mar, rejeição de bancos altos, preservação do terreno, seleção exclusiva de nível de lago para reflexo, limite temporal das atualizações, água oculta na passagem de reflexo e restauração de visibilidade/sombras inclusive após falha. Os testes anteriores de direção de corrente, foz, ciclos e limites de chunks continuam aprovados.

No navegador integrado, geração 8, semente 1769, 1024 m e primavera: conferidos centro do lago calmo, reflexos de árvores da margem e duas fases da faixa de espuma da praia, com recuo entre capturas. Nenhum erro de console/shader observado. A primeira inspeção mostrou borda dura da captura refletida; foi acrescentado fade na borda do alvo. O build e os dez testes específicos foram repetidos após esse ajuste. Avaliação de todas as cotas de lago, paredões, primeira pessoa, movimento reduzido e dispositivos móveis permanece pendente.

O reflexo acrescenta uma passagem de cena de resolução limitada até oito vezes/s quando há lago perto do foco, além de uma película por chunk de praia baixa. Sem benchmark comparativo de GPU ou garantia de FPS. A simulação e os saves permanecem iguais.
### Remoção das faixas artificiais no mar (2026-11-14)

`npm run build`: aprovado com aviso existente de bundle grande. `node --test test/coastal-distance.test.js test/water-motion.test.js test/water-render.test.js test/water-shore.test.js`: 13 aprovados. `npm test`, antes do último teste de variedade de velocidades ser acrescentado: 80 aprovados, uma falha conhecida no teste de sobreposição de árvores em `test/world.test.js:385` (37 contra zero). `git diff --check`: aprovado.

Os novos testes cobrem um campo que acompanha a borda de uma ilha circular, aumento da distância para o largo, interpolação contínua, ausência de costa artificial no oceano sem terra, continuidade do atributo entre chunks, tamanho reduzido da grade, imutabilidade do terreno e velocidades/períodos/larguras distintos nas três frentes. Os dez testes anteriores de água continuam aprovados.

No navegador integrado, semente 1769, 1024 m, primavera, balanced e geração 8: conferidos o mar aberto sem as antigas bandas brancas diagonais e a arrebentação acompanhando a enseada curva ao sul. A primeira inspeção mostrou cristas costeiras ainda contínuas; a cobertura recebeu uma segunda escala de ruído e limiar mais alto, e a nova versão foi inspecionada novamente. Nenhum erro de shader/console observado. O ajuste final diferenciou ainda mais as velocidades e omitiu o cálculo das frentes fora da faixa costeira; build aprovado após esses ajustes. Falta benchmark comparativo de GPU e validação de todas as praias, escalas, sementes e dispositivos móveis. Não há promessa de ganho de FPS.
### Revisao da espuma e margem
Removida a mascara de quadrados; espuma usa faixas contiguas de intensidade. Transparencia cresce exponencialmente com profundidade e a pelicula desaparece numa faixa maior. Build aprovado e navegador sem erros de shader. Conferencia visual especifica da praia em movimento pendente.

### Hidrologia 9: lagos conectados ao mar
Todo lago retido precisa de rota de drenagem ate o mar sem atravessar regioes frias. Saidas nao dependem mais de vazao minima ou distancia da costa. Todos os ramos de saida sao esculpidos; bacias sem rota valida sao descartadas. Com rios desativados, nao ha lagos nesta versao. Versoes 1 a 8 e saves anteriores permanecem disponiveis; a versao 9 tem chave propria e pode mover vegetacao e assentamentos. Testes de conectividade em tres sementes e testes de regioes frias aprovados. Build aprovado. Navegador carregou sem erros; inspecao visual completa do streaming e das fozes pendente.

### Lagos afastados da costa e depressoes interiores
Hidrologia 9 exige afastamento minimo de 8% do tamanho do mapa, limitado entre 12 e 100 m. Apenas terreno baixo conectado a borda por vizinhos cardinais e considerado oceano. Depressoes interiores abaixo do nivel do mar entram na drenagem a 0,13 m acima do mar, permitindo continuidade do canal. A entrada original nao e alterada. Testes cobrem afastamento, falso oceano interior e continuidade de saidas. A transparencia permanece igual.

### Estuario e erosao da foz
Na hidrologia 9, canais baixos ampliam gradualmente a meia-largura ate 3,2 vezes nos ultimos 32 m da costa. O leito aprofunda progressivamente ate cerca de 3,35 m no eixo da embocadura; o aprofundamento existente da pluma marinha recebe alvo maior com queda lateral e longitudinal. A influencia da corrente junto da profundidade suprime a arrebentacao na boca, mantendo praias laterais. Build e testes de drenagem, movimento e malha aquatica aprovados. Navegador sem erros de shader observados; aprovacao visual especifica de todas as fozes pendente.

### Corredor final do estuario
carveEstuary executa apos as demais escavacoes e antes da ecologia, cortando terreno, mascara e superficie conjuntamente. Corredor desde 24 m a montante ate pelo menos 36 m no mar, com rampas longitudinais e laterais, profundidade alvo de 3,6 m. Substitui o aprofundamento marinho isolado anterior. A faixa recebe classificacao marinha compartilhada e os caminhos de mistura sao recalculados. Teste sintetico verifica corte continuo de barreira de areia e preservacao de terreno lateral. Testes de agua/drenagem e build aprovados antes da remocao final do aprofundamento antigo; teste do corredor aprovado apos essa remocao. Conferencia visual especifica da foz pendente.

### Dissolucao da ponta do estuario
O corredor usa decaimento radial eliptico na ponta marinha e variacao coerente lateral por duas senoides, dissolvendo a escavacao no fundo existente. A malha compartilha um fator continuo entre comportamento fluvial e marinho ao longo de 44 m na foz, em vez de chave binaria. Cor e textura usam a mesma mistura de material; a transparencia aprovada continua baseada em profundidade. Oito testes focados aprovados e build aprovado. Conferencia visual da foz pendente.

### Correnteza e canal marinho alongados
O alcance da foz marinha foi multiplicado por quatro; escavacao radial e caminho de corrente usam esse alcance. A mistura curta de 44 m foi substituida pelo peso continuo da pluma, com perda longitudinal e lateral. A corrente marinha estendida tambem cobre os 40 m anteriores a boca, recuperando adveccao e textura fluvial no trecho reclassificado como mar. O peso controla a contribuicao do material do rio sobre o oceano compartilhado, sem abrir transparencia no fundo. Oito testes focados e build aprovados. Conferencia visual especifica em movimento pendente.

### Margens arredondadas e abertura em leque
carveEstuary usa ombros de largura com smoothstep de -24 a 12 m e abertura marinha adicional de 0,18 m por metro, introduzida suavemente. Duas escalas de variacao lateral removem paralelismo. O limite abrupto de altura da areia foi substituido por atenuacao entre 1,5 e 4 m; a mascara de margem acompanha a profundidade escavada, evitando uma faixa molhada larga com fundo quase seco. Oito testes focados e build aprovados. A conferencia visual dos dois cantos na semente 1769 continua pendente.

### Mistura lateral da agua na foz
Peso de lago corrigido para max(0, 1-sea-river): os pesos complementares de rio e mar antes ativavam indevidamente o acabamento de lago na faixa intermediaria. A contribuicao fluvial na pluma marinha recebe interpolacao cubica, atenuando as bordas laterais. Terreno e transparencia por profundidade permanecem iguais. Sete testes de malha/movimento e build aprovados; conferencia visual dos cantos pendente.

### Cantos marcados na margem da foz
A escavacao lateral agora interpola a altura existente ate o fundo alvo pelo peso continuo de erosao. Antes, qualquer peso positivo colocava imediatamente a areia abaixo do nivel do mar, produzindo cantos no recorte. A mascara umida acompanha a profundidade efetiva apenas nos pontos submersos. Quatro testes focados e build aprovados; navegador sem erros registrados. A correspondencia visual com os dois pontos marcados ainda precisa ser conferida.

