# Biomas de vegetação

O jogo escolhe a família visual de cada árvore por clima e disponibilidade de água. Os oito perfis de flora aparecem na inspeção e na camada Biomas do minimapa. A grade física mantém os 12 IDs usados pela fauna e pela navegação.

| Perfil | Condições e árvores |
| --- | --- |
| Bosque temperado | Demais áreas habitáveis: 72% carvalhos e 28% bétulas. |
| Bosque boreal | Temperatura normalizada abaixo de 0,44: pinheiros e bétulas; participação de pinheiros aumenta com o frio. |
| Bosque nevado | Temperatura abaixo de 0,25, ou tundra abaixo de 0,36: pinheiros e bétulas com neve. |
| Floresta de coníferas | Bioma montanhoso com temperatura abaixo de 0,52: pinheiros e bétulas. |
| Mata ciliar | Faixa ciliar física, água doce a até 8 m e umidade mínima de 0,55: salgueiros e bétulas. |
| Bosque alagadiço | Pântano físico, água doce a até 5 m e declive até 0,25: salgueiros. |
| Bosque seco | Savana/região seca ou umidade abaixo de 0,40: acácias procedurais. |
| Palmeiral quente | Temperatura acima de 0,67, altitude normalizada abaixo de 8 m, umidade acima de 0,42 e água a menos de 16 m: 80% palmeiras, 20% árvores comuns. A distância não distingue mar de rios ou lagos. |

As condições são avaliadas na ordem: áreas sem bosque, habitats aquáticos, neve, montanha fria, bosque boreal, palmeiral, bosque seco e temperado. Água doce significa que a célula aquática mais próxima na busca local é lago ou rio, excluindo o mar. O perfil alagadiço depende da classificação física prévia; umidade elevada sozinha não cria pântano. Os índices são parâmetros do jogo, não graus Celsius ou medições de saturação do solo.

## Clima regional

`src/world/flora-climate.js` conserva amostras da temperatura e chuva do gerador a cada 32 m. Duas grades de bytes custam 49.928 bytes no mapa de 5 km e sobrevivem à compactação do mundo e à transferência pelo Worker. A interpolação bilinear recompõe o clima regional, com efeito da altitude local e acréscimo de umidade perto da água. É uma aproximação do clima completo, preservando seu ruído e configuração. Mundos sem esses campos usam a estimativa anterior como compatibilidade.

Não se criam novos pontos de recursos: água, declives, estradas, campos, construções e densidade continuam limitando os locais das árvores. Um perfil pode ter poucas árvores ou nenhuma.

## Modelos e compatibilidade

O pacote inclui 94 árvores, 21 pedras e 35 modelos de vegetação e decoração. CommonTree, BirchTree e Willow têm cinco formas em verde, outono, neve, morta e morta com neve. PineTree tem cinco formas em verde, outono e neve; PalmTree tem quatro formas. Acácias continuam procedurais porque o pacote não oferece essa família. Não há outra família arbórea além das já integradas.

A escolha determinística da família usa `flora.renderSpecies`, independentemente da lista de espécies legada. Assim, uma antiga árvore marcada como pinheiro pode aparecer como carvalho numa região temperada. A interface identifica a família apresentada. O campo `species` legado, posições, IDs, idade, escala, rotação e envelope de ocupação permanecem preservados para coleta e saves. A largura visual é limitada ao envelope do recurso original. Não existem regras de crescimento ou necessidades por espécie; uma futura regra botânica deverá explicitar essa identidade no domínio.

As pedras selecionam sete silhuetas por acabamento: comum no terreno geral, musgosa em áreas ciliares/alagadiças e nevada em tundra/neve. A vegetação rasteira usa gramíneas, plantas de margem, arbustos com frutos e flores. Cactos ficam em savana/região seca; campos usam trigo e milho. Tocos e troncos aparecem raramente em áreas florestais como enfeites sem coleta. A geração acrescenta apenas pontos decorativos na grade já usada pelas plantas; IDs e locais de árvores e pedras permanecem iguais. O modelo de vitória-régia foi preparado, mas não é colocado enquanto o jogo estiver sem superfície visual da água.

Regiões de 128 m escolhem um par de formas vivas por família para limitar os lotes. Perto e longe mantêm a mesma forma e estação, com LOD dos modelos novos. Árvores mortas são detalhes raros de indivíduos maduros nas famílias compatíveis, sem mudar a madeira disponível. Neve tem prioridade sobre outono. Não há pinheiro morto no pacote.

`src/world/flora-biomes.js` define consultas sem DOM ou Three.js. `src/world/vegetation.js` acrescenta os metadados derivados sem consumir os canais de hash dos recursos anteriores. Os metadados não entram no save; formato e chave permanecem iguais. O visual é corrigido ao reconstruir o mundo, sem migração de IDs.

## Validação da correção

- `npm test`: 55 testes aprovados, incluindo habitats, exclusão de mar, família independente da espécie legada, clima compacto/completo, interpolação da borda e geometria perto/longe.
- `npm run build`: aprovado, com aviso de bundle grande; aproximadamente 9,74 MB iniciais e 2,76 MB gzip. Carregamento por grupos ainda pendente.
- `node tools/audit-flora.mjs 5000`: semente 1769, água 0,14, relevo 0,83, clima 0,61 e vegetação 0,25; 1.600 chunks amostrados, 15.659 árvores, zero violações das restrições verificadas. Não é uma varredura de todos os chunks ou sementes.

A auditoria encontrou 7.091 árvores temperadas, 3.390 boreais, 615 nevadas, 30 de coníferas, 542 ciliares, 71 alagadiças, 437 secas e 3.483 em palmeirais. Inspeção visual de todos os perfis e estações e comparação de desempenho em floresta densa continuam pendentes.

Nesta rodada, a validação visual não pôde ser concluída: o navegador recusou a conexão inicial à porta 5917 e, após iniciar o Vite nessa porta, retornou timeout. Os resultados acima são dos testes e da auditoria sem navegador; não comprovam a aparência nem o desempenho da nova distribuição em WebGL.

## Recursos complementares do pacote

O conversor ampliado gerou 150 modelos, todos com índices próximos e distantes: 183.494 triângulos perto e 101.184 longe. A decoração usa o campo físico do terreno para escolher os modelos. A família de árvore permanece a definida pela correção climática acima. `npm run build` passou; o bundle principal ficou em 11,03 MB (3,10 MB gzip), com aviso de chunk acima de 500 kB. Testes, inspeção visual e custo de quadro dos novos modelos permanecem pendentes.

### Manchas de vegetação rasteira

A cobertura agora usa manchas interpoladas de 24 m e uma escolha de planta independente da densidade. Pradarias priorizam gramíneas; mata densa mistura arbustos, plantas altas e grama; regiões secas têm cobertura baixa. Os pontos e IDs dos recursos coletáveis permanecem iguais. Esta revisão usa os modelos já preparados do Ultimate Nature Pack. A integração texturizada do MegaKit e do pacote de árvores de 2020 continua pendente, assim como a revisão completa da distribuição arbórea e a validação visual.

Ajuste da cobertura florestal: o fator de mata densa passou de 0,29 para 0,72 e o de floresta temperada de 0,36 para 0,56. Nas áreas interiores de mata densa, a parcela de gramíneas passou de 60% para 78%, mantendo 12% de arbustos e 10% de plantas altas. Margens mantêm plantas próprias. O descarte de vegetação miúda nos chunks distantes continua ativo; a mudança afeta a cobertura próxima, sem alterar recursos coletáveis.

A pedido, cada ponto aceito de grama nos biomas físicos 3 e 4 agora recebe até nove tufos adicionais dentro da mesma célula de 1 m, totalizando aproximadamente 10 vezes a quantidade anterior. Cada tufo revalida terreno, água, declive e ocupação; bordas podem ter menos de dez. Os modelos continuam compartilhados por instanciamento e ocultos nos chunks distantes. A quantidade de instâncias e triângulos próximos aumenta; o impacto no FPS ainda precisa de medição no navegador.

Aumento adicional de 10 vezes na grama florestal: cada instância agora usa uma geometria compartilhada com dez tufos, com largura de 35–95% e altura de 30–140% da geometria base, rotação e pequenos deslocamentos determinísticos. O banco separa grama florestal das demais regiões. Mantém a quantidade de objetos e instâncias da revisão anterior, mas multiplica os triângulos próximos por dez; FPS e aparência ainda exigem conferência no navegador. Junto com o aumento anterior, chega a aproximadamente 100 tufos por ponto florestal aceito. As validações de ocupação continuam nas âncoras, e os tufos têm deslocamentos locais de até 8 cm por eixo.

Correção após avaliação do usuário: removida a geometria grassClump e suas dez cópias sobrepostas. A grama volta ao modelo individual compartilhado, com posições independentes da rodada anterior e variações de escala/altura por planta. O aumento adicional de dez vezes via geometria foi desfeito; permanece a distribuição anterior de até dez plantas por ponto aceito. A aparência ainda requer conferência visual.

Refinamento da mesma correção: a quantidade por célula aceita agora varia de 1 a 18 plantas conforme a mancha interpolada (em vez de dez fixas). Isso alterna trechos leves e cheios, mantendo cada planta como instância separada, sem geometria composta obrigatória. A variação espacial continua determinística.

## Plantas do MegaKit e paleta verde

O jogo agora prepara 19 modelos do Stylized Nature MegaKit Standard e distribui 12 modelos de folhagem verde: quatro gramas (comum/fina, baixa/alta), dois trevos, uma samambaia, quatro plantas e um arbusto. Flores coloridas, cogumelos e arbustos floridos ficam fora da distribuição; antigos arbustos com frutos vermelhos e cactos floridos também deixam de aparecer. Pontos antes chamados flower passam a usar trevos ou grama/cactos verdes. Essa mudança é visual; os tipos de recursos coletáveis continuam os anteriores.

Os modelos usam UV e um atlas de 1536 × 1024 com recorte alpha de 0,45 e faces duplas. A textura de folhagem do pacote continha partes roxas/vermelhas: a conversão preserva seus recortes e variação de luz, mas aplica uma base verde. A apresentação acrescenta um tom amarelado progressivo entre temperatura normalizada 0,62 e 0,88. Modelos altos/baixos mantêm dimensões próprias, além da escala individual. Não há mais geometria que multiplica dez cópias sobrepostas em todo ponto de grama; as plantas continuam separadas e as manchas têm densidades variadas.

`tools/prepare-megakit-plants.mjs` usa o OBJ/MTL do pacote local e o MeshoptSimplifier já instalado. O atlas é produzido por `tools/prepare-megakit-atlas.py` com Python/Pillow. Há 19 geometrias preparadas, todas com LOD e UV no mesmo atlas; as 12 verdes são selecionáveis em `src/world/groundcover.js`. O material compartilha uma textura entre todas as plantas por visualização e a descarta junto com o material.

Verificação: os 57 testes passaram, incluindo os modelos texturizados, UV, índices e exclusão de flores/cogumelos da escolha atual. Build passou com o aviso existente de bundle grande. Navegador local 5173 acessível nesta sessão: conferidos carregamento dos ativos, vista da vila e aproximação, sem erros no console. Comparação de FPS em floresta densa continua pendente. A integração das árvores dos pacotes adicionais e a revisão completa de litoral/biomas continuam em aberto.

### Acabamento low poly do capim

O material das plantas do MegaKit usa flatShading para evidenciar faces, com cores em degraus após a amostragem da textura. O atlas de folhagem reduz gradientes para cinco níveis de luminosidade antes da aplicação da paleta verde. Alpha e recortes das folhas continuam preservados; o amarelecimento por calor permanece. A mudança não acrescenta tufos, instâncias ou polígonos. A densidade e as dimensões individuais continuam iguais.

Validação do acabamento: 57 testes aprovados e build aprovado (aviso existente de bundle grande). Conferida a vila da semente 1769 em 5173 com três aproximações da câmera, sem erros no console. Não há medição comparativa de FPS nesta alteração de material.

### Retorno da graminha verde anterior

Uma camada decorativa adicional usa os modelos sólidos Grass, Grass_2 e Grass_Short do Ultimate Nature Pack, misturados às plantas do MegaKit. A camada aparece em pradaria, floresta temperada, mata densa, mata ciliar e pântano, fora da margem imediata, respeitando declive e ocupação. Sua cobertura acompanha as manchas interpoladas e a densidade vegetal; escala e altura variam por indivíduo para manter o capim baixo. A flag classicGrass evita a substituição desses pontos pelo catálogo texturizado. IDs dos recursos coletáveis e saves continuam iguais. Os modelos continuam instanciados e ocultos na distância ampla.

Verificação desta camada: build aprovado e cena próxima conferida no navegador em 5173, sem erros no console. A bateria completa teve 56 aprovações e uma falha em old saves select the original hydrology and retain their terrain: o hash dos buffers de terreno/água legados difere da referência. Há alterações simultâneas na hidrologia neste workspace; esta mudança de capim não edita esses buffers nem o gerador de relevo. Não foi alterada a expectativa do teste. A comparação de FPS segue pendente.

### Arbustos discretos e graminha baixa 30 vezes mais densa

A cor dos arbustos do MegaKit recebe redução de saturação e tom oliva. Os degraus de cor passaram a atuar na luminosidade, preservando as proporções RGB: a quantização anterior eliminava o vermelho de folhas escuras e deixava o verde excessivo.

Cada célula aceita da camada classicGrass passa de uma planta para até 30 plantas separadas, distribuídas numa grade 6 × 5 com deslocamento aleatório, altura e escala variadas. Cada posição revalida bioma, margem, declive e ocupação; nas bordas o aumento pode ser menor que 30. As posições ficam num Float32Array por célula e são expandidas para matrizes individuais no InstancedMesh, compartilhando a geometria e sem criar objetos JS por planta. Não há uma malha composta de tufos. Recursos coletáveis e chaves de save não mudam. O renderizador usa os índices simplificados existentes para essa camada baixa também de perto, e continua descartando a grama no zoom distante.

Teste acrescentado cobre 30 posições por célula livre, matrizes de instância, altura no terreno, exclusão distante, cor mais discreta dos arbustos e igualdade dos recursos coletáveis. Uma primeira amostra da versão densa sem a simplificação, em seed1769/1024/spring/balanced, foco (504,43; 560,60), span28,2123, mediu aproximadamente 89 FPS e 18,74 milhões de triângulos. São amostras curtas, não benchmark de regressão contra a versão anterior à densidade.

### Cobertura no LOD distante

A regra anterior que ocultava grama, flores, juncos e plantações nos chunks distantes foi substituída: ela fazia o terreno parecer vazio no zoom máximo. O renderer agora mantém amostras determinísticas por coordenada do mundo, evitando seleção aleatória por célula. No lote distante, conserva 10% das hastes da camada de grama baixa, 42% da grama comum, 35% das flores, 62% dos juncos e 78% das plantações. Árvores e arbustos mantêm sua distribuição. Os modelos usam a geometria simplificada já preparada para o LOD distante.

Conferência visual no navegador: semente 1769, mapa de 1.024 m, zoom máximo. A cobertura de plantas permaneceu visível ao redor das florestas e dos caminhos. O efeito sobre o desempenho em cenas densas ainda precisa de benchmark.

### Clareiras e bordas de cobertura

A cobertura decorativa agora usa manchas interpoladas de 13 m para abrir respiros, reduz tamanho e densidade nas bordas, afasta capim das estradas registradas e reduz cobertura sob árvores maduras. Um índice local de âncoras de 8 m permite reforçar plantas junto a pedras e árvores menores. A camada de grama e as plantas do MegaKit seguem a mesma máscara. A apresentação varia discretamente a luminosidade por região; a paleta mantém verdes e amarelos de clima quente. A proporção 70/30 é direção visual, ainda não uma área medida. Cercas e muros não recebem reforço específico nesta revisão. Recursos coletáveis e saves mantêm IDs. Build aprovado; conferência visual e custo no navegador pendentes.

### Transição gradual da grama por zoom

O shader agora reduz gradualmente a escala das hastes removidas pelo LOD entre spans 30 e 64 m e distâncias de 22 a 44 m do foco. A seleção usa o mesmo hash de coordenadas da amostra distante; hastes mantidas preservam escala. A redução ocorre no shader sem remontar lotes por passo de zoom. Materiais temporários são descartados com as instâncias. Removida também uma alocação de Color por haste. Build e testes de cobertura conferidos; validação visual do shader e benchmark ainda pendentes.

Ajuste de cobertura distante: a grama baixa retida passou de 10% para 24% (2,4 vezes mais hastes distantes), gramas do MegaKit de 42% para 60%, trevos de 35% para 45% e plantas altas de 62% para 68%. A redução por zoom começa em 38 m em vez de 30 m e termina antes da troca de lote em 66 m. CPU e shader compartilham a mesma constante de retenção. Três testes de cobertura passaram; impacto de FPS e inspeção visual desta calibragem pendentes.
A pedido, a retenção distante da grama baixa passou para 50%: cinco vezes os 10% originais e aproximadamente 2,08 vezes os 24% da calibragem anterior. A transição gradual usa a mesma constante. Três testes de cobertura aprovados; FPS ainda não medido nesta densidade.

### Árvores adultas maiores

Escala visual determinística por idade e coordenadas: multiplicador de 0,85 a 2,5, com exemplares grandes raros. O mesmo fator vale perto e longe e na seleção por clique. A base dos troncos importados recebe até 60% de espessura adicional, suavizada até 65% da altura e limitada ao envelope original da geometria base. Não altera IDs, recursos, colisões ou saves. Copas visuais podem se sobrepor mais; sombras de solo e máscara ecológica continuam baseadas no raio autoritativo. Dez testes de modelos e biomas aprovados; build aprovado antes do ajuste final de limite da espessura. Inspeção visual pendente.

### Bolsões de mata fechada

Camada adicional de árvores dt: nos biomas florestais 3, 4, 9, 10 e 11, com manchas bilineares de 36 m e bordas suaves. Usa posições intercaladas à grade anterior (deslocamento de 1,675 m), aumentando proximidade nos bolsões sem alterar as árvores existentes. A densidade responde ao controle de vegetação e é nula em zero. Não duplica a camada adicional das nascentes. IDs dt: são resolvidos por findResource e persistidos pelo mesmo conjunto de removidos; saves existentes recebem árvores adicionais, sem migração de IDs anteriores. Onze testes de cobertura/biomas e build aprovados. Inspeção visual, sobreposição de copas e benchmark em 5 km pendentes.
